import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import * as CANNON from 'cannon-es'
import type { ArmNode, MobileDoc, MobileNode, ShapeNode } from '../model/types'
import { isArm } from '../model/types'
import { computePose, shapeWeightOz } from '../model/balance'
import type { Pose } from '../model/balance'
import { WIRES } from '../model/materials'
import { centroid, holePos, outline, shapeArea } from '../model/shapes'
import { FLOOR_Y, buildRoom } from './room'
import type { Room } from './room'

// Physics runs directly in inches + ounces: gravity is 386 in/s² and all
// forces are oz·in/s², so no unit conversion is needed anywhere.
const GRAVITY_IN_S2 = 386.09

interface NodeVisual {
  node: MobileNode
  group: THREE.Group
  body?: CANNON.Body
  meshes: THREE.Mesh[]
  /** shapes only: true center of gravity in the group's local frame — the
   *  physics body origin sits here rather than at the bounding-box center */
  com?: { x: number; y: number }
}

export class SceneManager {
  private container: HTMLElement
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private controls: OrbitControls
  private raycaster = new THREE.Raycaster()
  private clock = new THREE.Clock()
  private resizeObs: ResizeObserver

  private doc: MobileDoc | null = null
  private pose: Pose | null = null
  private mode: 'build' | 'test' = 'build'
  private breeze = 0.35
  private selectedId: string | null = null

  private visuals = new Map<string, NodeVisual>()
  private hangerGroup: THREE.Group | null = null
  private hangerBody: CANNON.Body | null = null
  private mobileRoot = new THREE.Group()
  private room: Room
  private shadowCatcher!: THREE.Mesh
  private disposables: { dispose(): void }[] = []

  private world: CANNON.World | null = null
  private anchor: CANNON.Body | null = null

  // camera glide between preset views
  private camAnim: {
    fromPos: THREE.Vector3
    toPos: THREE.Vector3
    fromTarget: THREE.Vector3
    toTarget: THREE.Vector3
    start: number
    dur: number
  } | null = null

  // drag state
  private dragBody: CANNON.Body | null = null
  private dragConstraint: CANNON.PointToPointConstraint | null = null
  private dragPlane = new THREE.Plane()
  private lastNodeCount = -1

  onPick: ((id: string | null) => void) | null = null

  /** how new mobiles get framed: interior photo (desktop) or close-up (phone) */
  frameStyle: 'interior' | 'closeup' = 'interior'

  private rafId = 0

  constructor(container: HTMLElement) {
    this.container = container
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#ded7c9')
    // image-based lighting so leather, glass and metal read as materials —
    // kept subtle so the warm direct lighting still dominates
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    this.scene.environmentIntensity = 0.45
    pmrem.dispose()

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1200)
    this.camera.position.set(30, -40, 120)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI * 0.72
    this.controls.minDistance = 12
    this.controls.maxDistance = 420
    this.controls.target.set(0, -30, 0)
    // grabbing the view cancels any preset-zoom glide
    this.controls.addEventListener('start', () => {
      this.camAnim = null
    })

    // lights: the environment map provides the fill; keep direct lights modest
    const hemi = new THREE.HemisphereLight('#fffdf7', '#cbbfa8', 0.55)
    this.scene.add(hemi)
    const dir = new THREE.DirectionalLight('#fff3dd', 1.5)
    dir.position.set(70, 60, 45)
    dir.castShadow = true
    dir.shadow.mapSize.set(2048, 2048)
    dir.shadow.camera.left = -140
    dir.shadow.camera.right = 140
    dir.shadow.camera.top = 60
    dir.shadow.camera.bottom = -160
    dir.shadow.camera.far = 400
    dir.shadow.bias = -0.0005
    this.scene.add(dir)

    // the 20' × 20' room with furniture for scale; ceiling hook at world origin
    this.room = buildRoom()
    this.scene.add(this.room.group)

