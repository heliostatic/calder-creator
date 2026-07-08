import * as THREE from 'three'
import { outline } from '../model/shapes'

// A 20' × 20' room with a 9' ceiling, in inches. The mobile's ceiling hook is
// world origin, so the floor sits at -ROOM_H.
export const ROOM_W = 240
export const ROOM_D = 240
export const ROOM_H = 108
export const FLOOR_Y = -ROOM_H

const ROSEWOOD = '#5e3a24'
const LEATHER = '#26221f'
const WALNUT = '#43301f'
const ALUMINUM = '#8d8d93'

function box(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
  rx = 0,
  rz = 0,
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
  m.position.set(x, y, z)
  m.rotation.x = rx
  m.rotation.z = rz
  m.castShadow = true
  return m
}

/** five-star pedestal base, shared by the chair and ottoman */
function pedestal(mat: THREE.Material, columnH: number): THREE.Group {
  const g = new THREE.Group()
  const column = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, columnH, 12), mat)
  column.position.y = 2 + columnH / 2
  column.castShadow = true
  g.add(column)
  for (let i = 0; i < 5; i++) {
    const leg = box(11, 1.6, 2.2, mat, 0, 1.2, 0)
    leg.position.x = Math.cos((i / 5) * Math.PI * 2) * 5.5
    leg.position.z = Math.sin((i / 5) * Math.PI * 2) * 5.5
    leg.rotation.y = -(i / 5) * Math.PI * 2
    g.add(leg)
  }
  return g
}

/** Eames lounge chair, standard size: 33.5"W × 35"D × 31.5"H, seat height 16".
 *  Low-poly homage built from boxes — shells in rosewood, cushions in black. */
function eamesChair(): THREE.Group {
  const g = new THREE.Group()
  const shell = new THREE.MeshStandardMaterial({ color: ROSEWOOD, roughness: 0.4, metalness: 0.1 })
  const cushion = new THREE.MeshStandardMaterial({ color: LEATHER, roughness: 0.7 })
  const metal = new THREE.MeshStandardMaterial({ color: ALUMINUM, roughness: 0.35, metalness: 0.8 })

  g.add(pedestal(metal, 9))

  // seat shell + cushion (seat height 16", gentle backward rake)
  g.add(box(30, 2.2, 24, shell, 0, 14.6, 1, -0.1))
  g.add(box(26, 3.4, 21, cushion, 0, 17.2, 1.5, -0.1))

  // back shell + cushion, raked ~22°
  const rake = 0.38
  g.add(box(30, 16, 2.2, shell, 0, 22.5, 11.5, rake))
  g.add(box(26, 14, 3.4, cushion, 0, 22.5, 9.2, rake))
  // headrest, raked a touch more
  g.add(box(30, 10, 2.2, shell, 0, 30.5, 14.8, rake + 0.12))
  g.add(box(26, 8.5, 3.4, cushion, 0, 30.3, 12.6, rake + 0.12))

  // armrests
  for (const s of [-1, 1]) {
    g.add(box(4.5, 2.6, 15, cushion, s * 15.5, 20.5, 3))
  }
  return g
}

/** Eames ottoman: 26"W × 20.75"D × 17.25"H */
function eamesOttoman(): THREE.Group {
  const g = new THREE.Group()
  const shell = new THREE.MeshStandardMaterial({ color: ROSEWOOD, roughness: 0.4, metalness: 0.1 })
  const cushion = new THREE.MeshStandardMaterial({ color: LEATHER, roughness: 0.7 })
  const metal = new THREE.MeshStandardMaterial({ color: ALUMINUM, roughness: 0.35, metalness: 0.8 })
  g.add(pedestal(metal, 6))
  g.add(box(24, 2, 19, shell, 0, 12.2, 0))
  g.add(box(26, 4, 20.75, cushion, 0, 15.2, 0))
  return g
}

/** Noguchi coffee table: 50" × 36" freeform glass top, 15.75" tall, ¾" glass,
 *  on two interlocked curved wood legs. */
function noguchiTable(): THREE.Group {
  const g = new THREE.Group()

  const glassPts = outline('blob', 50, 36)
  const glassShape = new THREE.Shape(glassPts.map((p) => new THREE.Vector2(p.x, p.y)))
  const glassGeo = new THREE.ExtrudeGeometry(glassShape, { depth: 0.75, bevelEnabled: false, curveSegments: 24 })
  const glass = new THREE.Mesh(
    glassGeo,
    new THREE.MeshPhysicalMaterial({
      color: '#aac4b2',
      transparent: true,
      opacity: 0.32,
      roughness: 0.08,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
  )
  glass.rotation.x = -Math.PI / 2
  glass.position.y = 15.0 // after the rotation the ¾" extrusion grows upward, topping out at 15.75
  glass.castShadow = false
  g.add(glass)

  // two matching curved legs (petal slabs), one inverted against the other
  const wood = new THREE.MeshStandardMaterial({ color: WALNUT, roughness: 0.45 })
  const legPts = outline('petal', 9, 13)
  const legShape = new THREE.Shape(legPts.map((p) => new THREE.Vector2(p.x, p.y)))
  const legGeo = new THREE.ExtrudeGeometry(legShape, { depth: 1.8, bevelEnabled: false, curveSegments: 16 })
  legGeo.center()

  const legA = new THREE.Mesh(legGeo, wood)
  legA.position.set(-5, 6.6, 0)
  legA.rotation.z = 0.3
  legA.castShadow = true
  g.add(legA)

  const legB = new THREE.Mesh(legGeo, wood)
  legB.position.set(5, 6.6, 0)
  legB.rotation.z = Math.PI - 0.3
  legB.rotation.y = 0.25
  legB.castShadow = true
  g.add(legB)

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
    const joint = ((i * 197) % 512)
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
  const chair = eamesChair()
  chair.position.set(-62, FLOOR_Y, -32)
  chair.rotation.y = 0.55 + Math.PI
  group.add(chair)

  const ottoman = eamesOttoman()
  ottoman.position.set(-37, FLOOR_Y, -10)
  ottoman.rotation.y = 0.55 + Math.PI
  group.add(ottoman)

  const table = noguchiTable()
  table.position.set(16, FLOOR_Y, 18)
  table.rotation.y = -0.35
  group.add(table)

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
      for (const d of disposables) d.dispose()
    },
  }
}
