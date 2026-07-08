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

export function computePose(doc: MobileDoc): Pose {
  const pose: Pose = {
    arms: new Map(),
    shapes: new Map(),
    min: v3(Infinity, Infinity, Infinity),
    max: v3(-Infinity, -Infinity, -Infinity),
  }

  const grow = (p: V3, r = 0) => {
    pose.min.x = Math.min(pose.min.x, p.x - r)
    pose.min.y = Math.min(pose.min.y, p.y - r)
    pose.min.z = Math.min(pose.min.z, p.z - r)
    pose.max.x = Math.max(pose.max.x, p.x + r)
    pose.max.y = Math.max(pose.max.y, p.y + r)
    pose.max.z = Math.max(pose.max.z, p.z + r)
  }
  grow(v3(0, 0, 0))

  const place = (node: MobileNode, hangW: V3, yaw: number, depth: number): void => {
    if (node.kind === 'shape') {
      const hole = holePos(node.shape, node.width, node.height)
      // shape hangs plumb from its hole; center offset rotated by its yaw
      const cx = -hole.x * Math.cos(yaw)
      const cz = hole.x * Math.sin(yaw)
      const centerW = v3(hangW.x + cx, hangW.y - hole.y, hangW.z + cz)
      pose.shapes.set(node.id, { kind: 'shape', holeW: hangW, centerW, yawRad: yaw })
      grow(centerW, Math.max(node.width, node.height) / 2)
      return
    }

    const tilt = armTiltRad(node)
    const cosT = Math.cos(tilt)
    const sinT = Math.sin(tilt)
    // local arm frame: x along arm (left → right), pivot at (p, h) rel left end.
    // tilt > 0 lowers the left end. yaw rotates about the vertical axis.
    const toWorld = (lx: number, ly: number): V3 => {
      const u = lx - node.pivot
      const vv = ly - node.pivotHeight
      // rotate by tilt in the vertical plane of the arm (θ>0 → left end down)
      const dAlong = u * cosT - vv * sinT
      const dy = u * sinT + vv * cosT
      return v3(
        hangW.x + dAlong * Math.cos(yaw),
        hangW.y + dy,
        hangW.z - dAlong * Math.sin(yaw),
      )
    }
    const leftEndW = toWorld(0, 0)
    const rightEndW = toWorld(node.length, 0)
    pose.arms.set(node.id, { kind: 'arm', pivotW: hangW, leftEndW, rightEndW, tiltRad: tilt, yawRad: yaw })
    grow(leftEndW)
    grow(rightEndW)

    // children hang plumb below the end loops on their drop wires
    const leftHang = v3(leftEndW.x, leftEndW.y - node.dropLeft, leftEndW.z)
    const rightHang = v3(rightEndW.x, rightEndW.y - node.dropRight, rightEndW.z)
    const spread = 0.95 - depth * 0.12
    place(node.left, leftHang, yaw + spread, depth + 1)
    place(node.right, rightHang, yaw - spread, depth + 1)
  }

  place(doc.root, v3(0, -doc.hangerDrop, 0), 0.35, 0)
  return pose
}
