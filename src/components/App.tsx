import { useRef } from 'react'
import { detectMobileVariant, useStore } from '../state/store'
import { MobileApp } from './MobileApp'
import { Canvas3D } from './Canvas3D'
import { TreePanel } from './TreePanel'
import { Inspector } from './Inspector'
import { PlansView } from './PlansView'
import { TemplatesModal } from './TemplatesModal'
import type { MobileDoc } from '../model/types'

const mobileVariant = detectMobileVariant()

export function App() {
  const view = useStore((s) => s.view)
  if (mobileVariant) return <MobileApp variant={mobileVariant} />
  if (view === 'plans') return <PlansView />
  return <EditorView />
}

function EditorView() {
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const setView = useStore((s) => s.setView)
  const breeze = useStore((s) => s.breeze)
  const setBreeze = useStore((s) => s.setBreeze)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const past = useStore((s) => s.past)
  const future = useStore((s) => s.future)
  const setTemplatesOpen = useStore((s) => s.setTemplatesOpen)
  const showRoom = useStore((s) => s.showRoom)
  const setShowRoom = useStore((s) => s.setShowRoom)
  const zoomTo = useStore((s) => s.zoomTo)
  const doc = useStore((s) => s.doc)
  const setDoc = useStore((s) => s.setDoc)
  const fileInput = useRef<HTMLInputElement>(null)

  const saveFile = () => {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${doc.name.replace(/[^\w-]+/g, '_') || 'mobile'}.mobile.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const openFile = (file: File) => {
    file.text().then((text) => {
      try {
        const parsed = JSON.parse(text) as MobileDoc
        if (parsed && parsed.version === 1 && parsed.root) setDoc(parsed)
        else alert('That file doesn’t look like a saved mobile.')
      } catch {
        alert('Couldn’t read that file.')
      }
    })
  }

  return (
    <div className="app">
      <header className="topbar">
        <span className="logo">🎈 Mobile Maker</span>
        <button className="btn" onClick={() => setTemplatesOpen(true)}>
          ✨ New / Templates
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()}>
          📂 Open
        </button>
        <button className="btn" onClick={saveFile}>
          💾 Save
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) openFile(f)
            e.target.value = ''
          }}
        />
        <button className="btn" onClick={undo} disabled={!past.length} title="Undo">
          ↩︎ Undo
        </button>
        <button className="btn" onClick={redo} disabled={!future.length} title="Redo">
          ↪︎ Redo
        </button>
        <span className="spacer" />
        <button className="btn primary big" onClick={() => setView('plans')}>
          🖨 Build plans
        </button>
      </header>

      <div className="main">
        <aside className="sidebar">
          <TreePanel />
          <Inspector />
        </aside>
        <div className="canvas-pane">
          <Canvas3D />

          {/* top bar: mode (with breeze in test mode) + one pill for the view */}
          <div className="canvas-topbar">
            <div className="mode-col">
              <div className="mode-toggle">
                <button className={mode === 'build' ? 'on' : ''} onClick={() => setMode('build')}>
                  🔧 Workbench
                </button>
                <button className={mode === 'test' ? 'on' : ''} onClick={() => setMode('test')}>
                  🍃 Wind test
                </button>
              </div>
              {mode === 'test' && (
                <label className="breeze">
                  Breeze
                  <input type="range" min={0} max={1} step={0.05} value={breeze} onChange={(e) => setBreeze(Number(e.target.value))} />
                </label>
              )}
            </div>
            <div className="view-pill">
              <button onClick={() => zoomTo('mobile')} title="Zoom in on the mobile">
                🔍 Mobile
              </button>
              <button onClick={() => zoomTo('room')} title="See the whole room">
                ⛶ Room
              </button>
              <span className="view-pill-divider" />
              <button
                className={showRoom ? 'on' : ''}
                onClick={() => setShowRoom(!showRoom)}
                title={showRoom ? 'Hide the room — blank space' : 'Show the 20′×20′ room'}
              >
                🏠
              </button>
            </div>
          </div>

          {/* bottom bar: scale reference and quiet guidance */}
          <div className="canvas-bottombar">
            {showRoom ? <span className="room-caption">20′ × 20′ room · 9′ ceiling · furniture true to size</span> : <span />}
            <span className="canvas-hint">
              {mode === 'build'
                ? 'Drag to look around · scroll to zoom · click a piece to edit it'
                : 'Grab any piece with the mouse and give it a push'}
            </span>
          </div>
        </div>
      </div>
      <TemplatesModal />
    </div>
  )
}
