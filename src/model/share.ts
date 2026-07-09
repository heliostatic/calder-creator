import type { MobileDoc } from './types'

// Designs travel inside the URL hash: #d=<format><base64url payload>.
// Format 'z' is deflate-compressed JSON (a few hundred characters for a
// typical mobile); 'j' is plain JSON for environments without the
// CompressionStream API. No server involved — the link IS the design.

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function pipeThrough(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const readable = new Blob([bytes as BlobPart]).stream().pipeThrough(stream)
  const buf = await new Response(readable).arrayBuffer()
  return new Uint8Array(buf)
}

/** Encode a design into a URL-hash payload. */
export async function encodeDocParam(doc: MobileDoc): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(doc))
  if (typeof CompressionStream !== 'undefined') {
    const compressed = await pipeThrough(json, new CompressionStream('deflate-raw'))
    return 'z' + toBase64Url(compressed)
  }
  return 'j' + toBase64Url(json)
}

/** Decode a URL-hash payload back into a design; null if it isn't one. */
export async function decodeDocParam(param: string): Promise<MobileDoc | null> {
  try {
    const format = param[0]
    const bytes = fromBase64Url(param.slice(1))
    let json: Uint8Array
    if (format === 'z') {
      if (typeof DecompressionStream === 'undefined') return null
      json = await pipeThrough(bytes, new DecompressionStream('deflate-raw'))
    } else if (format === 'j') {
      json = bytes
    } else {
      return null
    }
    const doc = JSON.parse(new TextDecoder().decode(json)) as MobileDoc
    if (!doc || doc.version !== 1 || !doc.root) return null
    return doc
  } catch {
    return null
  }
}

/** The payload from a location.hash like "#d=...", or null. */
export function shareParamFromHash(hash: string): string | null {
  const m = /^#d=(.+)$/.exec(hash)
  return m ? m[1] : null
}
