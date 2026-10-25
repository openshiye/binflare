import { describe, expect, it } from 'vitest'
import fixtures from './fixtures.json'
import { createPasteCipher, decryptMessage, parseCommentPayload, parsePastePayload } from '../../src/lib/crypto'
import { fnv1a64Hex } from '../../src/lib/fnv'
import { deleteToken } from '../../src/server/tokens'

describe('PrivateBin 2.1.0 static protocol fixtures', () => {
  it('decrypts upstream-generated GCM pastes with and without a password', async () => {
    for (const paste of fixtures.pastes) {
      const result = await decryptMessage(paste.keyBase58, paste.password, paste.ct, paste.adata)
      const payload = parsePastePayload(JSON.parse(result.plaintext))
      expect(payload.paste).toBe(paste.text)
      expect(result.mode).toBe('gcm')
      if (paste.password) {
        expect(paste.password).not.toBe('')
      }
    }
  })

  it('decrypts an upstream-generated comment', async () => {
    const result = await decryptMessage(
      fixtures.comment.keyBase58,
      fixtures.comment.password,
      fixtures.comment.ct,
      fixtures.comment.adata,
    )
    const payload = parseCommentPayload(JSON.parse(result.plaintext))
    expect(payload.comment).toBe(fixtures.comment.text)
    expect(payload.nickname).toBe(fixtures.comment.nickname)
  })

  it('matches the pinned FNV-1a64 ID vector', () => {
    expect(fnv1a64Hex(fixtures.fnv.ct)).toBe(fixtures.fnv.expectedId)
  })

  it('matches the pinned HMAC delete-token vector', async () => {
    expect(await deleteToken(fixtures.hmac.pasteId, fixtures.hmac.salt)).toBe(
      fixtures.hmac.expectedToken,
    )
  })

  it('keeps the 600k/12B spec variant readable', async () => {
    const created = await createPasteCipher('variant', {
      iterations: 600_000,
      ivLength: 12,
    })
    const result = await decryptMessage(
      created.keyBase58,
      '',
      created.request.ct,
      created.request.adata,
    )
    expect(parsePastePayload(JSON.parse(result.plaintext)).paste).toBe('variant')
  })

  it('keeps ctr and cbc read compatibility', async () => {
    for (const mode of ['ctr', 'cbc'] as const) {
      const created = await createPasteCipher(`${mode} content`, { mode })
      const result = await decryptMessage(
        created.keyBase58,
        '',
        created.request.ct,
        created.request.adata,
      )
      expect(parsePastePayload(JSON.parse(result.plaintext)).paste).toBe(`${mode} content`)
      expect(result.mode).toBe(mode)
    }
  })
})
