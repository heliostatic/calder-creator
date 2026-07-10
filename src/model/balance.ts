import type { ArmNode, MobileDoc, MobileNode } from './types'
import { isFlat, mapTree } from './types'
import { LOOP_ALLOWANCE_IN, WIRES, WOODS, flatGrooveLen } from './materials'
import { centroid, holePos, shapeArea } from './shapes'

export interface V3 {
  x: number
  y: number
  z: number
}

/** Weight of a single cut shape, ounces. */
export function shapeWeightOz(n: Extract<MobileNode, { kind: 'shape' }>): number {
  return shapeArea(n.shape, n.width, n.height) * n.thickness * WOODS[n.wood].densityOzIn3
}

/** One piece of mass rigidly attached to an arm: its wire run, its bent
 *  loops, and any flat-mounted shapes. THE single source of truth for what
 *  an arm weighs and where — the balance math and the physics simulation
 *  both build from this inventory, so they can never disagree. */
export interface ArmMassPart {
  W: number
  /** inches from the left end loop, along the arm (may extend past the ends) */
  x: number
  /** above (+) / below (−) the hang line */
  y: number
  side: 'left' | 'right' | null
  /** true for the arm's own pivot loop, which rides AT the pivot */
  pivotLoop?: boolean
  /** present when this part is a flat-mounted shape */
  flatShape?: Extract<MobileNode, { kind: 'shape' }>
}

export function armMassInventory(arm: ArmNode): ArmMassPart[] {
  const w = WIRES[arm.wire].ozPerIn
  const parts: ArmMassPart[] = [
    { W: w * arm.length, x: arm.length / 2, y: 0, side: null },
    { W: w * LOOP_ALLOWANCE_IN, x: arm.pivot, y: arm.pivotHeight, side: null, pivotLoop: true },
  ]
  for (const side of ['left', 'right'] as const) {
    const child = side === 'left' ? arm.left : arm.right
    const drop = side === 'left' ? arm.dropLeft : arm.dropRight
    const end = side === 'left' ? 0 : arm.length
    const dir = side === 'left' ? -1 : 1
    if (isFlat(child) && child.kind === 'shape') {
      // groove run + tail of arm wire under the piece, then the piece itself,
      // its near edge at the end, local +x outward, weight at the centroid
      const groove = flatGrooveLen(child.width) + 0.25
      const c = centroid(child.shape, child.width, child.height)
      parts.push({ W: w * groove, x: end + (dir * groove) / 2, y: 0, side })
      parts.push({
        W: shapeWeightOz(child),
        x: end + dir * (child.width / 2 + c.x),
        y: 0.12 + child.thickness / 2,
        side,
        flatShape: child,
      })
    } else {
      // arm end loop + drop wire with its two loops, all hanging at the end
      parts.push({ W: w * (drop + 3 * LOOP_ALLOWANCE_IN), x: end, y: -drop / 2, side })
    }
  }
  return parts
}

/** Weight of an entire subtree including its wire — every inch of it, loops
 *  included, so the number matches what the shop scale would say.
 *  (What the wire above this node has to carry.) */
export function subtreeWeightOz(node: MobileNode): number {
  if (node.kind === 'shape') return shapeWeightOz(node)
  let sum = armMassInventory(node).reduce((s, p) => s + p.W, 0)
  for (const side of ['left', 'right'] as const) {
    const child = side === 'left' ? node.left : node.right
    if (!isFlat(child)) sum += subtreeWeightOz(child)
  }
  return sum
}

/** Everything carried past one end of an arm. */
function sideWeightOz(arm: ArmNode, side: 'left' | 'right'): number {
  const child = side === 'left' ? arm.left : arm.right
  let sum = armMassInventory(arm)
    .filter((p) => p.side === side)
    .reduce((s, p) => s + p.W, 0)
  if (!isFlat(child)) sum += subtreeWeightOz(child)
  return sum
}

/** Everything a ceiling hook carries: the mobile plus its hanger wire. */
export function totalHangingWeightOz(doc: MobileDoc): number {
  const rootWire = doc.root.kind === 'arm' ? doc.root.wire : 'steel16'
  return subtreeWeightOz(doc.root) + WIRES[rootWire].ozPerIn * (doc.hangerDrop + 2 * LOOP_ALLOWANCE_IN)
}

