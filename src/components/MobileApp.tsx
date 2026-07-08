import { useEffect, useState } from 'react'
import { useStore } from '../state/store'
import { Canvas3D } from './Canvas3D'
import { TreePanel } from './TreePanel'
import { Inspector } from './Inspector'
import { PlansView } from './PlansView'
import { TemplatesModal } from './TemplatesModal'
import { generateMobile } from '../model/generate'

/** The phone layout: a full-screen viewer with a gentle ever-present breeze,
 *  plus Parts and Plans a tap away. Simple on the surface, everything there. */
export function MobileApp() {
  const view = useStore((s) => s.view)
  const setMode = useStore((s) => s.setMode)
  const setView = useStore((s) => s.setView)
  const setBreeze = useStore((s) => s.setBreeze)
  const zoomTo = useStore((s) => s.zoomTo)
  const showRoom = useStore((s) => s.showRoom)
  const setShowRoom = useStore((s) => s.setShowRoom)
  const setTemplatesOpen = useStore((s) => s.setTemplatesOpen)
  const setDoc = useStore((s) => s.setDoc)
  const doc = useStore((s) => s.doc)

  const [tab, setTab] = useState<'view' | 'parts'>('view')

  // phones live in the wind test, with the gentlest possible breeze
  useEffect(() => {
    setMode('test')
    setBreeze(0.05)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (view === 'plans') return <PlansView />

  const imagine = () => {
    setDoc(generateMobile('any', 'medium'))
    zoomTo('mobile')
  }

  return (
    <div className="phone-app">
      {tab === 'view' ? (
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
          <div className="phone-actions">
            <button className="btn" onClick={() => setTemplatesOpen(true)}>
              ✨ Gallery
            </button>
            <button className="btn" onClick={imagine}>
              🪄 Imagine
            </button>
          </div>
        </div>
      ) : (
        <div className="phone-parts">
          <TreePanel />
          <Inspector />
        </div>
      )}

      <p className="phone-note">Tip: full-size printable templates work best from a computer.</p>
      <nav className="phone-bar">
        <button className={tab === 'view' ? 'on' : ''} onClick={() => setTab('view')}>
          🎈 View
        </button>
        <button className={tab === 'parts' ? 'on' : ''} onClick={() => setTab('parts')}>
          🧰 Parts
        </button>
        <button onClick={() => setView('plans')}>🖨 Plans</button>
      </nav>
      <TemplatesModal />
    </div>
  )
}
