export const EXPIRY_OPTIONS = {
  '5min': 300,
  '10min': 600,
  '1hour': 3600,
  '1day': 86400,
  '1week': 604800,
  '1month': 2592000,
  '1year': 31536000,
  never: 0,
} as const

export type ExpireKey = keyof typeof EXPIRY_OPTIONS
export type Formatter = 'plaintext' | 'markdown' | 'syntaxhighlighting'
export type CipherMode = 'gcm' | 'ctr' | 'cbc'
export type Compression = 'zlib' | 'none'

export const DEFAULT_EXPIRE: ExpireKey = '1week'
export const DEFAULT_FORMATTER: Formatter = 'plaintext'
export const FORMATTERS: Formatter[] = ['plaintext', 'markdown', 'syntaxhighlighting']
export const MAX_CT_BYTES = 1_875_000
export const MAX_CT_BASE64 = 2_500_000
export const MAX_DECOMPRESSED_BYTES = 4 * 1024 * 1024
export const DEFAULT_ITERATIONS = 100_000
export const DEFAULT_KEY_SIZE = 256
export const DEFAULT_TAG_SIZE = 128
export const DEFAULT_IV_BYTES = 16
export const DEFAULT_SALT_BYTES = 8
export const PASTE_ID_PATTERN = /^[a-f0-9]{16}$/

export type CipherSpec = [
  string,
  string,
  number,
  number,
  number,
  'aes',
  CipherMode,
  Compression,
]

export type PasteAdata = [CipherSpec, Formatter, 0 | 1, 0 | 1]

export interface PasteRequest {
  v: number
  adata: PasteAdata
  ct: string
  meta: { expire: ExpireKey }
}

export interface CommentRequest {
  v: number
  adata: CipherSpec
  ct: string
  pasteid: string
  parentid: string
}

export interface PastePayload {
  paste: string
  attachment?: string[] | string
  attachment_name?: string[] | string
  children?: string[]
}

export interface CommentPayload {
  comment: string
  nickname?: string
}

export function isExpireKey(value: unknown): value is ExpireKey {
  return typeof value === 'string' && Object.hasOwn(EXPIRY_OPTIONS, value)
}

export function isFormatter(value: unknown): value is Formatter {
  return typeof value === 'string' && FORMATTERS.includes(value as Formatter)
}

export function isPasteId(value: unknown): value is string {
  return typeof value === 'string' && PASTE_ID_PATTERN.test(value)
}

export function parseSpec(value: unknown): CipherSpec | null {
  if (!Array.isArray(value) || value.length < 8) {
    return null
  }
  const [iv, salt, iterations, keySize, tagSize, alg, mode, compression] = value
  if (typeof iv !== 'string' || typeof salt !== 'string') {
    return null
  }
  if (!Number.isInteger(iterations) || iterations <= 10_000) {
    return null
  }
  if (![128, 192, 256].includes(keySize)) {
    return null
  }
  if (![64, 96, 128].includes(tagSize)) {
    return null
  }
  if (alg !== 'aes') {
    return null
  }
  if (mode !== 'ctr' && mode !== 'cbc' && mode !== 'gcm') {
    return null
  }
  if (compression !== 'zlib' && compression !== 'none') {
    return null
  }
  return [iv, salt, iterations, keySize, tagSize, 'aes', mode, compression]
}

export function specFromPasteAdata(adata: unknown): CipherSpec | null {
  if (!Array.isArray(adata)) {
    return null
  }
  return parseSpec(adata[0])
}

export function specFromCommentAdata(adata: unknown): CipherSpec | null {
  return parseSpec(adata)
}
