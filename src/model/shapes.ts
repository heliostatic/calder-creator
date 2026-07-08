import type { ShapeKind } from './types'
import { HOLE_INSET_IN } from './materials'

export interface Pt {
  x: number
  y: number
}

export const SHAPE_LABELS: Record<ShapeKind, string> = {
  circle: 'Circle',
  oval: 'Oval',
  petal: 'Petal',
  crescent: 'Moon',
  triangle: 'Triangle',
  blob: 'Amoeba',
}

function ellipsePts(n: number): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    pts.push({ x: Math.sin(a) * 0.5, y: Math.cos(a) * 0.5 })
  }
  return pts
}

function cubic(p0: Pt, c1: Pt, c2: Pt, p3: Pt, n: number): Pt[] {
  const pts: Pt[] = []
  for (let i = 0; i < n; i++) {
    const t = i / n
    const u = 1 - t
    pts.push({
      x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y,
    })
  }
  return pts
}

/** teardrop: pointed top, round belly */
function petalPts(): Pt[] {
  const tip: Pt = { x: 0, y: 0.5 }
  const bottom: Pt = { x: 0, y: -0.5 }
  const right = cubic(tip, { x: 0.42, y: 0.15 }, { x: 0.52, y: -0.48 }, bottom, 32)
  const left = cubic(bottom, { x: -0.52, y: -0.48 }, { x: -0.42, y: 0.15 }, tip, 32)
  return [...right, ...left]
}

function crescentPts(): Pt[] {
  const pts: Pt[] = []
  // outer arc: circle r=0.5 about origin, from top (90°) around the left side to bottom (270°)
  const n1 = 40
  for (let i = 0; i <= n1; i++) {
    const a = Math.PI / 2 + (i / n1) * Math.PI
    pts.push({ x: Math.cos(a) * 0.5, y: Math.sin(a) * 0.5 })
  }
  // inner arc: circle through the same two tips, center pushed right → bulges left.
  // Traverse from the bottom tip back up to the top tip along the arc that stays
  // inside the outer circle (through the inner circle's 180° point).
  const c = 0.42
  const r = Math.hypot(c, 0.5)
  const a0 = Math.atan2(-0.5, -c) // bottom tip, about the inner center (≈ −130°)
  const a1 = Math.atan2(0.5, -c) - Math.PI * 2 // top tip, one turn down (≈ −230°)
  const n2 = 40
  for (let i = 1; i < n2; i++) {
    const a = a0 + (i / n2) * (a1 - a0)
    pts.push({ x: c + Math.cos(a) * r, y: Math.sin(a) * r })
  }
  return pts
}

function trianglePts(): Pt[] {
  // slightly scalene, point down — more Calder than an equilateral
  return [
    { x: -0.5, y: 0.5 },
    { x: 0.5, y: 0.32 },
    { x: 0.08, y: -0.5 },
  ]
}

/** closed Catmull-Rom through organic control points */
function blobPts(): Pt[] {
  const ctrl: Pt[] = [
    { x: 0, y: 0.5 },
    { x: 0.4, y: 0.34 },
    { x: 0.5, y: -0.02 },
    { x: 0.26, y: -0.44 },
    { x: -0.08, y: -0.5 },
    { x: -0.3, y: -0.22 },
    { x: -0.5, y: -0.02 },
    { x: -0.34, y: 0.38 },
  ]
  const pts: Pt[] = []
  const n = ctrl.length
  const per = 10
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n]
    const p1 = ctrl[i]
    const p2 = ctrl[(i + 1) % n]
    const p3 = ctrl[(i + 2) % n]
    for (let j = 0; j < per; j++) {
      const t = j / per
      const t2 = t * t
      const t3 = t2 * t
      pts.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3),
      })
    }
  }
  return pts
}

const RAW: Record<ShapeKind, () => Pt[]> = {
  circle: () => ellipsePts(64),
  oval: () => ellipsePts(64),
  petal: petalPts,
  crescent: crescentPts,
  triangle: trianglePts,
  blob: blobPts,
}

