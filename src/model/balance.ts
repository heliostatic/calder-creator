import type { ArmNode, MobileDoc, MobileNode } from './types'
import { mapTree } from './types'
import { WIRES, WOODS } from './materials'
import { holePos, shapeArea } from './shapes'

export interface V3 {
  x: number
  y: number
  z: number
}

/** Weight of a single cut shape, ounces. */
export function shapeWeightOz(n: Extract<MobileNode, { kind: 'shape' }>): number {
  return shapeArea(n.shape, n.width, n.height) * n.thickness * WOODS[n.wood].densityOzIn3
}

/** Weight of an entire subtree including its wire, ounces.
 *  (What a drop wire above this node has to carry.) */
export function subtreeWeightOz(node: MobileNode): number {
  if (node.kind === 'shape') return shapeWeightOz(node)
  const w = WIRES[node.wire].ozPerIn
  return (
    w * node.length +
    w * node.dropLeft + subtreeWeightOz(node.left) +
    w * node.dropRight + subtreeWeightOz(node.right)
  )
}

export interface ArmLoads {
  /** hanging on the left end loop: left drop wire + left subtree */
  WL: number
  WR: number
  /** the arm wire itself */
  Warm: number
  Wtot: number
}

export function armLoads(arm: ArmNode): ArmLoads {
  const w = WIRES[arm.wire].ozPerIn
  const WL = w * arm.dropLeft + subtreeWeightOz(arm.left)
  const WR = w * arm.dropRight + subtreeWeightOz(arm.right)
  const Warm = w * arm.length
  return { WL, WR, Warm, Wtot: WL + WR + Warm }
}

/** Pivot position (inches from the left end loop) that makes the arm hang level. */
export function balancedPivot(arm: ArmNode): number {
  const { WL, WR, Warm, Wtot } = armLoads(arm)
  if (Wtot <= 0) return arm.length / 2
  return (WR * arm.length + Warm * (arm.length / 2)) / (WL + WR + Warm)
}

/** Equilibrium tilt of the arm, radians. Positive = left end hangs lower.
 *
 *  Torque balance about the pivot loop, which sits `pivotHeight` above the
 *  line between the end loops: tan θ = ΣWᵢ(p − xᵢ) / (h · ΣWᵢ)
 */
export function armTiltRad(arm: ArmNode): number {
  const { WL, WR, Warm, Wtot } = armLoads(arm)
  const M = WL * arm.pivot + Warm * (arm.pivot - arm.length / 2) - WR * (arm.length - arm.pivot)
  const h = Math.max(arm.pivotHeight, 0.01)
  return Math.atan2(M, h * Wtot)
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
  /** world position of the drilled hole */
  holeW: V3
  centerW: V3
  yawRad: number
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

function armEnds(node: ArmNode, hangW: V3, yaw: number): { leftEndW: V3; rightEndW: V3; tilt: number } {
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
  return { leftEndW: toWorld(0, 0), rightEndW: toWorld(node.length, 0), tilt }
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
  const { leftEndW, rightEndW } = armEnds(node, hangW, yaw)
  const spread = 0.95 - depth * 0.12
  collectFootprints(node.left, v3(leftEndW.x, leftEndW.y - node.dropLeft, leftEndW.z), yaw + spread, depth + 1, out)
  collectFootprints(node.right, v3(rightEndW.x, rightEndW.y - node.dropRight, rightEndW.z), yaw - spread, depth + 1, out)
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

    const { leftEndW, rightEndW, tilt } = armEnds(node, hangW, yaw)
    pose.arms.set(node.id, { kind: 'arm', pivotW: hangW, leftEndW, rightEndW, tiltRad: tilt, yawRad: yaw })
    grow(leftEndW)
    grow(rightEndW)

    // children hang plumb below the end loops on their drop wires
    const spread = 0.95 - depth * 0.12
    const leftHang = v3(leftEndW.x, leftEndW.y - node.dropLeft, leftEndW.z)
    place(node.left, leftHang, bestYaw(node.left, leftHang, yaw + spread, depth + 1), depth + 1)
    const rightHang = v3(rightEndW.x, rightEndW.y - node.dropRight, rightEndW.z)
    place(node.right, rightHang, bestYaw(node.right, rightHang, yaw - spread, depth + 1), depth + 1)
  }

  const rootHang = v3(0, -doc.hangerDrop, 0)
  place(doc.root, rootHang, bestYaw(doc.root, rootHang, 0.35, 0), 0)
  return pose
}
