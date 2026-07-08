import { create } from 'zustand'
import type { ArmNode, MobileDoc, MobileNode, ShapeNode } from '../model/types'
import { findNode, findParent, mapTree, newId } from '../model/types'
import { balanceAll } from '../model/balance'
import { TEMPLATES } from '../model/templates'

export type Mode = 'build' | 'test'
export type View = 'editor' | 'plans'
export type MobileVariant = 'viewer' | 'drawer' | 'tabs'

/** Phone layout: picked by URL param (?mobile=viewer|drawer|tabs|off) for
 *  testing, otherwise on for small screens. */
export function detectMobileVariant(): MobileVariant | null {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search).get('mobile')
  if (p === 'off') return null
  if (p === 'viewer' || p === 'drawer' || p === 'tabs') return p
  return window.matchMedia('(max-width: 719px)').matches ? 'viewer' : null
}

const STORAGE_KEY = 'calder-creator-doc-v1'

interface Store {
  doc: MobileDoc
  selectedId: string | null
  mode: Mode
  view: View
  /** 0..1 breeze strength for test mode */
  breeze: number
  /** show the 20'×20' room backdrop, or a blank space */
  showRoom: boolean
  /** preset-camera request; the nonce makes repeat clicks re-fire */
  zoomRequest: { view: 'room' | 'mobile'; n: number } | null
  templatesOpen: boolean
  past: MobileDoc[]
  future: MobileDoc[]

  setDoc: (doc: MobileDoc, recordHistory?: boolean) => void
  updateDoc: (patch: Partial<MobileDoc>) => void
  updateNode: (id: string, patch: Partial<ArmNode> | Partial<ShapeNode>) => void
  splitShape: (id: string) => void
  removeNode: (id: string) => void
  balanceNow: () => void
  select: (id: string | null) => void
  setMode: (m: Mode) => void
  setView: (v: View) => void
  setBreeze: (b: number) => void
  setShowRoom: (v: boolean) => void
  zoomTo: (view: 'room' | 'mobile') => void
  setTemplatesOpen: (open: boolean) => void
  /** bulk material editing across the whole mobile */
  setAllShapes: (patch: Partial<Pick<ShapeNode, 'wood' | 'thickness'>>) => void
  setAllWire: (wire: ArmNode['wire']) => void
  loadTemplate: (key: string) => void
  undo: () => void
  redo: () => void
}

function initialDoc(): MobileDoc {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const doc = JSON.parse(raw) as MobileDoc
      if (doc && doc.version === 1 && doc.root) return doc
    }
  } catch {
    // fall through to template
  }
  return TEMPLATES[1].make() // Classic Cascade — never start with a blank screen
}

function rebalance(doc: MobileDoc): MobileDoc {
  return doc.autoBalance ? balanceAll(doc) : doc
}

export const useStore = create<Store>((set, get) => {
  const commit = (doc: MobileDoc) => {
    const { doc: prev, past } = get()
    set({ doc, past: [...past.slice(-49), prev], future: [] })
  }

  return {
    doc: initialDoc(),
    selectedId: null,
    mode: 'build',
    view: 'editor',
    breeze: 0.35,
    showRoom: true,
    zoomRequest: null,
    templatesOpen: false,
    past: [],
    future: [],

    setDoc: (doc, recordHistory = true) => {
      if (recordHistory) commit(doc)
      else set({ doc })
    },

    updateDoc: (patch) => {
      commit(rebalance({ ...get().doc, ...patch }))
    },

    updateNode: (id, patch) => {
      const doc = get().doc
      const root = mapTree(doc.root, (n) => (n.id === id ? ({ ...n, ...patch } as MobileNode) : n))
      commit(rebalance({ ...doc, root }))
    },

    splitShape: (id) => {
      const doc = get().doc
      const target = findNode(doc.root, id)
      if (!target || target.kind !== 'shape') return
      const newShape: ShapeNode = {
        kind: 'shape',
        id: newId(),
        shape: 'circle',
        width: 3,
        height: 3,
        wood: target.wood,
        thickness: target.thickness,
        color: '#ffc907',
      }
      const newArm: ArmNode = {
        kind: 'arm',
        id: newId(),
        length: 9,
        pivot: 4.5,
        pivotHeight: 0.75,
        wire: 'steel16',
        dropLeft: 2,
        dropRight: 2,
        left: { ...target },
        right: newShape,
      }
      const root = mapTree(doc.root, (n) => (n.id === id ? newArm : n))
      commit(rebalance({ ...doc, root }))
      set({ selectedId: newArm.id })
    },

    removeNode: (id) => {
      const doc = get().doc
      const parent = findParent(doc.root, id)
      if (!parent) {
        // removing the root: collapse to one of its shapes, or do nothing for a lone shape
        if (doc.root.kind === 'arm' && doc.root.id === id) {
          const keep = doc.root.left
          commit(rebalance({ ...doc, root: keep }))
          set({ selectedId: null })
        }
        return
      }
      const sibling = parent.left.id === id ? parent.right : parent.left
      const root = mapTree(doc.root, (n) => (n.id === parent.id ? sibling : n))
      commit(rebalance({ ...doc, root }))
      set({ selectedId: null })
    },

    balanceNow: () => {
      commit(balanceAll(get().doc))
    },

    select: (id) => set({ selectedId: id }),
    setMode: (mode) => set({ mode }),
    setView: (view) => set({ view }),
    setBreeze: (breeze) => set({ breeze }),
    setShowRoom: (showRoom) => set({ showRoom }),
    zoomTo: (view) => set({ zoomRequest: { view, n: (get().zoomRequest?.n ?? 0) + 1 } }),
    setTemplatesOpen: (templatesOpen) => set({ templatesOpen }),

    setAllShapes: (patch) => {
      const doc = get().doc
      const root = mapTree(doc.root, (n) => (n.kind === 'shape' ? { ...n, ...patch } : n))
      commit(rebalance({ ...doc, root }))
    },

    setAllWire: (wire) => {
      const doc = get().doc
      const root = mapTree(doc.root, (n) => (n.kind === 'arm' ? { ...n, wire } : n))
      commit(rebalance({ ...doc, root }))
    },

    loadTemplate: (key) => {
      const entry = TEMPLATES.find((t) => t.key === key)
      if (!entry) return
      commit(entry.make())
      set({ selectedId: null, templatesOpen: false, view: 'editor' })
    },

    undo: () => {
      const { past, doc, future } = get()
      if (!past.length) return
      const prev = past[past.length - 1]
      set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future].slice(0, 50), selectedId: null })
    },

    redo: () => {
      const { past, doc, future } = get()
      if (!future.length) return
      const next = future[0]
      set({ doc: next, past: [...past, doc].slice(-50), future: future.slice(1), selectedId: null })
    },
  }
})

// autosave (debounced)
let saveTimer: ReturnType<typeof setTimeout> | undefined
useStore.subscribe((state) => {
  clearTimeout(saveTimer)
  const doc = state.doc
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(doc))
    } catch {
      // storage full/unavailable — nothing sensible to do
    }
  }, 400)
})
