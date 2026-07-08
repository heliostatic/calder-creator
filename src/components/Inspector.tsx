import type { ArmNode, ShapeKind, ShapeNode, WireKey, WoodKey } from '../model/types'
import { findNode, labelNodes, walk } from '../model/types'
import { useStore } from '../state/store'
import { COLORS, THICKNESSES, WIRES, WOODS, fmtIn, fmtOz } from '../model/materials'
import { armLoads, armTiltRad, balancedPivot, shapeWeightOz, subtreeWeightOz } from '../model/balance'
import { SHAPE_LABELS } from '../model/shapes'
import { ShapeThumb } from './ShapeThumb'

const SHAPE_KINDS: ShapeKind[] = ['circle', 'oval', 'petal', 'crescent', 'triangle', 'blob']

export function Inspector() {
  const doc = useStore((s) => s.doc)
  const selectedId = useStore((s) => s.selectedId)
  const node = selectedId ? findNode(doc.root, selectedId) : null

  if (!node) return <MobileSettings />
  if (node.kind === 'shape') return <ShapeEditor node={node} />
  return <ArmEditor node={node} />
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
    </label>
  )
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  format?: (v: number) => string
  onChange: (v: number) => void
}) {
  return (
    <Field label={`${label}: ${format ? format(value) : value}`}>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </Field>
  )
}

// ---------------------------------------------------------------- mobile

