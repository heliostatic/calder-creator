import { useMemo, useState } from 'react'
import type { MobileDoc } from '../model/types'
import { walk } from '../model/types'
import { FAMILIES, TEMPLATES, blankDoc } from '../model/templates'
import type { FamilyKey } from '../model/templates'
import { generateMobile } from '../model/generate'
import type { GenSize } from '../model/generate'
import { computePose, totalHangingWeightOz } from '../model/balance'
import { fmtOz } from '../model/materials'
import { useStore } from '../state/store'
import { MobileThumb } from './MobileThumb'

interface CardStats {
  shapes: number
  arms: number
  widthIn: number
  weightOz: number
  difficulty: string
}

function statsFor(doc: MobileDoc): CardStats {
  let shapes = 0
  let arms = 0
  walk(doc.root, (n) => {
    if (n.kind === 'shape') shapes += 1
    else arms += 1
  })
  const pose = computePose(doc)
  const widthIn = Math.max(pose.max.x - pose.min.x, pose.max.z - pose.min.z)
  const difficulty = arms <= 2 ? 'easy afternoon' : arms <= 4 ? 'full afternoon' : arms <= 6 ? 'weekend' : 'ambitious weekend'
  return { shapes, arms, widthIn, weightOz: totalHangingWeightOz(doc), difficulty }
}

function Card({ doc, title, blurb, onPick }: { doc: MobileDoc; title: string; blurb: string; onPick: () => void }) {
  const stats = useMemo(() => statsFor(doc), [doc])
  return (
    <button className="template-card" onClick={onPick}>
      <div className="template-thumb">
        <MobileThumb doc={doc} />
      </div>
      <strong>{title}</strong>
      <span className="template-stats">
        {stats.shapes} shapes · ~{Math.round(stats.widthIn)}″ wide · {fmtOz(stats.weightOz)} · <em>{stats.difficulty}</em>
      </span>
      <span>{blurb}</span>
    </button>
  )
}

export function TemplatesModal() {
  const open = useStore((s) => s.templatesOpen)
  const setOpen = useStore((s) => s.setTemplatesOpen)
  const loadTemplate = useStore((s) => s.loadTemplate)
  const setDoc = useStore((s) => s.setDoc)
  const select = useStore((s) => s.select)

  const [genFamily, setGenFamily] = useState<FamilyKey | 'any'>('any')
  const [genSize, setGenSize] = useState<GenSize>('medium')

  // build each template doc once per modal open (they're cheap, but memo anyway)
  const docs = useMemo(() => new Map(TEMPLATES.map((t) => [t.key, t.make()])), [open])

  if (!open) return null

  const pickDoc = (doc: MobileDoc) => {
    setDoc(doc)
    select(null)
    setOpen(false)
  }

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Start a mobile</h2>
          <button className="btn" onClick={() => setOpen(false)}>
            ✕ Close
          </button>
        </div>
        <p className="hint">
          Pick a starting point — every part of it can be changed afterwards. These are original designs in the spirit of
          Alexander Calder;{' '}
          <a href="https://calder.org/archive/all/works/hanging-mobile/" target="_blank" rel="noreferrer">
            browse his real hanging mobiles ↗
          </a>{' '}
          for inspiration.
        </p>

        <section className="surprise-box">
          <strong>🎲 Surprise me</strong>
          <span className="hint">A brand-new, automatically balanced design every time.</span>
          <div className="surprise-controls">
            <select value={genFamily} onChange={(e) => setGenFamily(e.target.value as FamilyKey | 'any')}>
              <option value="any">Any style</option>
              {FAMILIES.filter((f) => f.key !== 'starter').map((f) => (
                <option key={f.key} value={f.key}>
                  {f.title}
                </option>
              ))}
            </select>
            <select value={genSize} onChange={(e) => setGenSize(e.target.value as GenSize)}>
              <option value="small">Small (3–5 shapes)</option>
              <option value="medium">Medium (5–7 shapes)</option>
              <option value="large">Large (8–11 shapes)</option>
            </select>
            <button className="btn primary" onClick={() => pickDoc(generateMobile(genFamily, genSize))}>
              Generate
            </button>
          </div>
        </section>

        {FAMILIES.map((family) => {
          const entries = TEMPLATES.filter((t) => t.family === family.key)
          if (!entries.length) return null
          return (
            <section key={family.key} className="template-family">
              <h3>
                {family.title}
                <a href={family.archiveUrl} target="_blank" rel="noreferrer">
                  real Calders ↗
                </a>
              </h3>
              <p className="hint">{family.blurb}</p>
              <div className="template-grid">
                {entries.map((t) => (
                  <Card key={t.key} doc={docs.get(t.key)!} title={t.title} blurb={t.blurb} onPick={() => loadTemplate(t.key)} />
                ))}
              </div>
            </section>
          )
        })}

        <section className="template-family">
          <h3>From scratch</h3>
          <div className="template-grid">
            <Card
              doc={blankDoc()}
              title="Simple start"
              blurb="One arm with two shapes. Build up from almost nothing."
              onPick={() => pickDoc(blankDoc())}
            />
          </div>
        </section>
      </div>
    </div>
  )
}
