// Core data model. All lengths are in inches, all weights in ounces.

export type ShapeKind = 'circle' | 'oval' | 'petal' | 'crescent' | 'triangle' | 'blob'

export type WoodKey = 'balticBirch' | 'basswood' | 'walnut' | 'maple' | 'cherry'

export type WireKey = 'steel16' | 'steel332' | 'steel18' | 'brass16' | 'brass332'

export interface ShapeNode {
  kind: 'shape'
  id: string
  shape: ShapeKind
  /** bounding-box width of the cut piece, inches */
  width: number
  /** bounding-box height of the cut piece, inches */
  height: number
  wood: WoodKey
  /** stock thickness, inches */
  thickness: number
  /** paint color, hex */
  color: string
  /** how the piece attaches to its arm: hanging from a drop wire (default),
   *  or lying flat, riveted horizontally on the wire itself — the Calder
   *  "floating disc" style. Absent means hanging (older saved files). */
  mount?: 'hanging' | 'flat'
}

export function isFlat(n: MobileNode): boolean {
  return n.kind === 'shape' && n.mount === 'flat'
}

export interface ArmNode {
  kind: 'arm'
  id: string
  /** straight-line distance between the two end loops, inches */
  length: number
  /** distance of the hanging (pivot) loop from the LEFT end loop, inches */
  pivot: number
  /** how far the pivot loop sits above the line between the end loops, inches.
   *  This vertical offset is what makes a mobile arm hang stably. */
  pivotHeight: number
  wire: WireKey
  /** length of the vertical drop wire hanging from the left end, inches */
  dropLeft: number
  /** length of the vertical drop wire hanging from the right end, inches */
  dropRight: number
  left: MobileNode
  right: MobileNode
}

export type MobileNode = ArmNode | ShapeNode

export interface MobileDoc {
  version: 1
  name: string
  /** wire from the ceiling hook down to the top arm's pivot loop, inches */
  hangerDrop: number
  /** when true, every arm's pivot is recomputed to hang level after each edit */
  autoBalance: boolean
  root: MobileNode
}

let idCounter = 0
export function newId(): string {
  idCounter += 1
  return `n${Date.now().toString(36)}${idCounter.toString(36)}`
}

export function isArm(n: MobileNode): n is ArmNode {
  return n.kind === 'arm'
}

/** Depth-first walk, parents before children. */
export function walk(node: MobileNode, fn: (n: MobileNode, parent: ArmNode | null) => void, parent: ArmNode | null = null): void {
  fn(node, parent)
  if (node.kind === 'arm') {
    walk(node.left, fn, node)
    walk(node.right, fn, node)
  }
}

export function findNode(root: MobileNode, id: string): MobileNode | null {
  let found: MobileNode | null = null
  walk(root, (n) => {
    if (n.id === id) found = n
  })
  return found
}

export function findParent(root: MobileNode, id: string): ArmNode | null {
  let found: ArmNode | null = null
  walk(root, (n, parent) => {
    if (n.id === id) found = parent
  })
  return found
}

/** Rebuild the tree immutably, replacing nodes via the mapper (children are
 *  mapped first, so the mapper sees already-updated subtrees). */
export function mapTree(node: MobileNode, fn: (n: MobileNode) => MobileNode): MobileNode {
  if (node.kind === 'arm') {
    const mapped: ArmNode = { ...node, left: mapTree(node.left, fn), right: mapTree(node.right, fn) }
    return fn(mapped)
  }
  return fn({ ...node })
}

/** Human-friendly labels ("Arm A", "Shape 3"), assigned in reading order.
 *  Derived on the fly so they stay consistent after edits. */
export function labelNodes(root: MobileNode): Map<string, string> {
  const labels = new Map<string, string>()
  let armIdx = 0
  let shapeIdx = 0
  walk(root, (n) => {
    if (n.kind === 'arm') {
      labels.set(n.id, `Arm ${String.fromCharCode(65 + (armIdx % 26))}${armIdx >= 26 ? Math.floor(armIdx / 26) : ''}`)
      armIdx += 1
    } else {
      shapeIdx += 1
      labels.set(n.id, `Shape ${shapeIdx}`)
    }
  })
  return labels
}