function MobileSettings() {
  const doc = useStore((s) => s.doc)
  const updateDoc = useStore((s) => s.updateDoc)
  const balanceNow = useStore((s) => s.balanceNow)
  const setAllShapes = useStore((s) => s.setAllShapes)
  const setAllWire = useStore((s) => s.setAllWire)
  const totalOz = subtreeWeightOz(doc.root)

  // shared values across parts, or '' when they differ
  const woods = new Set<string>()
  const thicknesses = new Set<number>()
  const wires = new Set<string>()
  walk(doc.root, (n) => {
    if (n.kind === 'shape') {
      woods.add(n.wood)
      thicknesses.add(n.thickness)
    } else {
      wires.add(n.wire)
    }
  })
  const commonWood = woods.size === 1 ? [...woods][0] : ''
  const commonThickness = thicknesses.size === 1 ? String([...thicknesses][0]) : ''
  const commonWire = wires.size === 1 ? [...wires][0] : ''

  return (
    <div className="inspector">
      <h2>The whole mobile</h2>
      <p className="hint">Click any part in the picture or the list to edit it.</p>
      <Field label="Name">
        <input type="text" value={doc.name} onChange={(e) => updateDoc({ name: e.target.value })} />
      </Field>
      <SliderField
        label="Hanging wire length"
        value={doc.hangerDrop}
        min={2}
        max={48}
        step={0.5}
        format={fmtIn}
        onChange={(v) => updateDoc({ hangerDrop: v })}
      />
      <label className="check-row">
        <input
          type="checkbox"
          checked={doc.autoBalance}
          onChange={(e) => updateDoc({ autoBalance: e.target.checked })}
        />
        <span>
          <strong>Keep everything balanced for me</strong>
          <br />
          <small>Moves each arm's hanging loop to the math-perfect spot after every change.</small>
        </span>
      </label>
      {!doc.autoBalance && (
        <button className="btn" onClick={balanceNow}>
          ⚖️ Balance everything now
        </button>
      )}

      <div className="bulk-box">
        <h3>Materials for the whole mobile</h3>
        <p className="hint">Change every part at once. Pick a single part instead to change just that one.</p>
        <Field label="All shapes — wood">
          <select value={commonWood} onChange={(e) => e.target.value && setAllShapes({ wood: e.target.value as WoodKey })}>
            {commonWood === '' && <option value="">Mixed woods…</option>}
            {Object.entries(WOODS).map(([k, w]) => (
              <option key={k} value={k}>
                {w.label} — {w.note}
              </option>
            ))}
          </select>
        </Field>
        <Field label="All shapes — thickness">
          <select
            value={commonThickness}
            onChange={(e) => e.target.value && setAllShapes({ thickness: Number(e.target.value) })}
          >
            {commonThickness === '' && <option value="">Mixed thicknesses…</option>}
            {THICKNESSES.map((t) => (
              <option key={t.value} value={String(t.value)}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        {wires.size > 0 && (
          <Field label="All arms — wire">
            <select value={commonWire} onChange={(e) => e.target.value && setAllWire(e.target.value as WireKey)}>
              {commonWire === '' && <option value="">Mixed wires…</option>}
              {Object.entries(WIRES).map(([k, w]) => (
                <option key={k} value={k}>
                  {w.label} — {w.note}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <div className="stat-box">
        <div>
          Total weight: <strong>{fmtOz(totalOz)}</strong>
        </div>
        <small>A small screw hook in a ceiling joist holds this easily.</small>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- shape

function ShapeEditor({ node }: { node: ShapeNode }) {
  const doc = useStore((s) => s.doc)
  const updateNode = useStore((s) => s.updateNode)
  const splitShape = useStore((s) => s.splitShape)
  const removeNode = useStore((s) => s.removeNode)
  const labels = labelNodes(doc.root)
  const isOnlyNode = doc.root.id === node.id

  return (
    <div className="inspector">
      <h2>{labels.get(node.id)}</h2>
      <div className="shape-kind-grid">
        {SHAPE_KINDS.map((k) => (
          <button
            key={k}
            className={`shape-kind ${node.shape === k ? 'selected' : ''}`}
            onClick={() => updateNode(node.id, { shape: k })}
            title={SHAPE_LABELS[k]}
          >
            <ShapeThumb kind={k} color={node.color} size={34} />
            <span>{SHAPE_LABELS[k]}</span>
          </button>
        ))}
      </div>
      <SliderField
        label="Width"
        value={node.width}
        min={1}
        max={8}
        step={0.25}
        format={fmtIn}
        onChange={(v) => updateNode(node.id, node.shape === 'circle' ? { width: v, height: v } : { width: v })}
      />
      {node.shape !== 'circle' && (
        <SliderField
          label="Height"
          value={node.height}
          min={1}
          max={8}
          step={0.25}
          format={fmtIn}
          onChange={(v) => updateNode(node.id, { height: v })}
        />
      )}
      <Field label="Wood">
        <select value={node.wood} onChange={(e) => updateNode(node.id, { wood: e.target.value as WoodKey })}>
          {Object.entries(WOODS).map(([k, w]) => (
            <option key={k} value={k}>
              {w.label} — {w.note}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Thickness">
        <select value={node.thickness} onChange={(e) => updateNode(node.id, { thickness: Number(e.target.value) })}>
          {THICKNESSES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Color">
        <div className="swatches">
          {COLORS.map((c) => (
            <button
              key={c.value}
              className={`swatch ${node.color === c.value ? 'selected' : ''}`}
              style={{ background: c.value }}
              title={c.label}
              onClick={() => updateNode(node.id, { color: c.value })}
            />
          ))}
        </div>
      </Field>
      <div className="stat-box">
        Weighs about <strong>{fmtOz(shapeWeightOz(node))}</strong>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => splitShape(node.id)}>
          🌿 Turn into a branch
        </button>
        {!isOnlyNode && (
          <button className="btn danger" onClick={() => removeNode(node.id)}>
            🗑 Remove
          </button>
        )}
      </div>
      <p className="hint">“Turn into a branch” hangs this shape and a new one from a new arm.</p>
    </div>
  )
}

// ---------------------------------------------------------------- arm

function ArmEditor({ node }: { node: ArmNode }) {
  const doc = useStore((s) => s.doc)
  const updateNode = useStore((s) => s.updateNode)
  const removeNode = useStore((s) => s.removeNode)
  const labels = labelNodes(doc.root)
  const tiltDeg = (armTiltRad(node) * 180) / Math.PI
  const loads = armLoads(node)
  const ideal = balancedPivot(node)

  return (
    <div className="inspector">
      <h2>{labels.get(node.id)}</h2>
      <SliderField
        label="Arm length"
        value={node.length}
        min={4}
        max={30}
        step={0.5}
        format={fmtIn}
        onChange={(v) => updateNode(node.id, { length: v, pivot: Math.min(node.pivot, v) })}
      />
      <SliderField
        label="Left drop wire"
        value={node.dropLeft}
        min={0.5}
        max={8}
        step={0.25}
        format={fmtIn}
        onChange={(v) => updateNode(node.id, { dropLeft: v })}
      />
      <SliderField
        label="Right drop wire"
        value={node.dropRight}
        min={0.5}
        max={8}
        step={0.25}
        format={fmtIn}
        onChange={(v) => updateNode(node.id, { dropRight: v })}
      />
      <Field label="Wire">
        <select value={node.wire} onChange={(e) => updateNode(node.id, { wire: e.target.value as WireKey })}>
          {Object.entries(WIRES).map(([k, w]) => (
            <option key={k} value={k}>
              {w.label} — {w.note}
            </option>
          ))}
        </select>
      </Field>

      <div className="balance-box">
        <h3>Balance</h3>
        {doc.autoBalance ? (
          <p>
            Hanging loop set automatically at <strong>{fmtIn(node.pivot)}</strong> from the left end. This arm hangs{' '}
            <strong>level</strong>. ⚖️
          </p>
        ) : (
          <>
            <SliderField
              label="Hanging loop from left end"
              value={node.pivot}
              min={0.5}
              max={node.length - 0.5}
              step={0.1}
              format={fmtIn}
              onChange={(v) => updateNode(node.id, { pivot: v })}
            />
            <p className={Math.abs(tiltDeg) > 3 ? 'tilt-warn' : ''}>
              {Math.abs(tiltDeg) <= 1
                ? 'This arm hangs level. ⚖️'
                : `Tilts ${Math.abs(tiltDeg).toFixed(0)}° — ${tiltDeg > 0 ? 'left' : 'right'} side hangs lower.`}{' '}
              {Math.abs(tiltDeg) > 1 && (
                <button className="btn small" onClick={() => updateNode(node.id, { pivot: Math.round(ideal * 100) / 100 })}>
                  Fix it ({fmtIn(ideal)})
                </button>
              )}
            </p>
          </>
        )}
        <small>
          Carrying {fmtOz(loads.WL)} on the left, {fmtOz(loads.WR)} on the right.
        </small>
      </div>

      <div className="btn-row">
        <button className="btn danger" onClick={() => removeNode(node.id)}>
          🗑 Remove this arm{doc.root.id === node.id ? ' (keeps its left piece)' : ' (and everything on it)'}
        </button>
      </div>
    </div>
  )
}
