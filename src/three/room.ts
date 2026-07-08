import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { outline } from '../model/shapes'

// A 20' × 20' room with a 9' ceiling, in inches. The mobile's ceiling hook is
// world origin, so the floor sits at -ROOM_H.
export const ROOM_W = 240
export const ROOM_D = 240
export const ROOM_H = 108
export const FLOOR_Y = -ROOM_H

const WALNUT = '#8a5a33'
const WALNUT_DARK = '#6e4526'
const LEATHER = '#211d1a'
const BASE_METAL = '#242427'

function roundedRect(w: number, d: number, r: number): THREE.Shape {
  const s = new THREE.Shape()
  const hw = w / 2
  const hd = d / 2
  s.moveTo(-hw + r, -hd)
  s.lineTo(hw - r, -hd)
  s.quadraticCurveTo(hw, -hd, hw, -hd + r)
  s.lineTo(hw, hd - r)
  s.quadraticCurveTo(hw, hd, hw - r, hd)
  s.lineTo(-hw + r, hd)
  s.quadraticCurveTo(-hw, hd, -hw, hd - r)
  s.lineTo(-hw, -hd + r)
  s.quadraticCurveTo(-hw, -hd, -hw + r, -hd)
  return s
}

/** soft leather cushion: rounded-rect slab with a fat bevel */
function cushion(w: number, d: number, h: number, mat: THREE.Material): THREE.Mesh {
  const bevel = Math.min(h * 0.45, 1.6)
  const geo = new THREE.ExtrudeGeometry(roundedRect(w - bevel * 2, d - bevel * 2, 2.5), {
    depth: h - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 3,
    curveSegments: 12,
  })
  geo.rotateX(-Math.PI / 2)
  geo.translate(0, h - bevel, 0)
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  return m
}

/** bent-plywood shell: a thin rounded-edge slab (reads as ply edge-on) */
function shellSlab(w: number, h: number, thickness: number, mat: THREE.Material): THREE.Mesh {
  const geo = new THREE.ExtrudeGeometry(roundedRect(w - 1.5, h - 1.5, 2.5), {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.75,
    bevelSegments: 2,
    curveSegments: 10,
  })
  geo.translate(0, 0, -thickness / 2)
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  return m
}

/** five-star pedestal base with down-sloped legs and glides */
function starBase(columnH: number, legLen: number, mat: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, columnH, 16), mat)
  column.position.y = 2.2 + columnH / 2
  column.castShadow = true
  g.add(column)
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2
    const leg = new THREE.Mesh(new THREE.BoxGeometry(legLen, 1.3, 1.9), mat)
    leg.position.set(Math.cos(a) * legLen * 0.42, 2.4, Math.sin(a) * legLen * 0.42)
    leg.rotation.y = -a
    leg.rotation.z = 0.16 // slope down toward the foot
    leg.castShadow = true
    g.add(leg)
    const glide = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 1.2, 10), mat)
    glide.position.set(Math.cos(a) * legLen * 0.82, 0.6, Math.sin(a) * legLen * 0.82)
    g.add(glide)
  }
  return g
}

/** Eames lounge chair, standard size: 33.5"W × 35"D × 31.5"H, seat height 16".
 *  Bent-plywood shells cradle tufted leather cushions on a five-star base. */
