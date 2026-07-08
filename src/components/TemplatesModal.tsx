import { TEMPLATES } from '../model/templates'
import { blankDoc } from '../model/templates'
import { useStore } from '../state/store'

export function TemplatesModal() {
  const open = useStore((s) => s.templatesOpen)
  const setOpen = useStore((s) => s.setTemplatesOpen)
  const loadTemplate = useStore((s) => s.loadTemplate)
  const setDoc = useStore((s) => s.setDoc)

  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Start a mobile</h2>
        <p className="hint">Pick a starting point — you can change every part of it afterwards.</p>
        <div className="template-grid">
          {TEMPLATES.map((t) => (
            <button key={t.key} className="template-card" onClick={() => loadTemplate(t.key)}>
              <strong>{t.title}</strong>
              <span>{t.blurb}</span>
            </button>
          ))}
          <button
            className="template-card"
            onClick={() => {
              setDoc(blankDoc())
              setOpen(false)
            }}
          >
            <strong>Simple start</strong>
            <span>One arm with two shapes. Build up from scratch.</span>
          </button>
        </div>
        <button className="btn" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  )
}