    // invisible shadow catcher for when the room is hidden, so the mobile
    // still grounds itself with a soft shadow in the blank space
    this.shadowCatcher = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.ShadowMaterial({ opacity: 0.16 }),
    )
    this.shadowCatcher.rotation.x = -Math.PI / 2
    this.shadowCatcher.position.y = FLOOR_Y
    this.shadowCatcher.receiveShadow = true
    this.shadowCatcher.visible = false
    this.scene.add(this.shadowCatcher)

    this.scene.add(this.mobileRoot)

    this.resizeObs = new ResizeObserver(() => this.resize())
    this.resizeObs.observe(container)
    this.resize()

    const el = this.renderer.domElement
    el.addEventListener('pointerdown', this.onPointerDown)
    el.addEventListener('pointermove', this.onPointerMove)
    el.addEventListener('pointerup', this.onPointerUp)
    el.style.touchAction = 'none'

    this.animate()
  }

  // ------------------------------------------------------------------ public

  setDoc(doc: MobileDoc): void {
    this.doc = doc
    this.rebuild()
  }

  setMode(mode: 'build' | 'test'): void {
    if (this.mode === mode) return
    this.mode = mode
    this.rebuild()
  }

  setBreeze(b: number): void {
    this.breeze = b
  }

  setRoomVisible(v: boolean): void {
    this.room.group.visible = v
    this.shadowCatcher.visible = !v
  }

  /** Glide the camera to a preset view. 'mobile' frames the mobile straight
   *  on, filling the view; 'room' pulls back to take in the whole room.
   *  `immediate` jumps there without the glide. */
  frameView(view: 'room' | 'mobile', immediate = false): void {
    if (!this.pose) return
    const cx = (this.pose.min.x + this.pose.max.x) / 2
    const cy = (this.pose.min.y + this.pose.max.y) / 2
    const cz = (this.pose.min.z + this.pose.max.z) / 2
    let toPos: THREE.Vector3
    let toTarget: THREE.Vector3
    if (view === 'mobile') {
      const size = Math.max(
        this.pose.max.x - this.pose.min.x,
        this.pose.max.y - this.pose.min.y,
        this.pose.max.z - this.pose.min.z,
        14,
      )
      // fill the frame with a touch of margin, viewed nearly straight on —
      // use the tighter of the vertical/horizontal view angles so portrait
      // phone screens don't crop wide mobiles
      const vHalf = (this.camera.fov * Math.PI) / 360
      const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect)
      const dist = Math.max((size * 0.62) / Math.tan(Math.min(vHalf, hHalf)), 26)
      toTarget = new THREE.Vector3(cx, cy, cz)
      toPos = new THREE.Vector3(cx + dist * 0.12, cy + size * 0.04, cz + dist)
    } else {
      toTarget = new THREE.Vector3(0, FLOOR_Y + 52, 0)
      toPos = new THREE.Vector3(105, FLOOR_Y + 82, 225)
    }
    if (immediate) {
      this.camAnim = null
      this.camera.position.copy(toPos)
      this.controls.target.copy(toTarget)
      return
    }
    this.camAnim = {
      fromPos: this.camera.position.clone(),
      toPos,
      fromTarget: this.controls.target.clone(),
      toTarget,
      start: this.clock.elapsedTime,
      dur: 0.8,
    }
  }

  setSelected(id: string | null): void {
    this.selectedId = id
    for (const [nid, vis] of this.visuals) {
      for (const mesh of vis.meshes) {
        const mat = mesh.material as THREE.MeshStandardMaterial
        if (mat.emissive) mat.emissive.set(nid === id ? '#7a5a00' : '#000000')
      }
    }
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId)
    this.resizeObs.disconnect()
    const el = this.renderer.domElement
    el.removeEventListener('pointerdown', this.onPointerDown)
    el.removeEventListener('pointermove', this.onPointerMove)
    el.removeEventListener('pointerup', this.onPointerUp)
    this.clearMobile()
    this.room.dispose()
    this.controls.dispose()
    this.renderer.dispose()
    el.remove()
  }

  // ----------------------------------------------------------------- builder

  private clearMobile(): void {
    this.mobileRoot.clear()
    for (const d of this.disposables) d.dispose()
    this.disposables = []
    this.visuals.clear()
    this.hangerGroup = null
    this.hangerBody = null
    this.world = null
    this.anchor = null
    this.dragBody = null
    this.dragConstraint = null
  }

  private track<T extends { dispose(): void }>(d: T): T {
    this.disposables.push(d)
    return d
  }

  private rebuild(): void {
    if (!this.doc) return
    this.clearMobile()
    this.pose = computePose(this.doc)

    if (this.mode === 'test') {
      this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -GRAVITY_IN_S2, 0) })
      ;(this.world.solver as CANNON.GSSolver).iterations = 60
      this.anchor = new CANNON.Body({ mass: 0 })
      this.anchor.position.set(0, 0, 0)
      this.world.addBody(this.anchor)
    }

    this.buildHanger()
    this.buildNode(this.doc.root, null, 'left')
    this.applyStaticPose()
    this.setSelected(this.selectedId)
    this.frameCameraIfNeeded()
  }

  private wireMaterial(wire: keyof typeof WIRES): THREE.MeshStandardMaterial {
    const brass = wire.startsWith('brass')
    return this.track(
      new THREE.MeshStandardMaterial({
        color: brass ? '#b08d57' : '#4a4d52',
        metalness: 0.8,
        roughness: 0.35,
      }),
    )
  }

  private buildHanger(): void {
    if (!this.doc || !this.pose) return
    const drop = this.doc.hangerDrop
    const wireKey = isArm(this.doc.root) ? this.doc.root.wire : ('steel16' as const)
    const mat = this.wireMaterial(wireKey)
    const group = new THREE.Group()
    const rod = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.05, 0.05, drop, 8)), mat)
    rod.castShadow = true
    group.add(rod)
    this.mobileRoot.add(group)
    this.hangerGroup = group

    if (this.world && this.anchor) {
      const body = new CANNON.Body({ mass: Math.max(WIRES[wireKey].ozPerIn * drop, 0.05) })
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.05, drop / 2, 0.05)))
      body.linearDamping = 0.15
      body.angularDamping = 0.3
      body.collisionFilterMask = 0
      body.position.set(0, -drop / 2, 0)
      this.world.addBody(body)
      this.world.addConstraint(
        new CANNON.PointToPointConstraint(this.anchor, new CANNON.Vec3(0, 0, 0), body, new CANNON.Vec3(0, drop / 2, 0)),
      )
      this.hangerBody = body
    }
  }

  /** Build the visual group + physics body for a node. The group/body origin
   *  conventions must match applyStaticPose() and the constraint anchors:
   *  arm: origin at midpoint of the line between end loops, x along the arm.
   *  shape: origin at the shape's center, outline in the local XY plane. */
  private buildNode(node: MobileNode, parent: ArmNode | null, side: 'left' | 'right'): void {
    if (node.kind === 'arm') this.buildArm(node)
    else this.buildShape(node)
    if (node.kind === 'arm') {
      this.buildNode(node.left, node, 'left')
      this.buildNode(node.right, node, 'right')
    }
    this.connectToParent(node, parent, side)
  }

  private buildArm(node: ArmNode): void {
    const L = node.length
    const mat = this.wireMaterial(node.wire)
    const group = new THREE.Group()
    const meshes: THREE.Mesh[] = []

    // gently arced rod passing from end loop up over the pivot loop
    const px = node.pivot - L / 2
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(-L / 2, 0, 0),
        new THREE.Vector3(px, node.pivotHeight * 1.05, 0),
        new THREE.Vector3(L / 2, 0, 0),
      ],
      false,
      'catmullrom',
      0.6,
    )
    const rod = new THREE.Mesh(this.track(new THREE.TubeGeometry(curve, 32, 0.05, 8)), mat)
    rod.castShadow = true
    group.add(rod)
    meshes.push(rod)

    // loops: pivot + both ends + drop wires with their bottom loops
    const loopGeo = this.track(new THREE.TorusGeometry(0.16, 0.045, 8, 16))
    const pivotLoop = new THREE.Mesh(loopGeo, mat)
    pivotLoop.position.set(px, node.pivotHeight + 0.16, 0)
    group.add(pivotLoop)

    for (const s of [-1, 1] as const) {
      const drop = s === -1 ? node.dropLeft : node.dropRight
      const endLoop = new THREE.Mesh(loopGeo, mat)
      endLoop.position.set((s * L) / 2, -0.1, 0)
      group.add(endLoop)
      const dropRod = new THREE.Mesh(this.track(new THREE.CylinderGeometry(0.045, 0.045, drop, 8)), mat)
      dropRod.position.set((s * L) / 2, -drop / 2, 0)
      dropRod.castShadow = true
      group.add(dropRod)
      const bottomLoop = new THREE.Mesh(loopGeo, mat)
      bottomLoop.position.set((s * L) / 2, -drop + 0.1, 0)
      group.add(bottomLoop)
    }

    this.mobileRoot.add(group)
    const vis: NodeVisual = { node, group, meshes }

    if (this.world) {
      const ozPerIn = WIRES[node.wire].ozPerIn
      const mass = Math.max(ozPerIn * (L + node.dropLeft + node.dropRight), 0.12)
      const body = new CANNON.Body({ mass })
      body.addShape(new CANNON.Box(new CANNON.Vec3(L / 2, 0.06, 0.06)))
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.05, node.dropLeft / 2, 0.05)), new CANNON.Vec3(-L / 2, -node.dropLeft / 2, 0))
      body.addShape(new CANNON.Box(new CANNON.Vec3(0.05, node.dropRight / 2, 0.05)), new CANNON.Vec3(L / 2, -node.dropRight / 2, 0))
      body.linearDamping = 0.15
      body.angularDamping = 0.25
      body.collisionFilterMask = 0
      this.world.addBody(body)
      vis.body = body
    }
    this.visuals.set(node.id, vis)
  }

  private buildShape(node: ShapeNode): void {
    const pts = outline(node.shape, node.width, node.height)
    const shape2d = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, p.y)))
    const geo = this.track(
      new THREE.ExtrudeGeometry(shape2d, { depth: node.thickness, bevelEnabled: false, curveSegments: 24 }),
    )
    geo.translate(0, 0, -node.thickness / 2)
    const mat = this.track(new THREE.MeshStandardMaterial({ color: node.color, roughness: 0.55, metalness: 0.05 }))
    const mesh = new THREE.Mesh(geo, mat)
    mesh.castShadow = true
    const group = new THREE.Group()
    group.add(mesh)
    this.mobileRoot.add(group)
    const vis: NodeVisual = { node, group, meshes: [mesh] }

    if (this.world) {
      const c = centroid(node.shape, node.width, node.height)
      const body = new CANNON.Body({ mass: Math.max(shapeWeightOz(node), 0.05) })
      // body origin = true centroid; the collision box is offset so the mass
      // hangs where the real cut piece's mass hangs
      body.addShape(
        new CANNON.Box(new CANNON.Vec3(node.width / 2, node.height / 2, Math.max(node.thickness / 2, 0.05))),
        new CANNON.Vec3(-c.x, -c.y, 0),
      )
      body.linearDamping = 0.2
      body.angularDamping = 0.3
      body.collisionFilterMask = 0
      this.world.addBody(body)
      vis.body = body
      vis.com = c
    }
    this.visuals.set(node.id, vis)
  }

  /** PointToPoint constraints matching the render geometry: the joint sits at
   *  the bottom loop of the parent's drop wire = the child's top loop. */
  private connectToParent(node: MobileNode, parent: ArmNode | null, side: 'left' | 'right'): void {
    if (!this.world) return
    const childBody = this.visuals.get(node.id)?.body
    if (!childBody) return

    const childAnchor =
      node.kind === 'arm'
        ? new CANNON.Vec3(node.pivot - node.length / 2, node.pivotHeight, 0)
        : (() => {
            // shape body origin sits at the centroid, so express the hole there
            const hole = holePos(node.shape, node.width, node.height)
            const c = centroid(node.shape, node.width, node.height)
            return new CANNON.Vec3(hole.x - c.x, hole.y - c.y, 0)
          })()

    let parentBody: CANNON.Body | null
    let parentAnchor: CANNON.Vec3
    if (parent) {
      parentBody = this.visuals.get(parent.id)?.body ?? null
      const drop = side === 'left' ? parent.dropLeft : parent.dropRight
      const sx = side === 'left' ? -1 : 1
      parentAnchor = new CANNON.Vec3((sx * parent.length) / 2, -drop, 0)
    } else {
      parentBody = this.hangerBody
      parentAnchor = new CANNON.Vec3(0, -(this.doc?.hangerDrop ?? 0) / 2, 0)
    }
    if (!parentBody) return
    this.world.addConstraint(new CANNON.PointToPointConstraint(parentBody, parentAnchor, childBody, childAnchor))
  }

  /** Place groups (and physics bodies, when present) at the analytic rest pose. */
  private applyStaticPose(): void {
    if (!this.doc || !this.pose) return

    if (this.hangerGroup) {
      this.hangerGroup.position.set(0, -this.doc.hangerDrop / 2, 0)
      this.hangerGroup.quaternion.identity()
      if (this.hangerBody) {
        this.hangerBody.position.set(0, -this.doc.hangerDrop / 2, 0)
        this.hangerBody.quaternion.set(0, 0, 0, 1)
      }
    }

    for (const vis of this.visuals.values()) {
      const q = new THREE.Quaternion()
      const pos = new THREE.Vector3()
      if (vis.node.kind === 'arm') {
        const p = this.pose.arms.get(vis.node.id)
        if (!p) continue
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yawRad).multiply(
          new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), p.tiltRad),
        )
        // group origin is the midpoint of the end-loop line
        pos.set(
          (p.leftEndW.x + p.rightEndW.x) / 2,
          (p.leftEndW.y + p.rightEndW.y) / 2,
          (p.leftEndW.z + p.rightEndW.z) / 2,
        )
      } else {
        const p = this.pose.shapes.get(vis.node.id)
        if (!p) continue
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), p.yawRad)
        pos.set(p.centerW.x, p.centerW.y, p.centerW.z)
      }
      vis.group.position.copy(pos)
      vis.group.quaternion.copy(q)
      if (vis.body) {
        // shape bodies live at the centroid, offset from the group origin
        const bodyPos = vis.com ? pos.clone().add(new THREE.Vector3(vis.com.x, vis.com.y, 0).applyQuaternion(q)) : pos
        vis.body.position.set(bodyPos.x, bodyPos.y, bodyPos.z)
        vis.body.quaternion.set(q.x, q.y, q.z, q.w)
        vis.body.velocity.setZero()
        vis.body.angularVelocity.setZero()
      }
    }

  }

  private frameCameraIfNeeded(): void {
    if (!this.pose) return
    const count = this.visuals.size
    if (count === this.lastNodeCount) return
    this.lastNodeCount = count
    const cx = (this.pose.min.x + this.pose.max.x) / 2
    const cy = (this.pose.min.y + this.pose.max.y) / 2
    const cz = (this.pose.min.z + this.pose.max.z) / 2
    const size = Math.max(
      this.pose.max.x - this.pose.min.x,
      this.pose.max.y - this.pose.min.y,
      this.pose.max.z - this.pose.min.z,
      20,
    )
    if (this.frameStyle === 'closeup') {
      this.frameView('mobile', true)
      return
    }
    // compose like an interior photo: eye at standing height, aimed so the
    // mobile floats in the upper half with the furniture anchoring the lower
    const targetY = cy * 0.35 + (FLOOR_Y + 40) * 0.65
    this.controls.target.set(cx, targetY, cz)
    const dist = Math.max(size * 2.6, 175)
    this.camera.position.set(cx + dist * 0.5, FLOOR_Y + 60, cz + dist)
  }

  // ------------------------------------------------------------- interaction

  private pointerNdc(e: PointerEvent): THREE.Vector2 {
    const rect = this.renderer.domElement.getBoundingClientRect()
    return new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
  }

  private onPointerDown = (e: PointerEvent): void => {
    const ndc = this.pointerNdc(e)
    this.raycaster.setFromCamera(ndc, this.camera)
    const pickables: THREE.Object3D[] = []
    for (const vis of this.visuals.values()) pickables.push(vis.group)
    const hits = this.raycaster.intersectObjects(pickables, true)
    if (!hits.length) {
      this.onPick?.(null)
      return
    }
    // find which node group was hit
    let obj: THREE.Object3D | null = hits[0].object
    let hitId: string | null = null
    while (obj) {
      for (const [id, vis] of this.visuals) {
        if (vis.group === obj) {
          hitId = id
          break
        }
      }
      if (hitId) break
      obj = obj.parent
    }
    this.onPick?.(hitId)

    if (this.mode === 'test' && hitId && this.world) {
      const vis = this.visuals.get(hitId)
      if (!vis?.body) return
      const hitPoint = hits[0].point
      this.dragPlane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()).negate(), hitPoint)
      this.dragBody = new CANNON.Body({ mass: 0 })
      this.dragBody.position.set(hitPoint.x, hitPoint.y, hitPoint.z)
      this.dragBody.collisionFilterMask = 0
      this.world.addBody(this.dragBody)
      const local = vis.body.pointToLocalFrame(new CANNON.Vec3(hitPoint.x, hitPoint.y, hitPoint.z))
      this.dragConstraint = new CANNON.PointToPointConstraint(
        vis.body,
        local,
        this.dragBody,
        new CANNON.Vec3(0, 0, 0),
        vis.body.mass * GRAVITY_IN_S2 * 8,
      )
      this.world.addConstraint(this.dragConstraint)
      this.controls.enabled = false
      this.renderer.domElement.setPointerCapture(e.pointerId)
    }
  }

  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragBody) return
    const ndc = this.pointerNdc(e)
    this.raycaster.setFromCamera(ndc, this.camera)
    const target = new THREE.Vector3()
    if (this.raycaster.ray.intersectPlane(this.dragPlane, target)) {
      this.dragBody.position.set(target.x, target.y, target.z)
    }
  }

  private onPointerUp = (e: PointerEvent): void => {
    if (this.dragConstraint && this.world) {
      this.world.removeConstraint(this.dragConstraint)
      this.dragConstraint = null
    }
    if (this.dragBody && this.world) {
      this.world.removeBody(this.dragBody)
      this.dragBody = null
    }
    this.controls.enabled = true
    if (this.renderer.domElement.hasPointerCapture(e.pointerId)) {
      this.renderer.domElement.releasePointerCapture(e.pointerId)
    }
  }

  // ------------------------------------------------------------------- loop

  /** Wind as a real aerodynamic force: F = ½ ρ Cd A v², with slowly wandering
   *  direction and gusts that die down to near-still lulls. Because the force
   *  scales with each shape's actual cut area (not its mass), small pieces get
   *  proportionally small pushes. */
  private applyBreeze(t: number): void {
    if (!this.world || this.breeze <= 0.001) return
    const AIR_OZ_IN3 = 7.08e-4
    const CD = 1.2
    // slider → wind speed, in/s (max ≈ 2.5 m/s — a light indoor breeze)
    const windSpeed = Math.pow(this.breeze, 1.5) * 100
    const windDir = t * 0.11 // wind direction slowly wanders around the room
    let i = 0
    for (const vis of this.visuals.values()) {
      if (!vis.body || vis.node.kind !== 'shape') continue
      i += 1
      const phase = i * 1.7
      // gusts with real lulls: mostly calm, occasional pushes
      const g = 0.5 + 0.5 * Math.sin(t * 0.31 + phase) * Math.sin(t * 0.13 + phase * 2.3)
      const gust = Math.max(0.08, g * g)
      const v = windSpeed * gust
      const area = shapeArea(vis.node.shape, vis.node.width, vis.node.height)
      const mag = 0.5 * AIR_OZ_IN3 * CD * area * v * v
      const f = new CANNON.Vec3(Math.sin(windDir + phase * 0.15) * mag, 0, Math.cos(windDir + phase * 0.15) * mag)
      // apply slightly off-center so shapes also twist and the mobile slowly rotates
      const offset = vis.body.quaternion.vmult(new CANNON.Vec3(vis.node.width / 6, 0, 0))
      vis.body.applyForce(f, vis.body.position.vadd(offset))
    }
  }

  private animate = (): void => {
    this.rafId = requestAnimationFrame(this.animate)
    const dt = Math.min(this.clock.getDelta(), 0.05)

    if (this.camAnim) {
      const a = this.camAnim
      const t = Math.min((this.clock.elapsedTime - a.start) / a.dur, 1)
      const k = t * t * (3 - 2 * t) // smoothstep
      this.camera.position.lerpVectors(a.fromPos, a.toPos, k)
      this.controls.target.lerpVectors(a.fromTarget, a.toTarget, k)
      if (t >= 1) this.camAnim = null
    }
    this.controls.update()

    if (this.mode === 'test' && this.world) {
      this.applyBreeze(this.clock.elapsedTime)
      this.world.step(1 / 120, dt, 10)
      for (const vis of this.visuals.values()) {
        if (!vis.body) continue
        const b = vis.body
        vis.group.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
        if (vis.com) {
          // body origin is the centroid; shift back to the group's bbox-center origin
          const off = b.quaternion.vmult(new CANNON.Vec3(-vis.com.x, -vis.com.y, 0))
          vis.group.position.set(b.position.x + off.x, b.position.y + off.y, b.position.z + off.z)
        } else {
          vis.group.position.set(b.position.x, b.position.y, b.position.z)
        }
      }
      if (this.hangerBody && this.hangerGroup) {
        const b = this.hangerBody
        this.hangerGroup.position.set(b.position.x, b.position.y, b.position.z)
        this.hangerGroup.quaternion.set(b.quaternion.x, b.quaternion.y, b.quaternion.z, b.quaternion.w)
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  private resize(): void {
    const w = this.container.clientWidth || 1
    const h = this.container.clientHeight || 1
    this.renderer.setSize(w, h)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
  }
}
