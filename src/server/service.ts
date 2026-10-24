import { fnv1a64Hex } from '../lib/fnv'
import { EXPIRY_OPTIONS } from '../lib/protocol'
import { getConfig, type AppConfig } from './config'
import {
  burnPaste,
  checkRateLimit,
  ciphertextBase64,
  deletePasteCascade,
  getComments,
  getPaste,
  getPasteForDelete,
  insertComment,
  insertPaste,
  parentBelongsToPaste,
  type CommentRow,
  type PasteRow,
} from './db'
import {
  COLLISION,
  GENERIC_ERROR,
  INVALID_DATA,
  WRONG_TOKEN,
} from './http'
import { deleteToken, randomHex, verifyDeleteToken } from './tokens'
import { verifyTurnstile } from './turnstile'
import type { ValidComment, ValidPaste } from './validation'

export class ServiceError extends Error {
  readonly status: number
  readonly code: string
  readonly upstreamMessage: string
  readonly retryAfter?: number

  constructor(
    status: number,
    code: string,
    upstreamMessage: string,
    retryAfter?: number,
  ) {
    super(upstreamMessage)
    this.name = 'ServiceError'
    this.status = status
    this.code = code
    this.upstreamMessage = upstreamMessage
    this.retryAfter = retryAfter
  }
}

export interface ReadPasteResult {
  v: number
  adata: unknown[]
  ct: string
  meta: { time_to_live?: number }
  comments: Array<{
    id: string
    parentid: string
    adata: unknown
    ct: string
    meta: { created: number }
  }>
  comment_count: number
  comment_offset: number
  burned?: boolean
}

function notFound(): ServiceError {
  return new ServiceError(404, 'not_found', GENERIC_ERROR)
}

function invalid(): ServiceError {
  return new ServiceError(400, 'invalid_request', INVALID_DATA)
}

function parseAdata(value: string): unknown[] {
  const parsed = JSON.parse(value) as unknown
  if (!Array.isArray(parsed)) {
    throw new ServiceError(500, 'internal', 'Stored data is invalid.')
  }
  return parsed
}

function commentView(row: CommentRow): ReadPasteResult['comments'][number] {
  return {
    id: row.id,
    parentid: row.parent_id,
    adata: JSON.parse(row.adata) as unknown,
    ct: ciphertextBase64(row),
    meta: { created: row.created },
  }
}

async function enforceRateLimit(
  env: Env,
  config: AppConfig,
  route: 'create' | 'comment',
  ip: string,
): Promise<void> {
  const now = Date.now()
  const result = await checkRateLimit(
    env.DB,
    route,
    ip,
    config.rateLimitWindowSeconds,
    config.rateLimitMaxRequests,
    now,
  )
  if (!result.allowed) {
    throw new ServiceError(
      429,
      'rate_limited',
      `Please wait ${result.retryAfter} seconds between each post.`,
      result.retryAfter,
    )
  }
}

async function enforceTurnstile(
  config: AppConfig,
  token: string | undefined,
  ip: string,
): Promise<void> {
  if (!config.turnstileSecret) {
    return
  }
  if (!token || !(await verifyTurnstile(config.turnstileSecret, token, ip))) {
    throw new ServiceError(403, 'turnstile_failed', 'Turnstile verification failed.')
  }
}

export async function createPaste(
  env: Env,
  payload: ValidPaste,
  ip: string,
  turnstileToken?: string,
): Promise<{ id: string; deleteToken: string; expiresAt: number | null }> {
  const config = getConfig(env)
  await enforceRateLimit(env, config, 'create', ip)
  await enforceTurnstile(config, turnstileToken, ip)

  const now = Date.now()
  const nowSeconds = Math.floor(now / 1000)
  const expireSeconds = EXPIRY_OPTIONS[payload.expire]
  const expireDate = expireSeconds > 0 ? nowSeconds + expireSeconds : null
  const id = fnv1a64Hex(payload.ct)
  const salt = randomHex(256)
  const token = await deleteToken(id, salt)

  const inserted = await insertPaste(env.DB, {
    id,
    v: 2,
    ctBytes: payload.ctBytes,
    adataJson: payload.adataJson,
    formatter: payload.formatter,
    discussion: payload.discussion,
    burn: payload.burn,
    expireDate,
    salt,
    size: payload.ctBytes.length,
    createdAt: nowSeconds,
  })
  if (!inserted) {
    throw new ServiceError(409, 'collision', COLLISION)
  }

  return { id, deleteToken: token, expiresAt: expireDate === null ? null : expireDate * 1000 }
}

export async function readPaste(env: Env, id: string): Promise<ReadPasteResult> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const row = await getPaste(env.DB, id)
  if (!row) {
    throw notFound()
  }
  if (row.expire_date !== null && row.expire_date <= nowSeconds) {
    await deletePasteCascade(env.DB, id)
    throw notFound()
  }

  let resultRow: PasteRow = row
  let burned = false
  if (row.burn === 1) {
    const burnedRow = await burnPaste(env.DB, id)
    if (!burnedRow) {
      throw notFound()
    }
    resultRow = burnedRow
    burned = true
  }

  const adata = parseAdata(resultRow.adata)
  const meta: ReadPasteResult['meta'] = {}
  if (resultRow.expire_date !== null) {
    meta.time_to_live = Math.max(0, resultRow.expire_date - nowSeconds)
  }

  const comments = burned ? [] : (await getComments(env.DB, id)).map(commentView)
  return {
    v: resultRow.v,
    adata,
    ct: ciphertextBase64(resultRow),
    meta,
    comments,
    comment_count: comments.length,
    comment_offset: 0,
    ...(burned ? { burned: true } : {}),
  }
}

export async function deletePaste(env: Env, id: string, token: string): Promise<void> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const row = await getPasteForDelete(env.DB, id)
  if (!row) {
    throw notFound()
  }
  if (row.expire_date !== null && row.expire_date <= nowSeconds) {
    await deletePasteCascade(env.DB, id)
    throw notFound()
  }
  if (!(await verifyDeleteToken(id, row.salt, token))) {
    throw new ServiceError(403, 'forbidden', WRONG_TOKEN)
  }
  await deletePasteCascade(env.DB, id)
}

export async function createComment(
  env: Env,
  payload: ValidComment,
  ip: string,
  turnstileToken?: string,
): Promise<{ id: string; createdAt: number }> {
  const config = getConfig(env)
  await enforceRateLimit(env, config, 'comment', ip)
  await enforceTurnstile(config, turnstileToken, ip)

  const paste = await getPaste(env.DB, payload.pasteId)
  if (!paste || paste.discussion !== 1) {
    throw invalid()
  }
  const parentOk = await parentBelongsToPaste(env.DB, payload.pasteId, payload.parentId)
  if (!parentOk) {
    throw invalid()
  }

  const id = fnv1a64Hex(payload.ct)
  const created = Math.floor(Date.now() / 1000)
  const inserted = await insertComment(env.DB, {
    id,
    pasteId: payload.pasteId,
    parentId: payload.parentId,
    ctBytes: payload.ctBytes,
    adataJson: payload.adataJson,
    created,
    size: payload.ctBytes.length,
  })
  if (!inserted) {
    throw new ServiceError(409, 'collision', COLLISION)
  }
  return { id, createdAt: created * 1000 }
}
