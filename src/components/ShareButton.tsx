import { useState } from 'react'
import { useStore } from '../state/store'
import { encodeDocParam } from '../model/share'

/** Copies a link that carries the whole design in its URL. On phones with a
 *  native share sheet, opens that instead. */
export function ShareButton({ className = 'btn' }: { className?: string }) {
  const doc = useStore((s) => s.doc)
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  const share = async () => {
    const param = await encodeDocParam(doc)
    const url = `${window.location.origin}${window.location.pathname}#d=${param}`
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: `${doc.name} — Mobile Maker`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setState('copied')
    } catch {
      // clipboard denied (or share dismissed): show the link for manual copy
      window.prompt('Copy this link:', url)
      setState('idle')
      return
    }
    setTimeout(() => setState('idle'), 2000)
  }

  return (
    <button className={className} onClick={() => void share()}>
      {state === 'copied' ? '✓ Link copied!' : '🔗 Share'}
    </button>
  )
}
