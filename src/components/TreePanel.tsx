import type { MobileNode } from '../model/types'
import { labelNodes } from '../model/types'
import { useStore } from '../state/store'
import { ShapeThumb } from './ShapeThumb'
import { fmtIn, fmtOz } from '../model/materials'
import { armTiltRad, shapeWeightOz } from '../model/balance'
import { SHAPE_LABELS } from '../model/shapes'

export function TreePanel() {
  const doc = useStore((s) => s.doc)
  const labels = labelNodes(doc.root)

  return (
    <div className="tree-panel">
      <h2>Parts of your mobile</h2>
      <p className="hint">Click a part to change it.</p>
      <NodeRow node={doc.root} labels={labels} depth={0} />
    </div>
  )
}

function NodeRow({ node, labels, depth }: { node: MobileNode; labels: Map<string, string>; depth: number }) {
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)
  const isSelected = selectedId === node.id

  if (node.kind === 'shape') {
    return (
      <button
        className={`tree-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 18 }}
        onClick={() => select(node.id)}
      >
        <ShapeThumb kind={node.shape} color={node.color} />
        <span className="tree-label">{labels.get(node.id)}</span>
        <span className="tree-sub">
          {SHAPE_LABELS[node.shape]} · {fmtIn(node.width)} · {fmtOz(shapeWeightOz(node))}
        </span>
      </button>
    )
  }

  const tiltDeg = Math.abs((armTiltRad(node) * 180) / Math.PI)
  return (
    <>
      <button
        className={`tree-row ${isSelected ? 'selected' : ''}`}
        style={{ paddingLeft: 12 + depth * 18 }}
        onClick={() => select(node.id)}
      >
        <span className="arm-icon">⟝</span>
        <span className="tree-label">{labels.get(node.id)}</span>
        <span className="tree-sub">
          {fmtIn(node.length)} wire
          {tiltDeg > 3 ? <span className="tilt-warn"> · tilts {tiltDeg.toFixed(0)}°</span> : ' · level'}
        </span>
      </button>
      <NodeRow node={node.left} labels={labels} depth={depth + 1} />
      <NodeRow node={node.right} labels={labels} depth={depth + 1} />
    </>
  )
}
