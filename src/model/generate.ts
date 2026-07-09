import type { ArmNode, MobileDoc, MobileNode, ShapeKind, ShapeNode } from './types'
import { mapTree, newId } from './types'
import { armLoads, balanceAll, balancedPivot } from './balance'
import type { FamilyKey } from './templates'

export type GenSize = 'small' | 'medium' | 'large'

/** mulberry32 — small deterministic PRNG so a seed can reproduce a design */
function rng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickWeighted<T>(r: () => number, entries: [T, number][]): T {
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let x = r() * total
  for (const [v, w] of entries) {
    x -= w
    if (x <= 0) return v
  }
  return entries[entries.length - 1][0]
}

const COLOR_WEIGHTS: [string, number][] = [
  ['#c8202f', 22], // red
  ['#1a1a1a', 22], // black
  ['#0057b8', 18], // blue
  ['#ffc907', 18], // yellow
  ['#f4efe6', 12], // white
  ['#e87722', 8], // orange
]

const SHAPE_WEIGHTS: [ShapeKind, number][] = [
  ['circle', 30],
  ['petal', 20],
  ['blob', 18],
  ['triangle', 14],
  ['crescent', 10],
  ['oval', 8],
]

interface GenParams {
  shapeTarget: number
  shapeMin: number
  shapeMax: number
  armBase: number
}

const SIZES: Record<GenSize, GenParams> = {
  small: { shapeTarget: 4, shapeMin: 2, shapeMax: 3.75, armBase: 8 },
  medium: { shapeTarget: 6, shapeMin: 2, shapeMax: 4.75, armBase: 10 },
  large: { shapeTarget: 9, shapeMin: 1.75, shapeMax: 5.5, armBase: 12 },
}

function makeShape(r: () => number, p: GenParams, opts: { small?: boolean; big?: boolean; flat?: boolean } = {}): ShapeNode {
  const kind = pickWeighted(r, SHAPE_WEIGHTS)
  let base = p.shapeMin + r() * (p.shapeMax - p.shapeMin)
  if (opts.small) base = p.shapeMin + r() * 1
  if (opts.big) base = p.shapeMax + 1 + r() * 1.5
  // an oval the same height as its width is just a circle — keep it oval
  const stretch =
    kind === 'petal' ? 1.5 + r() * 0.3 : kind === 'blob' ? 0.75 + r() * 0.15 : kind === 'oval' ? 0.6 + r() * 0.15 : 1
  const w = Math.round(base * 4) / 4
  const h = Math.round(base * stretch * 4) / 4
  return {
    kind: 'shape',
    id: newId(),
    shape: kind,
    width: w,
    height: kind === 'circle' ? w : h,
    wood: 'balticBirch',
    // flat pieces read better (and groove more safely) in thicker stock
    thickness: opts.big || opts.flat ? 0.25 : 0.125,
    color: pickWeighted(r, COLOR_WEIGHTS),
    ...(opts.flat ? { mount: 'flat' as const } : {}),
  }
}

function makeArm(r: () => number, length: number, left: MobileNode, right: MobileNode): ArmNode {
  return {
    kind: 'arm',
    id: newId(),
    length: Math.round(length * 2) / 2,
    pivot: length / 2,
    pivotHeight: 0.75,
    wire: 'steel16',
    dropLeft: Math.round((1 + r() * 2.5) * 4) / 4,
    dropRight: Math.round((1 + r() * 2.5) * 4) / 4,
    left,
    right,
  }
}

/** descending chain: one shape per level, the rest of the mobile on the other end */
function genCascade(r: () => number, p: GenParams, shapes: number, flatChance = 0): MobileNode {
  let node: MobileNode = makeArm(
    r,
    p.armBase * 0.6,
    makeShape(r, p, { small: true, flat: r() < flatChance }),
    makeShape(r, p, { small: true, flat: r() < flatChance }),
  )
  let used = 2
  let len = p.armBase * 0.75
  while (used < shapes) {
    const s = makeShape(r, p, { flat: r() < flatChance })
    node = r() < 0.5 ? makeArm(r, len, s, node) : makeArm(r, len, node, s)
    used += 1
    len *= 1.25
  }
  return node
}

