import type { ArmNode, MobileDoc, MobileNode } from './types'
import { isFlat, labelNodes, walk } from './types'
import { THICKNESSES, WIRE_LOAD_LIMIT_OZ, flatGrooveLen } from './materials'
import { armLoads, armTiltRad, balanceResidualOzIn, balancedPivot, computePose, shapeWeightOz, totalHangingWeightOz } from './balance'
import { holePos, materialClearance } from './shapes'
import { buildPlan } from './plan'
import { WIRES } from './materials'

function WIRE_OZ_PER_IN(key: string): number {
  return WIRES[key as keyof typeof WIRES].ozPerIn
}

/** One problem found in a design. `error` means "this can't be built as
 *  drawn"; `warning` means "buildable, but your dad will curse at it". */
export interface BuildIssue {
  level: 'error' | 'warning'
  where: string
  message: string
}

/** The rules a mobile must satisfy to be buildable in a home shop, distilled
 *  from mobile-making guides (e.g. marcomahler.com's Calder-mobile resources)
 *  and the constraints of wire, plywood and round-nose pliers. Used by the
 *  test suite as the acceptance gate for templates and the generator. */
export function validateBuildable(doc: MobileDoc): BuildIssue[] {
  const issues: BuildIssue[] = []
  const labels = labelNodes(doc.root)
  const err = (where: string, message: string) => issues.push({ level: 'error', where, message })
  const warn = (where: string, message: string) => issues.push({ level: 'warning', where, message })

  const ids = new Set<string>()
  walk(doc.root, (n, parent) => {
    const label = labels.get(n.id) ?? n.id
    if (ids.has(n.id)) err(label, 'duplicate node id')
    ids.add(n.id)

    if (n.kind === 'shape') {
      // pieces must be big enough to cut and drill/groove, small enough to print
      if (n.width < 0.75 || n.height < 0.75) err(label, `too small to cut safely (${n.width}" × ${n.height}")`)
      if (n.width > 10 || n.height > 10) warn(label, `larger than one printable template page (${n.width}" × ${n.height}")`)
      if (!THICKNESSES.some((t) => Math.abs(t.value - n.thickness) < 1e-6)) err(label, `nonstandard stock thickness ${n.thickness}"`)
      if (shapeWeightOz(n) <= 0) err(label, 'zero or negative weight')

      if (isFlat(n)) {
        if (!parent) err(label, 'a flat piece cannot be the whole mobile — it needs an arm to ride on')
        if (n.thickness < 0.2) warn(label, 'flat pieces groove more safely in 1/4" or thicker stock')
        if (flatGrooveLen(n.width) < 0.75) warn(label, 'very short groove — the piece may not sit firmly on the wire')
      } else {
        // the hanging hole needs a safe ring of material around it
        const hole = holePos(n.shape, n.width, n.height)
        const clear = materialClearance(n.shape, n.width, n.height, hole.x, hole.y)
        if (clear < 0.08) err(label, `hanging hole has only ${clear.toFixed(2)}" of material around it`)
        else if (clear < 0.15) warn(label, 'hanging hole is close to the edge — drill carefully')
      }
      return
    }

    // arms
    if (n.length < 3) err(label, `arm too short to work with (${n.length}")`)
    if (n.pivotHeight <= 0.1) err(label, 'pivot loop must sit above the wire for the arm to hang stably')
    for (const side of ['left', 'right'] as const) {
      const child = side === 'left' ? n.left : n.right
      const drop = side === 'left' ? n.dropLeft : n.dropRight
      if (!isFlat(child) && drop < 0.4) err(label, `${side} drop wire too short to form loops (${drop}")`)
    }

    // the balance point must land where a loop can physically be bent:
    // clear of the end loops (hanging) or the groove run (flat)
    const p = balancedPivot(n)
    const leftMargin = isFlat(n.left) ? 0.4 : 0.6
    const rightMargin = isFlat(n.right) ? 0.4 : 0.6
    if (p < leftMargin || p > n.length - rightMargin) {
      err(
        label,
        `balance point (${p.toFixed(2)}" from left) is too close to the end to bend the hanging loop — ` +
          'lengthen the arm or lighten the heavy side',
      )
    }

    // torque identity: at the computed balance point, moments must cancel
    const residual = balanceResidualOzIn(n, p)
    if (Math.abs(residual) > 1e-6) err(label, `balance math broke: residual moment ${residual}`)

    // with auto-balance on, the stored pivot should actually hang level
    if (doc.autoBalance) {
      const tiltDeg = Math.abs((armTiltRad(n) * 180) / Math.PI)
      if (tiltDeg > 1.5) err(label, `auto-balance left a ${tiltDeg.toFixed(1)}° tilt`)
    }

    // wire must carry its load
    const limit = WIRE_LOAD_LIMIT_OZ[n.wire]
    const carried = armLoads(n).Wtot
    if (carried > limit) warn(label, `${carried.toFixed(1)} oz on wire rated ~${limit} oz — step up a gauge`)
  })

  // the plan and the physics must agree on total weight EXACTLY: every inch
  // of wire on the cut list plus every shape must equal the displayed weight
  const totalOz = totalHangingWeightOz(doc)
  if (!isFinite(totalOz) || totalOz <= 0) err('mobile', 'total weight is not a positive number')
  const plan = buildPlan(doc)
  const planShapesOz = plan.shapes.reduce((s, x) => s + x.weightOz, 0)
  const planWireOz =
    plan.arms.reduce((s, a) => s + a.cutLenIn * WIRE_OZ_PER_IN(a.node.wire), 0) +
    plan.drops.reduce((s, d) => s + d.cutLenIn * WIRE_OZ_PER_IN(d.wireKey), 0)
  if (Math.abs(planShapesOz + planWireOz - totalOz) > 1e-6) {
    err(
      'plans',
      `cut list weight (${(planShapesOz + planWireOz).toFixed(3)} oz) disagrees with displayed weight (${totalOz.toFixed(3)} oz)`,
    )
  }
  const shapesOz = collectShapesOz(doc.root)
  if (Math.abs(planShapesOz - shapesOz) > 0.01) {
    err('plans', `cut list shapes (${planShapesOz.toFixed(2)} oz) disagree with model shapes (${shapesOz.toFixed(2)} oz)`)
  }
  for (const a of plan.arms) {
    if (a.cutLenIn < a.node.length) err(a.label, 'cut length shorter than the finished arm')
  }
  for (const d of plan.drops) {
    if (d.cutLenIn <= 0 || d.lengthIn < 0) err('plans', `bad drop wire length: ${d.purpose}`)
  }

  // ovals that match their width are circles wearing a costume — the plans
  // would print two identical templates with different names
  walk(doc.root, (n) => {
    if (n.kind === 'shape' && n.shape === 'oval' && Math.abs(n.width - n.height) < 0.2) {
      warn(labels.get(n.id) ?? n.id, 'oval is the same width and height — it will cut identical to a circle')
    }
  })

  // rest pose must be computable and finite
  const pose = computePose(doc)
  if (![pose.min.x, pose.min.y, pose.max.x, pose.max.y].every(isFinite)) err('mobile', 'rest pose has non-finite positions')

  return issues
}

function collectShapesOz(root: MobileNode): number {
  let sum = 0
  walk(root, (n) => {
    if (n.kind === 'shape') sum += shapeWeightOz(n)
  })
  return sum
}

export function errorsOf(issues: BuildIssue[]): BuildIssue[] {
  return issues.filter((i) => i.level === 'error')
}

// re-exported so tests can construct scenarios around arms
export type { ArmNode }