const cache = new Map<string, Pt[]>()

/** Closed outline polygon, scaled to exactly fill width w × height h, centered on the origin. */
export function outline(kind: ShapeKind, w: number, h: number): Pt[] {
  const key = `${kind}|${w}|${h}`
  const hit = cache.get(key)
  if (hit) return hit
  const raw = RAW[kind]()
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of raw) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x)
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
  }
  const sx = w / (maxX - minX)
  const sy = h / (maxY - minY)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const pts = raw.map((p) => ({ x: (p.x - cx) * sx, y: (p.y - cy) * sy }))
  cache.set(key, pts)
  return pts
}

/** Shoelace area, in² */
export function shapeArea(kind: ShapeKind, w: number, h: number): number {
  const pts = outline(kind, w, h)
  let a = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    a += p.x * q.y - q.x * p.y
  }
  return Math.abs(a) / 2
}

export function centroid(kind: ShapeKind, w: number, h: number): Pt {
  const pts = outline(kind, w, h)
  let a = 0, cx = 0, cy = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    const cross = p.x * q.y - q.x * p.y
    a += cross
    cx += (p.x + q.x) * cross
    cy += (p.y + q.y) * cross
  }
  if (Math.abs(a) < 1e-9) return { x: 0, y: 0 }
  return { x: cx / (3 * a), y: cy / (3 * a) }
}

function pointInPolygon(pts: Pt[], x: number, y: number): boolean {
  let inside = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i]
    const b = pts[j]
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside
  }
  return inside
}

function distToOutline(pts: Pt[], x: number, y: number): number {
  let best = Infinity
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    const dx = b.x - a.x
    const dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len2)) : 0
    const px = a.x + t * dx - x
    const py = a.y + t * dy - y
    best = Math.min(best, px * px + py * py)
  }
  return Math.sqrt(best)
}

const holeCache = new Map<string, Pt>()

/** Where the hanging hole gets drilled: the highest spot that (a) keeps a safe
 *  ring of material around the hole and (b) sits directly above the shape's
 *  center of gravity — a shape suspended from a hole rotates until its centroid
 *  hangs below it, so this makes every shape hang the way it was designed.
 *  The vertical-line requirement is relaxed step by step for shapes (like a
 *  thin crescent) with no material straight above their centroid. */
export function holePos(kind: ShapeKind, w: number, h: number): Pt {
  const key = `${kind}|${w}|${h}`
  const hit = holeCache.get(key)
  if (hit) return hit
  const pts = outline(kind, w, h)
  const c = centroid(kind, w, h)
  const clearance = Math.min(HOLE_INSET_IN * 0.65, w * 0.13, h * 0.13)
  const yStep = Math.max(h / 60, 0.03)
  const xStep = Math.max(w / 80, 0.025)

  let result: Pt | null = null
  for (const tol of [w / 14, w / 6, w]) {
    for (let y = h / 2 - clearance; y > c.y && !result; y -= yStep) {
      let bestX: number | null = null
      for (let x = Math.max(c.x - tol, -w / 2 + clearance); x <= Math.min(c.x + tol, w / 2 - clearance); x += xStep) {
        if (!pointInPolygon(pts, x, y)) continue
        if (distToOutline(pts, x, y) < clearance) continue
        if (bestX === null || Math.abs(x - c.x) < Math.abs(bestX - c.x)) bestX = x
      }
      if (bestX !== null) result = { x: bestX, y }
    }
    if (result) break
  }
  const pos = result ?? c
  holeCache.set(key, pos)
  return pos
}

/** SVG path (y flipped so +y in model = up on screen), in inch units. */
export function svgPath(kind: ShapeKind, w: number, h: number): string {
  const pts = outline(kind, w, h)
  const cmds = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(3)},${(-p.y).toFixed(3)}`)
  return cmds.join(' ') + ' Z'
}