/** random binary tree, splitting until the shape budget is used */
function genTree(r: () => number, p: GenParams, shapes: number, len: number, flatChance = 0): MobileNode {
  if (shapes <= 1) return makeShape(r, p, { flat: r() < flatChance })
  const leftCount = Math.max(1, Math.min(shapes - 1, Math.round(shapes * (0.3 + r() * 0.4))))
  const rightCount = shapes - leftCount
  return makeArm(
    r,
    len,
    genTree(r, p, leftCount, len * (0.5 + r() * 0.15) * (leftCount / shapes) * 2, flatChance),
    genTree(r, p, rightCount, len * (0.5 + r() * 0.15) * (rightCount / shapes) * 2, flatChance),
  )
}

function genCounterweight(r: () => number, p: GenParams, shapes: number): MobileNode {
  const big = makeShape(r, p, { big: true })
  const chain = genCascade(r, { ...p, shapeMax: p.shapeMin + 1.25, armBase: p.armBase * 0.8 }, Math.max(2, shapes - 1))
  const root = makeArm(r, p.armBase * 2, big, chain)
  root.dropRight = root.dropRight + 2.5 // let the chain hang well below the big shape
  return root
}

function genConstellation(r: () => number, p: GenParams, shapes: number): MobileNode {
  const tiny: GenParams = { ...p, shapeMin: 1.25, shapeMax: 2.5 }
  const node = genTree(r, tiny, shapes, p.armBase * 2.2)
  return node
}

/** A mobile is only buildable if every balance point lands where a loop can
 *  physically be bent — clear of the ends. Lopsided random arms get stretched
 *  until their pivot has room (children first, so weights are already final). */
function repairPivots(root: MobileNode): MobileNode {
  return mapTree(root, (n) => {
    if (n.kind !== 'arm') return n
    let arm = n
    let p = balancedPivot(arm)
    let guard = 0
    while ((p < 0.75 || p > arm.length - 0.75) && arm.length < 30 && guard < 14) {
      arm = { ...arm, length: Math.round(arm.length * 1.2 * 2) / 2 }
      p = balancedPivot(arm)
      guard += 1
    }
    return { ...arm, pivot: Math.round(p * 100) / 100 }
  })
}

/** heavier wire for the arms that carry real weight */
function autoWires(doc: MobileDoc): MobileDoc {
  const root = mapTree(doc.root, (n) => {
    if (n.kind !== 'arm') return n
    const load = armLoads(n).Wtot
    return { ...n, wire: load > 20 ? ('steel18' as const) : load > 8 ? ('steel332' as const) : ('steel16' as const) }
  })
  return { ...doc, root }
}

const NAME_A = ['Drifting', 'Quiet', 'Dancing', 'Floating', 'Turning', 'Gentle', 'Wandering', 'Bright']
const NAME_B = ['Sky', 'Tide', 'Meadow', 'Comet', 'Grove', 'Harbor', 'Cloud', 'River']

export function generateMobile(family: FamilyKey | 'any', size: GenSize, seed?: number): MobileDoc {
  const s = seed ?? Math.floor(Math.random() * 2 ** 31)
  const r = rng(s)
  const fam: FamilyKey =
    family === 'any'
      ? pickWeighted(r, [['cascade', 3], ['tree', 3], ['counterweight', 2], ['constellation', 2], ['floating', 2]])
      : family
  const p = SIZES[size]
  const shapes = Math.max(2, p.shapeTarget + Math.floor(r() * 3) - 1)

  let root: MobileNode
  switch (fam) {
    case 'cascade':
      root = genCascade(r, p, shapes, 0.12)
      break
    case 'counterweight':
      root = genCounterweight(r, p, shapes)
      break
    case 'constellation':
      root = genConstellation(r, p, shapes + 1)
      break
    case 'floating':
      root = genCascade(r, p, shapes, 0.85)
      break
    case 'starter':
      root = genTree(r, p, Math.min(shapes, 3), p.armBase * 1.4)
      break
    case 'tree':
    default:
      root = genTree(r, p, shapes, p.armBase * 1.9, 0.12)
      break
  }

  const name = `${NAME_A[Math.floor(r() * NAME_A.length)]} ${NAME_B[Math.floor(r() * NAME_B.length)]}`
  let doc: MobileDoc = { version: 1, name, hangerDrop: size === 'large' ? 8 : 6, autoBalance: true, root }
  doc = balanceAll(doc) // weights must be settled before picking wire gauges
  doc = autoWires(doc) // heavier wire shifts weight...
  doc = { ...doc, root: repairPivots(doc.root) } // ...then rebalance and make every pivot bendable
  return doc
}
