import type { ArmNode, MobileDoc, ShapeNode } from './types'
import { isArm, isFlat, labelNodes, walk } from './types'
import { LOOP_ALLOWANCE_IN, WIRES, WOODS, flatGrooveLen } from './materials'
import { armLoads, armTiltRad, computePose, shapeWeightOz, totalHangingWeightOz } from './balance'

export interface PlanShape {
  node: ShapeNode
  label: string
  weightOz: number
  /** lies flat on the wire: template gets a groove line instead of a drill hole */
  flat: boolean
  grooveLenIn: number
}

export interface PlanArmWire {
  node: ArmNode
  label: string
  /** total wire to cut for this arm, including loop and groove allowances */
  cutLenIn: number
  /** where to bend the pivot loop, measured from the finished left end loop */
  balanceFromLeftIn: number
  tiltDeg: number
  /** labels of what hangs on each end */
  leftChildLabel: string
  rightChildLabel: string
  /** flat-mounted piece on this end (no loop — the wire runs under it) */
  leftFlat: boolean
  rightFlat: boolean
  loadOz: number
}

export interface PlanDropWire {
  /** e.g. "Arm B → Shape 3 (left end)" */
  purpose: string
  wireLabel: string
  wireKey: string
  lengthIn: number
  cutLenIn: number
}

export interface Plan {
  doc: MobileDoc
  labels: Map<string, string>
  shapes: PlanShape[]
  arms: PlanArmWire[]
  drops: PlanDropWire[]
  /** deepest-first: the order to actually build them */
  buildOrder: PlanArmWire[]
  totals: {
    weightOz: number
    widthIn: number
    heightIn: number
    wireTotalsByKind: { label: string; totalIn: number }[]
    woodTotals: { label: string; areaIn2: number }[]
  }
}

export function buildPlan(doc: MobileDoc): Plan {
  const labels = labelNodes(doc.root)
  const shapes: PlanShape[] = []
  const arms: PlanArmWire[] = []
  const drops: PlanDropWire[] = []
  const armDepth = new Map<string, number>()

  const depthOf = (id: string): number => armDepth.get(id) ?? 0
  // compute depths
  const walkDepth = (n: typeof doc.root, d: number): void => {
    if (isArm(n)) {
      armDepth.set(n.id, d)
      walkDepth(n.left, d + 1)
      walkDepth(n.right, d + 1)
    }
  }
  walkDepth(doc.root, 0)

  walk(doc.root, (n) => {
    if (n.kind === 'shape') {
      shapes.push({
        node: n,
        label: labels.get(n.id) ?? '?',
        weightOz: shapeWeightOz(n),
        flat: isFlat(n),
        grooveLenIn: flatGrooveLen(n.width),
      })
      return
    }
    const loads = armLoads(n)
    const leftFlat = isFlat(n.left)
    const rightFlat = isFlat(n.right)
    // each hanging end gets a loop; each flat end gets the groove run under
    // the piece plus a short tail; the pivot loop is bent from the same piece
    const endAllowance = (flat: boolean, child: typeof n.left) =>
      flat && child.kind === 'shape' ? flatGrooveLen(child.width) + 0.25 : LOOP_ALLOWANCE_IN
    arms.push({
      node: n,
      label: labels.get(n.id) ?? '?',
      cutLenIn: n.length + endAllowance(leftFlat, n.left) + endAllowance(rightFlat, n.right) + LOOP_ALLOWANCE_IN,
      balanceFromLeftIn: n.pivot,
      tiltDeg: (armTiltRad(n) * 180) / Math.PI,
      leftChildLabel: labels.get(n.left.id) ?? '?',
      rightChildLabel: labels.get(n.right.id) ?? '?',
      leftFlat,
      rightFlat,
      loadOz: loads.Wtot,
    })
    const mkDrop = (side: 'left' | 'right', len: number, childId: string) => {
      drops.push({
        purpose: `${labels.get(n.id)} ${side} end → ${labels.get(childId)}`,
        wireLabel: WIRES[n.wire].label,
        wireKey: n.wire,
        lengthIn: len,
        cutLenIn: len + 2 * LOOP_ALLOWANCE_IN,
      })
    }
    if (!leftFlat) mkDrop('left', n.dropLeft, n.left.id)
    if (!rightFlat) mkDrop('right', n.dropRight, n.right.id)
  })

  // hanger wire from ceiling to the top pivot
  const rootWire = isArm(doc.root) ? doc.root.wire : 'steel16'
  drops.unshift({
    purpose: 'Ceiling hook → top of mobile',
    wireLabel: WIRES[rootWire].label,
    wireKey: rootWire,
    lengthIn: doc.hangerDrop,
    cutLenIn: doc.hangerDrop + 2 * LOOP_ALLOWANCE_IN,
  })

  const buildOrder = [...arms].sort((a, b) => depthOf(b.node.id) - depthOf(a.node.id))

  // totals
  const wireTotals = new Map<string, number>()
  for (const a of arms) {
    wireTotals.set(a.node.wire, (wireTotals.get(a.node.wire) ?? 0) + a.cutLenIn)
  }
  for (const d of drops) {
    wireTotals.set(d.wireKey, (wireTotals.get(d.wireKey) ?? 0) + d.cutLenIn)
  }
  const woodTotals = new Map<string, number>()
  for (const s of shapes) {
    const key = `${WOODS[s.node.wood].label}, ${fmtThickness(s.node.thickness)}`
    // bounding box + 1/2" margin all around for layout & saw kerf
    const blank = (s.node.width + 1) * (s.node.height + 1)
    woodTotals.set(key, (woodTotals.get(key) ?? 0) + blank)
  }

  const pose = computePose(doc)

  return {
    doc,
    labels,
    shapes,
    arms,
    drops,
    buildOrder,
    totals: {
      weightOz: totalHangingWeightOz(doc),
      widthIn: Math.max(pose.max.x - pose.min.x, pose.max.z - pose.min.z),
      heightIn: pose.max.y - pose.min.y + doc.hangerDrop,
      wireTotalsByKind: [...wireTotals.entries()].map(([k, totalIn]) => ({
        label: WIRES[k as keyof typeof WIRES].label,
        totalIn,
      })),
      woodTotals: [...woodTotals.entries()].map(([label, areaIn2]) => ({ label, areaIn2 })),
    },
  }
}

function fmtThickness(t: number): string {
  const map: Record<number, string> = { 0.125: '1/8"', 0.1875: '3/16"', 0.25: '1/4"', 0.375: '3/8"', 0.5: '1/2"' }
  return map[t] ?? `${t}"`
}
