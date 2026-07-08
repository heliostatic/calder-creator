import { useMemo } from 'react'
import type { MobileDoc, MobileNode } from '../model/types'
import { holePos, svgPath } from '../model/shapes'

interface Line {
  x1: number
  y1: number
  x2: number
  y2: number
}

interface PlacedShape {
  path: string
  color: string
  tx: number
  ty: number
}

/** Classic flat mobile diagram: every arm drawn in one plane, balanced level.
 *  Not the 3D pose — just a charming, readable schematic for template cards. */
function flatLayout(doc: MobileDoc) {
  const lines: Line[] = []
  const shapes: PlacedShape[] = []
  let minX = 0, maxX = 0, minY = 0, maxY = 0
  const grow = (x: number, y: number) => {
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }

  // svg coordinates: y grows downward
  const place = (node: MobileNode, x: number, y: number): void => {
    if (node.kind === 'shape') {
      const hole = holePos(node.shape, node.width, node.height)
      // svgPath flips y, so the hole in svg coords is (hole.x, -hole.y)
      shapes.push({ path: svgPath(node.shape, node.width, node.height), color: node.color, tx: x - hole.x, ty: y + hole.y })
      grow(x - node.width, y)
      grow(x + node.width, y + node.height)
      return
    }
    const h = node.pivotHeight
    const lx = x - node.pivot
    const rx = x + (node.length - node.pivot)
    // bent-wire look: end loop up to the pivot loop and back down
    lines.push({ x1: lx, y1: y + h, x2: x, y2: y })
    lines.push({ x1: x, y1: y, x2: rx, y2: y + h })
    lines.push({ x1: lx, y1: y + h, x2: lx, y2: y + h + node.dropLeft })
    lines.push({ x1: rx, y1: y + h, x2: rx, y2: y + h + node.dropRight })
    grow(lx, y)
    grow(rx, y)
    place(node.left, lx, y + h + node.dropLeft)
    place(node.right, rx, y + h + node.dropRight)
  }

  lines.push({ x1: 0, y1: -doc.hangerDrop * 0.5, x2: 0, y2: 0 })
  grow(0, -doc.hangerDrop * 0.5)
  place(doc.root, 0, 0)
  return { lines, shapes, minX, maxX, minY, maxY }
}

export function MobileThumb({ doc, width = 210, height = 120 }: { doc: MobileDoc; width?: number; height?: number }) {
  const layout = useMemo(() => flatLayout(doc), [doc])
  const pad = 2
  const w = layout.maxX - layout.minX + pad * 2
  const h = layout.maxY - layout.minY + pad * 2
  const stroke = Math.max(w, h) / 130
  return (
    <svg
      width={width}
      height={height}
      viewBox={`${layout.minX - pad} ${layout.minY - pad} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {layout.lines.map((l, i) => (
        <line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#55504a" strokeWidth={stroke} strokeLinecap="round" />
      ))}
      {layout.shapes.map((s, i) => (
        <path key={i} d={s.path} transform={`translate(${s.tx} ${s.ty})`} fill={s.color} stroke="rgba(0,0,0,0.18)" strokeWidth={stroke / 2} />
      ))}
    </svg>
  )
}
