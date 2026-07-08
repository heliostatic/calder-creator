import { useEffect, useState } from 'react'
import type { MobileVariant } from '../state/store'
import { useStore } from '../state/store'
import { Canvas3D } from './Canvas3D'
import { TreePanel } from './TreePanel'
import { Inspector } from './Inspector'
import { PlansView } from './PlansView'
import { TemplatesModal } from './TemplatesModal'
import { generateMobile } from '../model/generate'

/** Phone layouts. Three experiments, selected via ?mobile=viewer|drawer|tabs:
 *  viewer — a polished viewer: watch, poke, browse templates; build elsewhere
 *  drawer — the full editor, with the parts panel in a slide-over drawer
 *  tabs   — bottom tab bar switching between View / Parts / Plans */
export function MobileApp({ variant }: { variant: MobileVariant }) {
  const view = useStore((s) => s.view)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const setView = useStore((s) => s.setView)
  const breeze = useStore((s) => s.breeze)
  const setBreeze = useStore((s) => s.setBreeze)
  const zoomTo = useStore((s) => s.zoomTo)
  const showRoom = useStore((s) => s.showRoom)
  const setShowRoom = useStore((s) => s.setShowRoom)
  const setTemplatesOpen = useStore((s) => s.setTemplatesOpen)
  const setDoc = useStore((s) => s.setDoc)
  const doc = useStore((s) => s.doc)
  const undo = useStore((s) => s.undo)
  const past = useStore((s) => s.past)

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [tab, setTab] = useState<'view' | 'parts'>('view')

  // phones open straight into the magic
  useEffect(() => {
    setMode('test')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (view === 'plans') return <PlansView />

  const showCanvas = variant !== 'tabs' || tab === 'view'
  const showParts = (variant === 'tabs' && tab === 'parts') || (variant === 'drawer' && drawerOpen)

  return (
    <div className="phone-app">
      {showCanvas && (
        <div className="phone-canvas">
          <Canvas3D />
          <div className="phone-top">
            <span className="phone-logo">🎈 {doc.name}</span>
            <div className="view-pill">
              <button onClick={() => zoomTo('mobile')} title="Zoom to the mobile">
                🔍
              </button>
              <button onClick={() => zoomTo('room')} title="See the whole room">
                ⛶
              </button>
              <button className={showRoom ? 'on' : ''} onClick={() => setShowRoom(!showRoom)} title="Room on/off">
                🏠
              </button>
            </div>
          </div>
          {mode === 'test' && (
            <label className="phone-breeze">
              🍃
              <input type="range" min={0} max={1} step={0.05} value={breeze} onChange={(e) => setBreeze(Number(e.target.value))} />
            </label>
          )}
        </div>
      )}

      {showParts && (
        <div className={variant === 'drawer' ? 'phone-drawer' : 'phone-parts'}>
          {variant === 'drawer' && (
            <div className="phone-drawer-head">
              <strong>Parts &amp; settings</strong>
              <div className="btn-row">
                <button className="btn small" onClick={undo} disabled={!past.length}>
                  ↩︎ Undo
                </button>
                <button className="btn small" onClick={() => setView('plans')}>
                  🖨 Plans
                </button>
                <button className="btn small" onClick={() => setDrawerOpen(false)}>
                  ✕ Close
                </button>
              </div>
            </div>
          )}
          <TreePanel />
          <Inspector />
        </div>
      )}
      {variant === 'drawer' && drawerOpen && <div className="phone-scrim" onClick={() => setDrawerOpen(false)} />}

      <nav className="phone-bar">
        {variant === 'viewer' && (
          <>
            <button onClick={() => setTemplatesOpen(true)}>✨ Gallery</button>
            <button onClick={() => setDoc(generateMobile('any', 'medium'))}>🎲 Surprise</button>
            <button className={mode === 'test' ? 'on' : ''} onClick={() => setMode(mode === 'test' ? 'build' : 'test')}>
              🍃 Wind
            </button>
          </>
        )}
        {variant === 'drawer' && (
          <>
            <button onClick={() => setDrawerOpen(true)}>🧰 Parts</button>
            <button onClick={() => setTemplatesOpen(true)}>✨ New</button>
            <button className={mode === 'test' ? 'on' : ''} onClick={() => setMode(mode === 'test' ? 'build' : 'test')}>
              🍃 Wind
            </button>
          </>
        )}
        {variant === 'tabs' && (
          <>
            <button className={tab === 'view' ? 'on' : ''} onClick={() => setTab('view')}>
              🎈 View
            </button>
            <button className={tab === 'parts' ? 'on' : ''} onClick={() => setTab('parts')}>
              🧰 Parts
            </button>
            <button onClick={() => setTemplatesOpen(true)}>✨ New</button>
            <button onClick={() => setView('plans')}>🖨 Plans</button>
          </>
        )}
      </nav>

      {variant === 'viewer' && (
        <p className="phone-note">Sit back and watch — to design your own and print build plans, open this on a computer.</p>
      )}
      <TemplatesModal />
    </div>
  )
}
