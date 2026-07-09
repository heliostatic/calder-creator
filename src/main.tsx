import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './components/App'
import { useStore } from './state/store'
import { decodeDocParam, shareParamFromHash } from './model/share'
import './styles.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// a shared design in the URL becomes the working copy (it's meant to be
// opened, admired, and tweaked); the hash is then cleared so edits don't
// masquerade as the original link
const shared = shareParamFromHash(window.location.hash)
if (shared) {
  void decodeDocParam(shared).then((doc) => {
    if (!doc) return
    useStore.getState().setDoc(doc)
    useStore.getState().select(null)
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  })
}