function eamesChair(): THREE.Group {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: WALNUT, roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide })
  const leather = new THREE.MeshStandardMaterial({ color: LEATHER, roughness: 0.55, metalness: 0.02 })
  const metal = new THREE.MeshStandardMaterial({ color: BASE_METAL, roughness: 0.3, metalness: 0.85 })

  g.add(starBase(8, 13, metal))

  // seat shell (ply slab, gentle backward rake) + soft cushion; chair faces +z
  const seatShell = shellSlab(30, 25, 1, wood)
  seatShell.rotation.x = -Math.PI / 2 - 0.1
  seatShell.position.set(0, 13.2, -0.5)
  g.add(seatShell)

  const seatCushion = cushion(25, 21, 5.5, leather)
  seatCushion.position.set(0, 13.6, 1)
  seatCushion.rotation.x = -0.1
  g.add(seatCushion)

  // back shell + cushion, raked ~24° (leaning away from the seat front at +z)
  const rake = 0.42
  const backShell = shellSlab(30, 14, 1, wood)
  backShell.rotation.x = rake
  backShell.position.set(0, 20.8, -8.6)
  g.add(backShell)

  const backCushion = cushion(24, 12, 4.2, leather)
  backCushion.rotation.x = Math.PI / 2 + rake
  backCushion.position.set(0, 20.8, -6.2)
  g.add(backCushion)

  // headrest shell + cushion, just above the back with the signature gap
  const headShell = shellSlab(30, 10, 1, wood)
  headShell.rotation.x = rake + 0.1
  headShell.position.set(0, 28.2, -12)
  g.add(headShell)

  const headCushion = cushion(24, 8.5, 4.2, leather)
  headCushion.rotation.x = Math.PI / 2 + rake + 0.1
  headCushion.position.set(0, 28.1, -9.6)
  g.add(headCushion)

  // armrest pads, resting on the seat cushion sides
  for (const s of [-1, 1] as const) {
    const arm = cushion(4.5, 12, 2.4, leather)
    arm.position.set(s * 12.6, 17.6, 0.5)
    g.add(arm)
  }

  // exposed aluminum spines tying seat, back and headrest shells together
  for (const s of [-1, 1] as const) {
    const spine = new THREE.Mesh(new THREE.BoxGeometry(1.1, 18, 1.5), metal)
    spine.position.set(s * 11.8, 21, -10.4)
    spine.rotation.x = 0.44
    spine.castShadow = true
    g.add(spine)
  }
  return g
}

/** If real furniture models exist under public/models/ (eames-lounge.glb,
 *  noguchi-table.glb — e.g. converted from Herman Miller's SketchUp files),
 *  load one, normalize it to the given real-world height with its feet on
 *  y=0, and return it. Returns null when no model file is present.
 *  `remap` swaps in proper materials by mesh name — the official planning
 *  models ship mostly untextured grey. */