/** A weight and where it acts along the arm (inches from the left end loop —
 *  flat-mounted pieces act BEYOND the ends, which lengthens their lever). */
export interface ArmPointLoad {
  W: number
  x: number
}

/** All the loads an arm carries, as (weight, position) pairs: its own mass
 *  inventory plus the subtrees hanging from its ends. */
export function armPointLoads(arm: ArmNode): ArmPointLoad[] {
  return pointLoads(arm, true)
}

function pointLoads(arm: ArmNode, includePivotLoop: boolean): ArmPointLoad[] {
  const loads: ArmPointLoad[] = []
  for (const p of armMassInventory(arm)) {
    if (p.pivotLoop && !includePivotLoop) continue
    loads.push({ W: p.W, x: p.x })
  }
  for (const side of ['left', 'right'] as const) {
    const child = side === 'left' ? arm.left : arm.right
    if (!isFlat(child)) loads.push({ W: subtreeWeightOz(child), x: side === 'left' ? 0 : arm.length })
  }
  return loads
}

export interface ArmLoads {
  /** carried past the left end: drop wire + subtree, or the flat piece */
  WL: number
  WR: number
  /** the arm wire itself */
  Warm: number
  Wtot: number
}

export function armLoads(arm: ArmNode): ArmLoads {
  const WL = sideWeightOz(arm, 'left')
  const WR = sideWeightOz(arm, 'right')
  const Warm = WIRES[arm.wire].ozPerIn * arm.length
  return { WL, WR, Warm, Wtot: WL + WR + Warm }
}

/** Pivot position (inches from the left end loop) that makes the arm hang
 *  level: the weighted centroid of all its point loads. The pivot loop
 *  itself is excluded — it rides at the pivot wherever that lands, so it
 *  cancels out of both sides of the equation. */
export function balancedPivot(arm: ArmNode): number {
  const loads = pointLoads(arm, false)
  const Wtot = loads.reduce((s, l) => s + l.W, 0)
  if (Wtot <= 0) return arm.length / 2
  return loads.reduce((s, l) => s + l.W * l.x, 0) / Wtot
}

/** Net moment about a candidate pivot (oz·in), pivot loop excluded — zero
 *  exactly at balancedPivot(). Used by the validator and tests. */
export function balanceResidualOzIn(arm: ArmNode, pivot: number): number {
  return pointLoads(arm, false).reduce((s, l) => s + l.W * (pivot - l.x), 0)
}

/** Equilibrium tilt of the arm, radians. Positive = left end hangs lower.
 *
 *  Torque balance about the pivot loop, which sits `pivotHeight` above the
 *  line between the end loops: tan θ = ΣWᵢ(p − xᵢ) / (h · ΣWᵢ)
 */
export function armTiltRad(arm: ArmNode): number {
  const loads = armPointLoads(arm)
  const Wtot = loads.reduce((s, l) => s + l.W, 0)
  const M = loads.reduce((s, l) => s + l.W * (arm.pivot - l.x), 0)
  const h = Math.max(arm.pivotHeight, 0.01)
  return Math.atan2(M, h * Math.max(Wtot, 1e-9))
}

/** Return a copy of the doc with every arm's pivot moved to its balance point. */
export function balanceAll(doc: MobileDoc): MobileDoc {
  const root = mapTree(doc.root, (n) => {
    if (n.kind === 'arm') {
      const p = balancedPivot(n)
      return { ...n, pivot: Math.round(p * 100) / 100 }
    }
    return n
  })
  return { ...doc, root }
}

// ---------------------------------------------------------------------------
// Static pose: where every piece sits when the mobile hangs at rest.
// World frame: ceiling hook at origin, y up (so everything hangs at y < 0).
// ---------------------------------------------------------------------------

export interface ArmPose {
  kind: 'arm'
  /** world position of the pivot loop */
  pivotW: V3
  leftEndW: V3
  rightEndW: V3
  tiltRad: number
  yawRad: number
}

export interface ShapePose {
  kind: 'shape'
  /** world position of the drilled hole (hanging) or the arm end (flat) */
  holeW: V3
  centerW: V3
  yawRad: number
  /** present when the piece lies flat, rigid with its arm: the arm's yaw and
   *  tilt plus which way the piece points (+1 = along the arm's +x) */
  flat?: { armYaw: number; armTilt: number; dir: 1 | -1 }
}

