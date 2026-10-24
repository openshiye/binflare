import { base64ToBytes } from '../lib/binary'
import {
  DEFAULT_EXPIRE,
  FORMATTERS,
  isExpireKey,
  isFormatter,
  isPasteId,
  parseSpec,
  type CipherSpec,
  type ExpireKey,
  type Formatter,
} from '../lib/protocol'
import type { AppConfig } from './config'
import { formatBytes } from './config'

export class ValidationError extends Error {
  readonly code: 'invalid' | 'too_large'

  constructor(code: 'invalid' | 'too_large', message: string) {
    super(message)
    this.name = 'ValidationError'
    this.code = code
  }
}

export interface ValidPaste {
  v: 2
  adata: unknown[]
  adataJson: string
  ct: string
  ctBytes: Uint8Array
  formatter: Formatter
  discussion: 0 | 1
  burn: 0 | 1
  expire: ExpireKey
}

export interface ValidComment {
  v: 2
  adata: unknown[]
  adataJson: string
  ct: string
  ctBytes: Uint8Array
  pasteId: string
  parentId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
}

export function isJsonApiCall(request: Request): boolean {
  if (request.headers.get('x-requested-with') === 'JSONHttpRequest') {
    return true
  }
  const accept = request.headers.get('accept')
  return Boolean(
    accept &&
      accept.includes('application/json') &&
      !accept.includes('text/html') &&
      !accept.includes('application/xhtml'),
  )
}

function decodeBase64(value: string, field: string): Uint8Array {
  try {
    return base64ToBytes(value)
  } catch {
    throw new ValidationError('invalid', `Invalid data. (${field})`)
  }
}

function validateSpec(value: unknown): CipherSpec {
  const spec = parseSpec(value)
  if (!spec) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (spec[0].length > 24 || spec[1].length > 14) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  decodeBase64(spec[0], 'iv')
  decodeBase64(spec[1], 'salt')
  return spec
}

function validateCiphertext(value: unknown, config: AppConfig): { ct: string; bytes: Uint8Array } {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (value.length > config.maxCtBase64) {
    throw new ValidationError(
      'too_large',
      `Document is limited to ${formatBytes(config.maxCtBytes)} of encrypted data.`,
    )
  }
  const bytes = decodeBase64(value, 'ct')
  if (bytes.length === 0) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (bytes.length > config.maxCtBytes) {
    throw new ValidationError(
      'too_large',
      `Document is limited to ${formatBytes(config.maxCtBytes)} of encrypted data.`,
    )
  }
  return { ct: value, bytes }
}

export function validatePasteRequest(value: unknown, config: AppConfig): ValidPaste {
  if (!isRecord(value) || !hasExactKeys(value, ['adata', 'v', 'ct', 'meta'])) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  const v = value.v
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 2) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (!Array.isArray(value.adata) || value.adata.length < 4) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  const spec = validateSpec(value.adata[0])
  const adata = value.adata
  const formatter = adata[1]
  const discussion = adata[2]
  const burn = adata[3]
  if (!isFormatter(formatter) || !FORMATTERS.includes(formatter)) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (discussion !== 0 && discussion !== 1) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (burn !== 0 && burn !== 1) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (burn === 1 && discussion === 1) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (!isRecord(value.meta) || !hasExactKeys(value.meta, ['expire'])) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  const expire = isExpireKey(value.meta.expire) ? value.meta.expire : DEFAULT_EXPIRE
  const { ct, bytes } = validateCiphertext(value.ct, config)
  // The spec is validated but its exact values are preserved in adataJson.
  void spec

  return {
    v: 2,
    adata,
    adataJson: JSON.stringify(adata),
    ct,
    ctBytes: bytes,
    formatter,
    discussion,
    burn,
    expire,
  }
}

export function validateCommentRequest(value: unknown, config: AppConfig): ValidComment {
  if (!isRecord(value) || !hasExactKeys(value, ['adata', 'v', 'ct', 'pasteid', 'parentid'])) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  const v = value.v
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 2) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  if (!Array.isArray(value.adata)) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  validateSpec(value.adata)
  if (!isPasteId(value.pasteid) || !isPasteId(value.parentid)) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  const { ct, bytes } = validateCiphertext(value.ct, config)
  return {
    v: 2,
    adata: value.adata,
    adataJson: JSON.stringify(value.adata),
    ct,
    ctBytes: bytes,
    pasteId: value.pasteid,
    parentId: value.parentid,
  }
}

export function validateId(value: unknown): string {
  if (!isPasteId(value)) {
    throw new ValidationError('invalid', 'Invalid document ID.')
  }
  return value
}

export function validateDeleteToken(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
    throw new ValidationError('invalid', 'Invalid data.')
  }
  return value
}

export function isCommentBody(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.pasteid === 'string' &&
    value.pasteid.length > 0 &&
    typeof value.parentid === 'string' &&
    value.parentid.length > 0
  )
}
