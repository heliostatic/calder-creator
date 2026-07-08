import type { ShapeKind } from '../model/types'
import { svgPath } from '../model/shapes'

/** Small SVG preview of a shape, used in the tree, inspector and plans. */
export function ShapeThumb({ kind, color, size = 28 }: { kind: ShapeKind; color: string; size?: number }) {
  // draw in a normalized 1×1 box with a little padding
  const path = svgPath(kind, 1, 1)
  return (
    <svg width={size} height={size} viewBox="-0.6 -0.6 1.2 1.2" aria-hidden>
      <path d={path} fill={color} stroke="rgba(0,0,0,0.25)" strokeWidth={0.02} />
    </svg>
  )
}
