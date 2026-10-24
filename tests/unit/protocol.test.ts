import { describe, expect, it } from 'vitest'
import { base58Decode, base58Encode } from '../../src/lib/base58'
import { upstreamStringToBytes, bytesToHex } from '../../src/lib/binary'
import {
  createPasteCipher,
  decryptMessage,
  CryptoError,
  decodeKey,
  parsePastePayload,
} from '../../src/lib/crypto'
import { fnv1a64Hex } from '../../src/lib/fnv'
import {
  buildDeleteUrl,
  buildPasteUrl,
  parseFragment,
  readDeleteTarget,
  readPasteTarget,
} from '../../src/lib/fragment'

describe('base58', () => {
  it('round-trips leading zero bytes', () => {
    const bytes = new Uint8Array([0, 0, 1, 2, 3, 255])
    expect([...base58Decode(base58Encode(bytes))]).toEqual([...bytes])
  })

  it('matches a published base58 vector', () => {
    expect(base58Encode(new TextEncoder().encode('Hello World!'))).toBe('2NEpo7TZRRrLZSi2U')
  })

  it('round-trips a 32-byte key', () => {
    const bytes = new Uint8Array(32)
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index * 7
    }
    const encoded = base58Encode(bytes)
    expect([...base58Decode(encoded)]).toEqual([...bytes])
  })
})

describe('fnv1a64', () => {
  it('matches the published FNV-1a 64 vectors', () => {
    expect(fnv1a64Hex('')).toBe('cbf29ce484222325')
    expect(fnv1a64Hex('a')).toBe('af63dc4c8601ec8c')
    expect(fnv1a64Hex('foobar')).toBe('85944171f73967e8')
    expect(fnv1a64Hex('test')).toBe('f9e6e6ef197c2b25')
  })

  it('agrees with a BigInt reference on random bytes', () => {
    const offset = 0xcbf29ce484222325n
    const prime = 0x100000001b3n
    const mask = 0xffffffffffffffffn
    for (let round = 0; round < 8; round++) {
      const bytes = crypto.getRandomValues(new Uint8Array(257 + round * 113))
      let expected = offset
      for (const byte of bytes) {
        expected = ((expected ^ BigInt(byte)) * prime) & mask
      }
      expect(fnv1a64Hex(bytes)).toBe(expected.toString(16).padStart(16, '0'))
    }
  })

  it('handles a 2.5 MB input without per-byte BigInt allocation', () => {
    const bytes = new Uint8Array(2_500_000)
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index % 251
    }
    const start = performance.now()
    const hash = fnv1a64Hex(bytes)
    const elapsed = performance.now() - start
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
    console.log(`fnv1a64 2.5 MB: ${elapsed.toFixed(1)}ms`)
  })
})

describe('upstream string bytes', () => {
  it('takes the low byte of each UTF-16 code unit', () => {
    expect(bytesToHex(upstreamStringToBytes('A\u00e9'))).toBe('41e9')
    expect(bytesToHex(upstreamStringToBytes('\u4e2d'))).toBe('2d')
  })
})

describe('v2 crypto', () => {
  it('round-trips a default GCM paste', async () => {
    const created = await createPasteCipher('hello world')
    const result = await decryptMessage(
      created.keyBase58,
      '',
      created.request.ct,
      created.request.adata,
    )
    expect(parsePastePayload(JSON.parse(result.plaintext)).paste).toBe('hello world')
    expect(result.mode).toBe('gcm')
  })

  it('round-trips a password paste with a non-ASCII password', async () => {
    const created = await createPasteCipher('秘密', { password: '口令é' })
    const result = await decryptMessage(
      created.keyBase58,
      '口令é',
      created.request.ct,
      created.request.adata,
    )
    expect(parsePastePayload(JSON.parse(result.plaintext)).paste).toBe('秘密')
  })

  it('rejects a wrong password', async () => {
    const created = await createPasteCipher('secret', { password: 'correct' })
    await expect(
      decryptMessage(created.keyBase58, 'wrong', created.request.ct, created.request.adata),
    ).rejects.toMatchObject({ code: 'auth' } satisfies Partial<CryptoError>)
  })

  it('rejects tampered authenticated data', async () => {
    const created = await createPasteCipher('secret')
    const adata = JSON.parse(JSON.stringify(created.request.adata))
    adata[1] = 'markdown'
    await expect(
      decryptMessage(created.keyBase58, '', created.request.ct, adata),
    ).rejects.toMatchObject({ code: 'auth' })
  })

  it('round-trips uncompressed pastes', async () => {
    const created = await createPasteCipher('plain', { compression: 'none' })
    const result = await decryptMessage(
      created.keyBase58,
      '',
      created.request.ct,
      created.request.adata,
    )
    expect(parsePastePayload(JSON.parse(result.plaintext)).paste).toBe('plain')
  })

  it('accepts a 600k-iteration, 12-byte-IV spec', async () => {
    const created = await createPasteCipher('variant', {
      iterations: 600_000,
      ivLength: 12,
    })
    expect(created.request.adata[0][2]).toBe(600_000)
    expect(created.request.adata[0][0]).toBeTruthy()
    const result = await decryptMessage(
      created.keyBase58,
      '',
      created.request.ct,
      created.request.adata,
    )
    expect(parsePastePayload(JSON.parse(result.plaintext)).paste).toBe('variant')
  })

  it('round-trips ctr and cbc pastes for read compatibility', async () => {
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

  it('pads short decoded keys to 32 bytes', () => {
    const key = decodeKey(base58Encode(new Uint8Array([1, 2, 3])))
    expect(key.length).toBe(32)
    expect([...key.slice(0, 29)]).toEqual(new Array(29).fill(0))
    expect([...key.slice(29)]).toEqual([1, 2, 3])
  })
})

describe('fragments and URLs', () => {
  const key = base58Encode(new Uint8Array(32).fill(7))

  it('parses normal and burn fragments and strips tracker suffixes', () => {
    expect(parseFragment(`#${key}`)).toEqual({ key, burn: false })
    expect(parseFragment(`#-${key}&utm=1`)).toEqual({ key, burn: true })
    expect(parseFragment('#not base58')).toBeNull()
  })

  it('reads the public paste target', () => {
    expect(readPasteTarget('?0123456789abcdef', `#${key}`)).toEqual({
      id: '0123456789abcdef',
      key,
      burn: false,
    })
    expect(readPasteTarget('?0123456789abcdef', '#-0OIl')).toBeNull()
  })

  it('builds upstream-compatible paste and delete URLs', () => {
    expect(buildPasteUrl('/', '0123456789abcdef', key, false)).toBe(
      `/?0123456789abcdef#${key}`,
    )
    expect(buildPasteUrl('/', '0123456789abcdef', key, true)).toBe(
      `/?0123456789abcdef#-${key}`,
    )
    expect(buildDeleteUrl('/', '0123456789abcdef', 'a'.repeat(64))).toContain(
      '/?pasteid=0123456789abcdef&deletetoken=',
    )
  })

  it('reads a delete target', () => {
    const token = 'a'.repeat(64)
    expect(readDeleteTarget(`?pasteid=0123456789abcdef&deletetoken=${token}`)).toEqual({
      id: '0123456789abcdef',
      token,
    })
  })
})
