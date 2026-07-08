import { useRef } from 'react'
import { useStore } from '../state/store'
import { Canvas3D } from './Canvas3D'
import { TreePanel } from './TreePanel'
import { Inspector } from './Inspector'
import { PlansView } from './PlansView'
import { TemplatesModal } from './TemplatesModal'
import type { MobileDoc } from '../model/types'

export function App() {
  const view = useStore((s) => s.view)
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
          <div className="mode-overlay">
            <div className="mode-toggle">
              <button className={mode === 'build' ? 'on' : ''} onClick={() => setMode('build')}>
                🔧 Workbench
              </button>
              <button className={mode === 'test' ? 'on' : ''} onClick={() => setMode('test')}>
                🍃 Wind test
              </button>
            </div>
            {mode === 'test' ? (
              <label className="breeze">
                Breeze
                <input type="range" min={0} max={1} step={0.05} value={breeze} onChange={(e) => setBreeze(Number(e.target.value))} />
              </label>
            ) : (
              <span className="canvas-hint">Drag with the mouse to look around · scroll to zoom · click a piece to edit it</span>
            )}
            {mode === 'test' && <span className="canvas-hint">Grab any piece with the mouse and give it a push</span>}
          </div>
        </div>
      </div>
      <TemplatesModal />
    </div>
  )
}
