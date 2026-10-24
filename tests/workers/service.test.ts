import { env } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'
import { getConfig } from '../../src/server/config'
import { createComment, createPaste, deletePaste, readPaste, ServiceError } from '../../src/server/service'
import { purge } from '../../src/server/purge'
import { validateCommentRequest, validatePasteRequest } from '../../src/server/validation'

function bodyFor(ct: string, options: { burn?: 0 | 1; discussion?: 0 | 1 } = {}) {
  const iv = btoa(String.fromCharCode(...new Uint8Array(16)))
  const salt = btoa(String.fromCharCode(...new Uint8Array(8)))
  return {
    v: 2,
    adata: [[iv, salt, 100_000, 256, 128, 'aes', 'gcm', 'none'], 'plaintext', options.discussion ?? 0, options.burn ?? 0],
    ct,
    meta: { expire: '1week' },
  }
}

let ipCounter = 0
function nextIp(): string {
  ipCounter++
  return `10.20.${Math.floor(ipCounter / 250)}.${ipCounter % 250}`
}

async function makePaste(ct = btoa(`paste-${Date.now()}-${Math.random()}`), options: { burn?: 0 | 1; discussion?: 0 | 1 } = {}) {
  const config = getConfig(env)
  const valid = validatePasteRequest(bodyFor(ct, options), config)
  return createPaste(env, valid, nextIp())
}

describe('D1 service', () => {
  it('creates, reads, rejects a wrong token, deletes with the right one', async () => {
    const created = await makePaste()
    const read = await readPaste(env, created.id)
    expect(read.v).toBe(2)
    expect(read.ct).toBeTruthy()

    await expect(deletePaste(env, created.id, '0'.repeat(64))).rejects.toMatchObject({
      status: 403,
    } satisfies Partial<ServiceError>)
    await expect(readPaste(env, created.id)).resolves.toMatchObject({ comment_count: 0 })

    await deletePaste(env, created.id, created.deleteToken)
    await expect(readPaste(env, created.id)).rejects.toMatchObject({ status: 404 })
  })

  it('allows exactly one concurrent burn read', async () => {
    const created = await makePaste(btoa(`burn-${Date.now()}-${Math.random()}`), { burn: 1 })
    const results = await Promise.all(
      Array.from({ length: 20 }, () => readPaste(env, created.id).then(() => 'ok').catch(() => 'error')),
    )
    expect(results.filter((value) => value === 'ok')).toHaveLength(1)
    expect(results.filter((value) => value === 'error')).toHaveLength(19)
  })

  it('stores and reads comments, then deletes them with the paste', async () => {
    const created = await makePaste(btoa(`discussion-${Date.now()}-${Math.random()}`), { discussion: 1 })
    const ct = btoa(`comment-${Date.now()}-${Math.random()}`)
    const valid = validateCommentRequest(
      {
        v: 2,
        adata: bodyFor(ct).adata[0],
        ct,
        pasteid: created.id,
        parentid: created.id,
      },
      getConfig(env),
    )
    const comment = await createComment(env, valid, nextIp())
    expect(comment.id).toMatch(/^[a-f0-9]{16}$/)
    const read = await readPaste(env, created.id)
    expect(read.comment_count).toBe(1)
    expect(read.comments[0]?.id).toBe(comment.id)

    await deletePaste(env, created.id, created.deleteToken)
    await expect(readPaste(env, created.id)).rejects.toMatchObject({ status: 404 })
  })

  it('expires lazily and purges expired rows', async () => {
    const created = await makePaste(btoa(`expire-${Date.now()}-${Math.random()}`))
    await env.DB.prepare('UPDATE pastes SET expire_date = ? WHERE id = ?')
      .bind(Math.floor(Date.now() / 1000) - 10, created.id)
      .run()
    await expect(readPaste(env, created.id)).rejects.toMatchObject({ status: 404 })
    await purge(env)
    const row = await env.DB.prepare('SELECT id FROM pastes WHERE id = ?').bind(created.id).first()
    expect(row).toBeNull()
  })

  it('stores large ciphertext in R2 and reads it back', async () => {
    const bytes = new Uint8Array(1_875_001)
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index % 251
    }
    // Build the base64 string in chunks to avoid a huge spread call.
    let binary = ''
    for (let index = 0; index < bytes.length; index += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
    }
    const largeCt = btoa(binary)
    const created = await makePaste(largeCt)
    const row = await env.DB.prepare('SELECT r2_key FROM pastes WHERE id = ?')
      .bind(created.id)
      .first<{ r2_key: string }>()
    expect(row?.r2_key).toBe(`pastes/${created.id}`)
    const read = await readPaste(env, created.id)
    expect(read.ct).toBe(largeCt)
    await deletePaste(env, created.id, created.deleteToken)
    await expect(env.PASTES.get(`pastes/${created.id}`)).resolves.toBeNull()
  })
})
