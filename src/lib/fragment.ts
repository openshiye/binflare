import { base58Decode } from './base58'
import { isPasteId } from './protocol'

const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]+$/

export interface PasteTarget {
  id: string
  key: string
  burn: boolean
}

export interface FragmentKey {
  key: string
  burn: boolean
}

export function parseFragment(hash: string): FragmentKey | null {
  let value = hash.startsWith('#') ? hash.slice(1) : hash
  const suffix = value.indexOf('&')
  if (suffix !== -1) {
    value = value.slice(0, suffix)
  }
  let burn = false
  if (value.startsWith('-')) {
    burn = true
    value = value.slice(1)
  }
  if (value.length === 0 || !BASE58_PATTERN.test(value)) {
    return null
  }
  try {
    const bytes = base58Decode(value)
    if (bytes.length === 0 || bytes.length > 32) {
      return null
    }
  } catch {
    return null
  }
  return { key: value, burn }
}

export function readPasteTarget(search: string, hash: string): PasteTarget | null {
  const fragment = parseFragment(hash)
  if (!fragment) {
    return null
  }
  const params = new URLSearchParams(search)
  const direct = params.get('pasteid')
  let id: string | null = null
  if (direct) {
    id = direct
  } else {
    for (const [candidate, value] of params) {
      if (value === '' && isPasteId(candidate)) {
        id = candidate
        break
      }
    }
  }
  if (!id || !isPasteId(id)) {
    return null
  }
  return { id, key: fragment.key, burn: fragment.burn }
}

export function readPublicPasteId(search: string): string | null {
  const params = new URLSearchParams(search)
  const direct = params.get('pasteid')
  if (direct && isPasteId(direct)) {
    return direct
  }
  for (const [candidate, value] of params) {
    if (value === '' && isPasteId(candidate)) {
      return candidate
    }
  }
  return null
}

export function readDeleteTarget(search: string): { id: string; token: string } | null {
  const params = new URLSearchParams(search)
  const id = params.get('pasteid')
  const token = params.get('deletetoken')
  if (!id || !isPasteId(id) || !token || !/^[a-f0-9]{64}$/.test(token)) {
    return null
  }
  return { id, token }
}

export function buildPasteUrl(pathname: string, id: string, key: string, burn: boolean): string {
  const base = pathname.endsWith('/') ? pathname : `${pathname}/`
  return `${base}?${id}#${burn ? '-' : ''}${key}`
}

export function buildDeleteUrl(pathname: string, id: string, token: string): string {
  const base = pathname.endsWith('/') ? pathname : `${pathname}/`
  return `${base}?pasteid=${encodeURIComponent(id)}&deletetoken=${encodeURIComponent(token)}`
}
