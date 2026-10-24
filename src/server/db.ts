import { bytesToBase64 } from '../lib/binary'
import { sha256Hex } from './tokens'

export interface PasteRow {
  id: string
  v: number
  ct: ArrayBuffer | Uint8Array
  adata: string
  formatter: string
  discussion: number
  burn: number
  expire_date: number | null
  salt: string
  size: number
  created_at: number
  r2_key: string | null
}

export interface CommentRow {
  id: string
  paste_id: string
  parent_id: string
  ct: ArrayBuffer | Uint8Array
  adata: string
  created: number
  size: number
}

function bytesOf(value: ArrayBuffer | Uint8Array): Uint8Array {
  return value instanceof Uint8Array
    ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    : new Uint8Array(value)
}

export function ciphertextBase64(row: { ct: ArrayBuffer | Uint8Array }): string {
  return bytesToBase64(bytesOf(row.ct))
}

export async function getPaste(db: D1Database, id: string): Promise<PasteRow | null> {
  return db
    .prepare(
      'SELECT id, v, ct, adata, formatter, discussion, burn, expire_date, salt, size, created_at, r2_key FROM pastes WHERE id = ?',
    )
    .bind(id)
    .first<PasteRow>()
}

export async function getPasteForDelete(
  db: D1Database,
  id: string,
): Promise<Pick<PasteRow, 'id' | 'salt' | 'expire_date' | 'r2_key'> | null> {
  return db
    .prepare('SELECT id, salt, expire_date, r2_key FROM pastes WHERE id = ?')
    .bind(id)
    .first<Pick<PasteRow, 'id' | 'salt' | 'expire_date' | 'r2_key'>>()
}

export async function insertPaste(
  db: D1Database,
  record: {
    id: string
    v: number
    ctBytes: Uint8Array
    adataJson: string
    formatter: string
    discussion: number
    burn: number
    expireDate: number | null
    salt: string
    size: number
    createdAt: number
    r2Key: string | null
  },
): Promise<boolean> {
  try {
    await db
      .prepare(
        'INSERT INTO pastes (id, v, ct, adata, formatter, discussion, burn, expire_date, salt, size, created_at, r2_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .bind(
        record.id,
        record.v,
        record.ctBytes.buffer,
        record.adataJson,
        record.formatter,
        record.discussion,
        record.burn,
        record.expireDate,
        record.salt,
        record.size,
        record.createdAt,
        record.r2Key,
      )
      .run()
    return true
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) {
      return false
    }
    throw error
  }
}

export async function getComments(db: D1Database, pasteId: string): Promise<CommentRow[]> {
  const result = await db
    .prepare('SELECT id, paste_id, parent_id, ct, adata, created, size FROM comments WHERE paste_id = ? ORDER BY created ASC, id ASC')
    .bind(pasteId)
    .all<CommentRow>()
  return result.results ?? []
}

export async function parentBelongsToPaste(
  db: D1Database,
  pasteId: string,
  parentId: string,
): Promise<boolean> {
  if (parentId === pasteId) {
    return true
  }
  const row = await db
    .prepare('SELECT id FROM comments WHERE id = ? AND paste_id = ?')
    .bind(parentId, pasteId)
    .first<{ id: string }>()
  return Boolean(row)
}

export async function insertComment(
  db: D1Database,
  record: {
    id: string
    pasteId: string
    parentId: string
    ctBytes: Uint8Array
    adataJson: string
    created: number
    size: number
  },
): Promise<boolean> {
  try {
    const result = await db
      .prepare(
        'INSERT INTO comments (id, paste_id, parent_id, ct, adata, created, size) SELECT ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM pastes WHERE id = ? AND discussion = 1)',
      )
      .bind(
        record.id,
        record.pasteId,
        record.parentId,
        record.ctBytes.buffer,
        record.adataJson,
        record.created,
        record.size,
        record.pasteId,
      )
      .run()
    return Number(result.meta.changes ?? 0) > 0
  } catch (error) {
    if (String(error).includes('UNIQUE constraint failed')) {
      return false
    }
    throw error
  }
}

export async function deletePasteCascade(db: D1Database, id: string): Promise<void> {
  await db.batch([
    db.prepare('DELETE FROM comments WHERE paste_id = ?').bind(id),
    db.prepare('DELETE FROM pastes WHERE id = ?').bind(id),
  ])
}

export async function burnPaste(db: D1Database, id: string): Promise<PasteRow | null> {
  const [selected] = await db.batch([
    db
      .prepare(
        'SELECT id, v, ct, adata, formatter, discussion, burn, expire_date, salt, size, created_at, r2_key FROM pastes WHERE id = ?',
      )
      .bind(id),
    db.prepare('DELETE FROM comments WHERE paste_id = ?').bind(id),
    db.prepare('DELETE FROM pastes WHERE id = ?').bind(id),
  ])
  const row = selected?.results?.[0] as PasteRow | undefined
  return row ?? null
}

export async function listExpired(
  db: D1Database,
  now: number,
  limit: number,
): Promise<Array<{ id: string; r2Key: string | null }>> {
  const result = await db
    .prepare(
      'SELECT id, r2_key FROM pastes WHERE expire_date IS NOT NULL AND expire_date <= ? LIMIT ?',
    )
    .bind(now, limit)
    .all<{ id: string; r2_key: string | null }>()
  return (result.results ?? []).map((row) => ({ id: row.id, r2Key: row.r2_key }))
}

export async function purgeExpired(
  db: D1Database,
  r2: R2Bucket | undefined,
  now: number,
  limit = 100,
): Promise<number> {
  const rows = await listExpired(db, now, limit)
  if (rows.length === 0) {
    return 0
  }
  const ids = rows.map((row) => row.id)
  const placeholders = ids.map(() => '?').join(', ')
  await db.batch([
    db.prepare(`DELETE FROM comments WHERE paste_id IN (${placeholders})`).bind(...ids),
    db.prepare(`DELETE FROM pastes WHERE id IN (${placeholders})`).bind(...ids),
  ])
  const keys = rows.map((row) => row.r2Key).filter((key): key is string => key !== null)
  if (r2 && keys.length > 0) {
    await r2.delete(keys)
  }
  return rows.length
}

export async function purgeOrphanComments(db: D1Database): Promise<void> {
  await db
    .prepare('DELETE FROM comments WHERE NOT EXISTS (SELECT 1 FROM pastes WHERE pastes.id = comments.paste_id)')
    .run()
}

export async function cleanupRateLimits(db: D1Database, before: number): Promise<void> {
  await db.prepare('DELETE FROM rate_limits WHERE window_start < ?').bind(before).run()
}

export async function checkRateLimit(
  db: D1Database,
  route: string,
  ip: string,
  windowSeconds: number,
  maxRequests: number,
  nowMs: number,
): Promise<{ allowed: boolean; retryAfter: number }> {
  const ipHash = await sha256Hex(ip)
  const bucket = Math.floor(nowMs / 1000 / windowSeconds)
  const key = `${route}:${ipHash}:${bucket}`
  const [, selected] = await db.batch([
    db
      .prepare(
        'INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = count + 1',
      )
      .bind(key, bucket),
    db.prepare('SELECT count FROM rate_limits WHERE key = ?').bind(key),
  ])
  const count = Number((selected?.results?.[0] as { count?: number } | undefined)?.count ?? 1)
  return {
    allowed: count <= maxRequests,
    retryAfter: Math.max(1, Math.ceil((bucket + 1) * windowSeconds - nowMs / 1000)),
  }
}
