import {
  base64ToBytes,
  blobPart,
  bufferSource,
  bytesToBase64,
  concatBytes,
  randomBytes,
  upstreamStringToBytes,
  utf8Decode,
  utf8Encode,
} from './binary'
import { base58Decode, base58Encode } from './base58'
import {
  DEFAULT_ITERATIONS,
  DEFAULT_IV_BYTES,
  DEFAULT_KEY_SIZE,
  DEFAULT_SALT_BYTES,
  DEFAULT_TAG_SIZE,
  MAX_DECOMPRESSED_BYTES,
  parseSpec,
  type CipherMode,
  type CipherSpec,
  type CommentPayload,
  type CommentRequest,
  type Compression,
  type ExpireKey,
  type Formatter,
  type PasteAdata,
  type PastePayload,
  type PasteRequest,
  isFormatter,
} from './protocol'

export type CryptoErrorCode =
  | 'auth'
  | 'decrypt'
  | 'compression'
  | 'unsupported'
  | 'invalid'

export class CryptoError extends Error {
  readonly code: CryptoErrorCode

  constructor(code: CryptoErrorCode, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'CryptoError'
    this.code = code
  }
}

export interface CreatePasteOptions {
  password?: string
  expire?: ExpireKey
  formatter?: Formatter
  discussion?: boolean
  burn?: boolean
  iterations?: number
  ivLength?: number
  saltLength?: number
  keySize?: number
  tagSize?: number
  mode?: CipherMode
  compression?: Compression
  keyBytes?: Uint8Array
  attachments?: Array<{ name: string; dataUrl: string }>
  children?: string[]
}

export interface CreatePasteResult {
  request: PasteRequest
  keyBase58: string
  keyBytes: Uint8Array
}

export interface CreateCommentOptions {
  password?: string
  iterations?: number
  ivLength?: number
  saltLength?: number
  keySize?: number
  tagSize?: number
  mode?: CipherMode
  compression?: Compression
}

export interface CreateCommentResult {
  request: CommentRequest
}

export interface DecryptedMessage {
  plaintext: string
  adata: unknown[]
  spec: CipherSpec
  mode: CipherMode
  formatter?: Formatter
}

export function generateKey(): { bytes: Uint8Array; keyBase58: string } {
  const bytes = randomBytes(32)
  return { bytes, keyBase58: base58Encode(bytes) }
}

export function decodeKey(keyBase58: string): Uint8Array {
  let bytes: Uint8Array
  try {
    bytes = base58Decode(keyBase58)
  } catch (error) {
    throw new CryptoError('invalid', 'Invalid key fragment', error)
  }
  if (bytes.length > 32 || bytes.length === 0) {
    throw new CryptoError('invalid', 'Invalid key length')
  }
  if (bytes.length === 32) {
    return bytes
  }
  const padded = new Uint8Array(32)
  padded.set(bytes, 32 - bytes.length)
  return padded
}

export function buildSpec(options: {
  ivLength?: number
  saltLength?: number
  iterations?: number
  keySize?: number
  tagSize?: number
  mode?: CipherMode
  compression?: Compression
} = {}): CipherSpec {
  const ivLength = options.ivLength ?? DEFAULT_IV_BYTES
  const saltLength = options.saltLength ?? DEFAULT_SALT_BYTES
  const iterations = options.iterations ?? DEFAULT_ITERATIONS
  const keySize = options.keySize ?? DEFAULT_KEY_SIZE
  const tagSize = options.tagSize ?? DEFAULT_TAG_SIZE
  const mode = options.mode ?? 'gcm'
  const compression =
    options.compression ?? (typeof CompressionStream === 'undefined' ? 'none' : 'zlib')

  return [
    bytesToBase64(randomBytes(ivLength)),
    bytesToBase64(randomBytes(saltLength)),
    iterations,
    keySize,
    tagSize,
    'aes',
    mode,
    compression,
  ]
}