export interface Pose {
  arms: Map<string, ArmPose>
  shapes: Map<string, ShapePose>
  min: V3
  max: V3
}

function v3(x: number, y: number, z: number): V3 {
  return { x, y, z }
}

/** Footprint of one placed shape, used to keep pieces from overlapping. */
interface Placed {
  x: number
  y: number
  z: number
  r: number
  halfH: number
}

interface ArmFrame {
  leftEndW: V3
  rightEndW: V3
  tilt: number
  toWorld: (lx: number, ly: number) => V3
}

function armFrame(node: ArmNode, hangW: V3, yaw: number): ArmFrame {
  const tilt = armTiltRad(node)
  const cosT = Math.cos(tilt)
  const sinT = Math.sin(tilt)
  // local arm frame: x along arm (left → right), pivot at (p, h) rel left end.
  // tilt > 0 lowers the left end. yaw rotates about the vertical axis.
  const toWorld = (lx: number, ly: number): V3 => {
    const u = lx - node.pivot
    const vv = ly - node.pivotHeight
    const dAlong = u * cosT - vv * sinT
    const dy = u * sinT + vv * cosT
    return v3(hangW.x + dAlong * Math.cos(yaw), hangW.y + dy, hangW.z - dAlong * Math.sin(yaw))
  }
  return { leftEndW: toWorld(0, 0), rightEndW: toWorld(node.length, 0), tilt, toWorld }
}

/** Where a flat-mounted piece's bbox center sits, in its arm's frame:
 *  near edge at the end loop position, resting just on top of the wire. */
function flatCenterLocal(arm: ArmNode, child: Extract<MobileNode, { kind: 'shape' }>, side: 'left' | 'right'): { lx: number; ly: number } {
  const end = side === 'left' ? 0 : arm.length
  const dir = side === 'left' ? -1 : 1
  return { lx: end + (dir * child.width) / 2, ly: 0.12 + child.thickness / 2 }
}

function shapeFootprint(node: Extract<MobileNode, { kind: 'shape' }>, hangW: V3, yaw: number): { centerW: V3; placed: Placed } {
  const hole = holePos(node.shape, node.width, node.height)
  // shape hangs plumb from its hole; center offset rotated by its yaw
  const centerW = v3(hangW.x - hole.x * Math.cos(yaw), hangW.y - hole.y, hangW.z + hole.x * Math.sin(yaw))
  return {
    centerW,
    placed: { x: centerW.x, y: centerW.y, z: centerW.z, r: Math.max(node.width, node.height) / 2, halfH: node.height / 2 },
  }
}

/** How badly a tentative set of shapes collides with what's already placed. */
function overlapPenalty(placed: Placed[], candidate: Placed[]): number {
  let pen = 0
  for (const c of candidate) {
    for (const p of placed) {
      if (Math.abs(c.y - p.y) > c.halfH + p.halfH + 0.75) continue
      const d = Math.hypot(c.x - p.x, c.z - p.z)
      const gap = c.r + p.r + 1.0 - d
      if (gap > 0) pen += gap * gap
    }
  }
  return pen
}

/** Collect the shape footprints of a whole subtree using the default yaw rule
 *  (no optimization) — used to score candidate rotations cheaply. */
function collectFootprints(node: MobileNode, hangW: V3, yaw: number, depth: number, out: Placed[]): void {
  if (node.kind === 'shape') {
    out.push(shapeFootprint(node, hangW, yaw).placed)
    return
  }
  const frame = armFrame(node, hangW, yaw)
  const spread = 0.95 - depth * 0.12
  for (const side of ['left', 'right'] as const) {
    const child = side === 'left' ? node.left : node.right
    const drop = side === 'left' ? node.dropLeft : node.dropRight
    const endW = side === 'left' ? frame.leftEndW : frame.rightEndW
    if (isFlat(child) && child.kind === 'shape') {
      const { lx, ly } = flatCenterLocal(node, child, side)
      const c = frame.toWorld(lx, ly)
      out.push({ x: c.x, y: c.y, z: c.z, r: Math.max(child.width, child.height) / 2, halfH: 0.6 })
    } else {
      const hang = v3(endW.x, endW.y - drop, endW.z)
      collectFootprints(child, hang, yaw + (side === 'left' ? spread : -spread), depth + 1, out)
    }
  }
}

