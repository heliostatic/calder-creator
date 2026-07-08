import { useEffect, useRef } from 'react'
import { SceneManager } from '../three/SceneManager'
import { useStore } from '../state/store'

export function Canvas3D() {
  const holder = useRef<HTMLDivElement>(null)
  const manager = useRef<SceneManager | null>(null)

  const doc = useStore((s) => s.doc)
  const mode = useStore((s) => s.mode)
  const breeze = useStore((s) => s.breeze)
  const showRoom = useStore((s) => s.showRoom)
  const selectedId = useStore((s) => s.selectedId)
  const select = useStore((s) => s.select)

  useEffect(() => {
    if (!holder.current) return
    const m = new SceneManager(holder.current)
    m.onPick = (id) => useStore.getState().select(id)
    manager.current = m
    return () => {
      m.dispose()
      manager.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    manager.current?.setDoc(doc)
  }, [doc])
  useEffect(() => {
    manager.current?.setMode(mode)
  }, [mode])
  useEffect(() => {
    manager.current?.setBreeze(breeze)
  }, [breeze])
  useEffect(() => {
    manager.current?.setRoomVisible(showRoom)
  }, [showRoom])
  const zoomRequest = useStore((s) => s.zoomRequest)
  useEffect(() => {
    if (zoomRequest) manager.current?.frameView(zoomRequest.view)
  }, [zoomRequest])
  useEffect(() => {
    manager.current?.setSelected(selectedId)
  }, [selectedId])

  // deselect helper is used by onPick above; reference select to satisfy lint
  void select

  return <div ref={holder} className="canvas3d" />
}