export async function deriveKey(
  keyBytes: Uint8Array,
  password: string,
  spec: CipherSpec,
): Promise<CryptoKey> {
  const material = concatBytes(keyBytes, upstreamStringToBytes(password))
  const imported = await crypto.subtle.importKey(
    'raw',
    bufferSource(material),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  const algorithm =
    spec[6] === 'gcm' ? 'AES-GCM' : spec[6] === 'ctr' ? 'AES-CTR' : 'AES-CBC'
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: bufferSource(base64ToBytes(spec[1])),
      iterations: spec[2],
      hash: 'SHA-256',
    },
    imported,
    { name: algorithm, length: spec[3] },
    false,
    ['encrypt', 'decrypt'],
  )
}

function encryptionParams(
  spec: CipherSpec,
  additionalData: Uint8Array,
): AesGcmParams | AesCtrParams | AesCbcParams {
  const iv = base64ToBytes(spec[0])
  if (spec[6] === 'gcm') {
    return {
      name: 'AES-GCM',
      iv: bufferSource(iv),
      additionalData: bufferSource(additionalData),
      tagLength: spec[4],
    }
  }
  if (spec[6] === 'ctr') {
    return { name: 'AES-CTR', counter: bufferSource(iv), length: 128 }
  }
  return { name: 'AES-CBC', iv: bufferSource(iv) }
}