const YAW_CANDIDATES = [0, 0.45, -0.45, 0.9, -0.9, 1.35, -1.35, Math.PI / 2]

export function computePose(doc: MobileDoc): Pose {
  const pose: Pose = {
    arms: new Map(),
    shapes: new Map(),
    min: v3(Infinity, Infinity, Infinity),
    max: v3(-Infinity, -Infinity, -Infinity),
  }
  const placed: Placed[] = []

  const grow = (p: V3, r = 0) => {
    pose.min.x = Math.min(pose.min.x, p.x - r)
    pose.min.y = Math.min(pose.min.y, p.y - r)
    pose.min.z = Math.min(pose.min.z, p.z - r)
    pose.max.x = Math.max(pose.max.x, p.x + r)
    pose.max.y = Math.max(pose.max.y, p.y + r)
    pose.max.z = Math.max(pose.max.z, p.z + r)
  }
  grow(v3(0, 0, 0))

  /** Pick the subtree rotation that overlaps least with everything placed so
   *  far. Ties (e.g. an empty scene) go to the default aesthetic spread, and
   *  arms edge-on to the default camera are lightly penalized. */
  const bestYaw = (node: MobileNode, hangW: V3, preferred: number, depth: number): number => {
    if (node.kind === 'shape' && Math.abs(holePos(node.shape, node.width, node.height).x) < 0.2) return preferred
    let best = preferred
    let bestScore = Infinity
    for (const offset of YAW_CANDIDATES) {
      const yaw = preferred + offset
      const tentative: Placed[] = []
      collectFootprints(node, hangW, yaw, depth, tentative)
      let score = overlapPenalty(placed, tentative)
      score += 0.12 * Math.abs(offset) // prefer the natural spread
      if (node.kind === 'arm') score += 0.6 * Math.pow(Math.abs(Math.sin(yaw)), 4) // avoid edge-on arms
      if (score < bestScore - 1e-6) {
        bestScore = score
        best = yaw
      }
    }
    return best
  }

  const place = (node: MobileNode, hangW: V3, yaw: number, depth: number): void => {
    if (node.kind === 'shape') {
      const { centerW, placed: fp } = shapeFootprint(node, hangW, yaw)
      pose.shapes.set(node.id, { kind: 'shape', holeW: hangW, centerW, yawRad: yaw })
      placed.push(fp)
      grow(centerW, Math.max(node.width, node.height) / 2)
      return
    }

    const frame = armFrame(node, hangW, yaw)
    pose.arms.set(node.id, {
      kind: 'arm',
      pivotW: hangW,
      leftEndW: frame.leftEndW,
      rightEndW: frame.rightEndW,
      tiltRad: frame.tilt,
      yawRad: yaw,
    })
    grow(frame.leftEndW)
    grow(frame.rightEndW)

    // flat pieces ride rigidly on the arm; hanging children get drop wires
    const spread = 0.95 - depth * 0.12
    for (const side of ['left', 'right'] as const) {
      const child = side === 'left' ? node.left : node.right
      const drop = side === 'left' ? node.dropLeft : node.dropRight
      const endW = side === 'left' ? frame.leftEndW : frame.rightEndW
      if (isFlat(child) && child.kind === 'shape') {
        const dir = side === 'left' ? (-1 as const) : (1 as const)
        const { lx, ly } = flatCenterLocal(node, child, side)
        const centerW = frame.toWorld(lx, ly)
        pose.shapes.set(child.id, {
          kind: 'shape',
          holeW: endW,
          centerW,
          yawRad: yaw,
          flat: { armYaw: yaw, armTilt: frame.tilt, dir },
        })
        placed.push({ x: centerW.x, y: centerW.y, z: centerW.z, r: Math.max(child.width, child.height) / 2, halfH: 0.6 })
        grow(centerW, Math.max(child.width, child.height) / 2)
      } else {
        const hang = v3(endW.x, endW.y - drop, endW.z)
        const childYaw = bestYaw(child, hang, yaw + (side === 'left' ? spread : -spread), depth + 1)
        place(child, hang, childYaw, depth + 1)
      }
    }
  }

  const rootHang = v3(0, -doc.hangerDrop, 0)
  place(doc.root, rootHang, bestYaw(doc.root, rootHang, 0.35, 0), 0)
  return pose
}