async function tryLoadModel(
  name: string,
  targetHeightIn: number,
  remap?: (meshName: string) => THREE.Material | null,
): Promise<THREE.Group | null> {
  try {
    const gltf = await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/${name}.glb`)
    const g = gltf.scene
    const box = new THREE.Box3().setFromObject(g)
    const height = box.max.y - box.min.y
    if (!isFinite(height) || height <= 0) return null
    g.scale.setScalar(targetHeightIn / height)
    box.setFromObject(g)
    g.position.set(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2)
    g.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        const mat = remap?.(o.name ?? '')
        if (mat) o.material = mat
        // planning models often ship unlit, without usable normals — lit
        // materials render them black unless we compute normals ourselves
        const geo = o.geometry as THREE.BufferGeometry
        if (geo.getIndex() || !geo.getAttribute('normal')) geo.computeVertexNormals()
        const transparent = (o.material as THREE.Material | undefined)?.transparent ?? false
        o.castShadow = !transparent
      }
    })
    const wrap = new THREE.Group()
    wrap.add(g)
    return wrap
  } catch {
    return null
  }
}

/** Eames ottoman: 26"W × 20.75"D × 17.25"H */
function eamesOttoman(): THREE.Group {
  const g = new THREE.Group()
  const wood = new THREE.MeshStandardMaterial({ color: WALNUT, roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide })
  const leather = new THREE.MeshStandardMaterial({ color: LEATHER, roughness: 0.55, metalness: 0.02 })
  const metal = new THREE.MeshStandardMaterial({ color: BASE_METAL, roughness: 0.3, metalness: 0.85 })

  g.add(starBase(5, 11, metal))

  const pan = shellSlab(25, 20, 1, wood)
  pan.rotation.x = -Math.PI / 2
  pan.position.y = 10.8
  g.add(pan)

  const top = cushion(25, 19.5, 6, leather)
  top.position.y = 11.2
  g.add(top)
  return g
}

/** one sculpted base leg for the Noguchi table: a smooth arch blade that
 *  stands on two feet, ~14.5" tall */
function noguchiBlade(mat: THREE.Material): THREE.Mesh {
  const s = new THREE.Shape()
  s.moveTo(-10.5, 0)
  s.quadraticCurveTo(-10.5, 14.5, 1, 14.5) // outer: up and over
  s.quadraticCurveTo(11, 14.5, 11, 0) // outer: down the far side
  s.lineTo(7.2, 0)
  s.quadraticCurveTo(7.2, 11, 0.5, 11) // inner arch back
  s.quadraticCurveTo(-6.8, 11, -6.8, 0)
  s.closePath()
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 1.7,
    bevelEnabled: true,
    bevelThickness: 0.3,
    bevelSize: 0.3,
    bevelSegments: 2,
    curveSegments: 24,
  })
  geo.translate(0, 0, -0.85)
  const m = new THREE.Mesh(geo, mat)
  m.castShadow = true
  return m
}

/** Noguchi coffee table: 50" × 36" freeform glass top, 15.75" tall, ¾" glass,
 *  on two identical sculpted blades, one inverted against the other. */
function noguchiTable(): THREE.Group {
  const g = new THREE.Group()

  const glassPts = outline('blob', 50, 36)
  const glassShape = new THREE.Shape(glassPts.map((p) => new THREE.Vector2(p.x, p.y)))
  const glassGeo = new THREE.ExtrudeGeometry(glassShape, { depth: 0.75, bevelEnabled: false, curveSegments: 32 })
  const glass = new THREE.Mesh(
    glassGeo,
    new THREE.MeshPhysicalMaterial({
      color: '#8fb5a0',
      transparent: true,
      opacity: 0.42,
      roughness: 0.05,
      metalness: 0,
      envMapIntensity: 1.4,
      side: THREE.DoubleSide,
    }),
  )
  glass.rotation.x = -Math.PI / 2
  glass.position.y = 15.0 // ¾" extrusion grows upward after the rotation → top at 15.75
  g.add(glass)

  const wood = new THREE.MeshStandardMaterial({ color: WALNUT_DARK, roughness: 0.25, metalness: 0.05 })

  // two arch blades crossing at an angle, like the interlocked original
  const bladeA = noguchiBlade(wood)
  bladeA.rotation.y = 0.3
  bladeA.position.set(-2, 0, 1)
  g.add(bladeA)

  const bladeB = noguchiBlade(wood)
  bladeB.rotation.y = Math.PI * 0.62
  bladeB.position.set(2.5, 0, -1)
  g.add(bladeB)

  return g
}

function plankTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#c8a067'
  ctx.fillRect(0, 0, 512, 512)
  // planks with slight tone variation and gaps
  const plank = 64
  for (let i = 0; i < 8; i++) {
    const tone = 195 + ((i * 37) % 26) - 13
    ctx.fillStyle = `rgb(${tone}, ${Math.round(tone * 0.78)}, ${Math.round(tone * 0.5)})`
    ctx.fillRect(0, i * plank + 1, 512, plank - 2)
    ctx.fillStyle = 'rgba(90, 60, 30, 0.5)'
    ctx.fillRect(0, i * plank, 512, 1.5)
    // butt joints, staggered
    const joint = (i * 197) % 512
    ctx.fillRect(joint, i * plank, 1.5, plank)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(3, 3)
  return tex
}

export interface Room {
  group: THREE.Group
  dispose(): void
}

/** The whole environment: walls, plank floor, rug, ceiling medallion, and the
 *  two mid-century classics for scale. Everything is static scenery. */
export function buildRoom(): Room {
  const group = new THREE.Group()
  const disposables: { dispose(): void }[] = []
  const track = <T extends { dispose(): void }>(d: T): T => {
    disposables.push(d)
    return d
  }

  // walls as inward-facing planes: visible from inside the room, invisible
  // when the camera orbits outside, so the view never gets blocked
  const wallMat = track(new THREE.MeshStandardMaterial({ color: '#e9e1d2', roughness: 0.95 }))
  const wallGeo = track(new THREE.PlaneGeometry(ROOM_W, ROOM_H))
  const wallDefs: { pos: [number, number, number]; rotY: number }[] = [
    { pos: [0, -ROOM_H / 2, -ROOM_D / 2], rotY: 0 },
    { pos: [0, -ROOM_H / 2, ROOM_D / 2], rotY: Math.PI },
    { pos: [-ROOM_W / 2, -ROOM_H / 2, 0], rotY: Math.PI / 2 },
    { pos: [ROOM_W / 2, -ROOM_H / 2, 0], rotY: -Math.PI / 2 },
  ]
  for (const wd of wallDefs) {
    const wall = new THREE.Mesh(wallGeo, wallMat)
    wall.position.set(...wd.pos)
    wall.rotation.y = wd.rotY
    wall.receiveShadow = true
    group.add(wall)
  }
  // unlit ceiling so it reads as a clean white plane instead of going muddy
  // (no light in the scene points up at it)
  const ceiling = new THREE.Mesh(
    track(new THREE.PlaneGeometry(ROOM_W, ROOM_D)),
    track(new THREE.MeshBasicMaterial({ color: '#efe8d8' })),
  )
  ceiling.rotation.x = Math.PI / 2
  ceiling.position.y = -0.05
  group.add(ceiling)

  const floorTex = track(plankTexture())
  const floorMat = track(new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85 }))
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(ROOM_W, ROOM_D)), floorMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.y = FLOOR_Y + 0.1
  floor.receiveShadow = true
  group.add(floor)

  const rug = new THREE.Mesh(
    track(new THREE.CircleGeometry(46, 48)),
    track(new THREE.MeshStandardMaterial({ color: '#e4dcc9', roughness: 1 })),
  )
  rug.rotation.x = -Math.PI / 2
  rug.position.set(4, FLOOR_Y + 0.25, 10)
  rug.receiveShadow = true
  group.add(rug)

  // ceiling medallion where the mobile hangs
  const medallion = new THREE.Mesh(
    track(new THREE.CylinderGeometry(1.6, 2.1, 0.8, 24)),
    track(new THREE.MeshStandardMaterial({ color: '#d8d0c0', roughness: 0.8 })),
  )
  medallion.position.y = -0.4
  group.add(medallion)

  // classic living-room arrangement: coffee table just off the room's center
  // (under the mobile), chair and ottoman angled toward it
  // the chair is modeled facing +z, so this rotation turns it toward the table
  const chair = eamesChair()
  chair.position.set(-62, FLOOR_Y, -32)
  chair.rotation.y = 1.3
  group.add(chair)

  const ottoman = eamesOttoman()
  ottoman.position.set(-34, FLOOR_Y, -14)
  ottoman.rotation.y = 1.3
  group.add(ottoman)

  const table = noguchiTable()
  table.position.set(16, FLOOR_Y, 18)
  table.rotation.y = -0.35
  group.add(table)

  // swap in real models if they've been added to public/models/
  let disposed = false
  const trackModel = (model: THREE.Group) => {
    model.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        disposables.push(o.geometry)
        if (Array.isArray(o.material)) disposables.push(...o.material)
        else disposables.push(o.material)
      }
    })
  }
  // the official models come mostly untextured grey — dress the named parts
  // DoubleSide throughout: SketchUp-exported meshes have inconsistent face
  // winding, and single-sided materials render those faces black
  const leather = new THREE.MeshStandardMaterial({ color: '#1d1917', roughness: 0.5, metalness: 0.05, side: THREE.DoubleSide })
  const walnutShell = new THREE.MeshStandardMaterial({ color: '#6b4226', roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide })
  const aluminum = new THREE.MeshStandardMaterial({ color: '#b4b6ba', roughness: 0.25, metalness: 0.9, side: THREE.DoubleSide })
  const walnutBase = new THREE.MeshStandardMaterial({ color: '#4a3018', roughness: 0.35, metalness: 0.05, side: THREE.DoubleSide })
  const tableGlass = new THREE.MeshPhysicalMaterial({
    color: '#9fc0ac',
    transparent: true,
    opacity: 0.35,
    roughness: 0.05,
    metalness: 0,
    envMapIntensity: 1.4,
    side: THREE.DoubleSide,
  })

  void tryLoadModel('eames-lounge', 31.5, (n) => {
    if (n.includes('FABRIC')) return leather
    if (n.includes('SHELL')) return walnutShell
    if (n.includes('BASE')) return aluminum
    if (n.includes('GLIDE')) return leather
    return null
  }).then((model) => {
    if (!model || disposed) return
    model.position.set(-52, FLOOR_Y, -25) // chair + ottoman set, centered between them
    model.rotation.y = 1.3
    group.add(model)
    trackModel(model)
    chair.visible = false
    ottoman.visible = false
  })
  void tryLoadModel('noguchi-table', 15.75, (n) => {
    if (n.includes('TOP')) return tableGlass
    return walnutBase
  }).then((model) => {
    if (!model || disposed) return
    model.position.set(16, FLOOR_Y, 18)
    model.rotation.y = -0.35
    group.add(model)
    trackModel(model)
    table.visible = false
  })

  // collect geometry/material disposables from the furniture builders
  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      disposables.push(obj.geometry)
      if (Array.isArray(obj.material)) disposables.push(...obj.material)
      else disposables.push(obj.material)
    }
  })

  return {
    group,
    dispose() {
      disposed = true
      for (const d of disposables) d.dispose()
    },
  }
}