async function deflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof CompressionStream === 'undefined') {
    throw new CryptoError('compression', 'This browser does not support DEFLATE compression')
  }
  const stream = new Blob([blobPart(data)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new CryptoError('unsupported', 'This browser cannot decompress this document')
  }
  const stream = new Blob([blobPart(data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      total += value.length
      if (total > MAX_DECOMPRESSED_BYTES) {
        throw new CryptoError('compression', 'Decompressed document is too large')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  return concatBytes(...chunks)
}

export async function encryptMessage(
  keyBytes: Uint8Array,
  password: string,
  message: string,
  adata: unknown[],
  spec: CipherSpec,
): Promise<string> {
  const plaintext = utf8Encode(message)
  const compressed = spec[7] === 'zlib' ? await deflateRaw(plaintext) : plaintext
  const additionalData = upstreamStringToBytes(JSON.stringify(adata))
  const key = await deriveKey(keyBytes, password, spec)
  const ciphertext = await crypto.subtle.encrypt(
    encryptionParams(spec, additionalData),
    key,
    bufferSource(compressed),
  )
  return bytesToBase64(new Uint8Array(ciphertext))
}

export async function decryptMessage(
  keyBase58: string,
  password: string,
  ciphertext: string,
  adata: unknown,
): Promise<DecryptedMessage> {
  if (!Array.isArray(adata)) {
    throw new CryptoError('invalid', 'Invalid authenticated data')
  }
  const spec = Array.isArray(adata[0]) ? parseSpec(adata[0]) : parseSpec(adata)
  if (!spec) {
    throw new CryptoError('invalid', 'Unsupported cipher parameters')
  }

  let key: CryptoKey
  try {
    key = await deriveKey(decodeKey(keyBase58), password, spec)
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error
    }
    throw new CryptoError('invalid', 'Could not derive the decryption key', error)
  }

  let decrypted: ArrayBuffer
  try {
    decrypted = await crypto.subtle.decrypt(
      encryptionParams(spec, upstreamStringToBytes(JSON.stringify(adata))),
      key,
      bufferSource(base64ToBytes(ciphertext)),
    )
  } catch (error) {
    if (spec[6] === 'gcm') {
      throw new CryptoError('auth', 'Wrong password or corrupted document', error)
    }
    throw new CryptoError('decrypt', 'Could not decrypt the document', error)
  }

  let compressed: Uint8Array
  try {
    compressed = spec[7] === 'zlib'
      ? await inflateRaw(new Uint8Array(decrypted))
      : new Uint8Array(decrypted)
  } catch (error) {
    if (error instanceof CryptoError) {
      throw error
    }
    throw new CryptoError('compression', 'Could not decompress the document', error)
  }

  let plaintext: string
  try {
    plaintext = utf8Decode(compressed)
  } catch (error) {
    if (spec[6] === 'gcm') {
      throw new CryptoError('decrypt', 'Could not decode the document', error)
    }
    throw new CryptoError('auth', 'Wrong password or corrupted legacy document', error)
  }

  return {
    plaintext,
    adata,
    spec,
    mode: spec[6],
    formatter: isFormatter(adata[1]) ? adata[1] : undefined,
  }
}

export async function createPasteCipher(
  paste: string,
  options: CreatePasteOptions = {},
): Promise<CreatePasteResult> {
  const key = options.keyBytes ? { bytes: options.keyBytes, keyBase58: base58Encode(options.keyBytes) } : generateKey()
  const spec = buildSpec(options)
  const format = options.formatter ?? 'plaintext'
  const adata: PasteAdata = [
    spec,
    format,
    options.discussion ? 1 : 0,
    options.burn ? 1 : 0,
  ]
  const payload: PastePayload = { paste }
  if (options.attachments && options.attachments.length > 0) {
    payload.attachment = options.attachments.map((attachment) => attachment.dataUrl)
    payload.attachment_name = options.attachments.map((attachment) => attachment.name)
  }
  if (options.children && options.children.length > 0) {
    payload.children = options.children
  }
  const ct = await encryptMessage(
    key.bytes,
    options.password ?? '',
    JSON.stringify(payload),
    adata,
    spec,
  )
  return {
    request: {
      v: 2,
      adata,
      ct,
      meta: { expire: options.expire ?? '1week' },
    },
    keyBase58: key.keyBase58,
    keyBytes: key.bytes,
  }
}

export async function createCommentCipher(
  comment: string,
  nickname: string,
  pasteId: string,
  parentId: string,
  keyBytes: Uint8Array,
  options: CreateCommentOptions = {},
): Promise<CreateCommentResult> {
  const spec = buildSpec(options)
  const payload: CommentPayload = { comment }
  if (nickname.length > 0) {
    payload.nickname = nickname
  }
  const ct = await encryptMessage(
    keyBytes,
    options.password ?? '',
    JSON.stringify(payload),
    spec,
    spec,
  )
  return {
    request: {
      v: 2,
      adata: spec,
      ct,
      pasteid: pasteId,
      parentid: parentId,
    },
  }
}

export function parsePastePayload(value: unknown): PastePayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CryptoError('invalid', 'Invalid paste payload')
  }
  const record = value as Record<string, unknown>
  if (typeof record.paste !== 'string') {
    throw new CryptoError('invalid', 'Invalid paste payload')
  }
  const payload: PastePayload = { paste: record.paste }
  if (Array.isArray(record.attachment)) {
    payload.attachment = record.attachment.filter((item): item is string => typeof item === 'string')
  } else if (typeof record.attachment === 'string') {
    payload.attachment = record.attachment
  }
  if (Array.isArray(record.attachment_name)) {
    payload.attachment_name = record.attachment_name.filter(
      (item): item is string => typeof item === 'string',
    )
  } else if (typeof record.attachment_name === 'string') {
    payload.attachment_name = record.attachment_name
  }
  if (Array.isArray(record.children)) {
    payload.children = record.children.filter((item): item is string => typeof item === 'string')
  }
  return payload
}

export function parseCommentPayload(value: unknown): CommentPayload {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CryptoError('invalid', 'Invalid comment payload')
  }
  const record = value as Record<string, unknown>
  if (typeof record.comment !== 'string') {
    throw new CryptoError('invalid', 'Invalid comment payload')
  }
  return {
    comment: record.comment,
    nickname: typeof record.nickname === 'string' ? record.nickname : undefined,
  }
}
