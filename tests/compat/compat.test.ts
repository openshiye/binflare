import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser } from '@playwright/test'
import { base58Encode } from '../../src/lib/base58'
import { bytesToBase64, bufferSource } from '../../src/lib/binary'
import { createPasteCipher, decryptMessage, parsePastePayload } from '../../src/lib/crypto'
import { fnv1a64Hex } from '../../src/lib/fnv'
import { deleteToken } from '../../src/server/tokens'

const UPSTREAM_REPO =
  process.env.PRIVATEBIN_REPO ??
  fileURLToPath(new URL('../../../PrivateBin', import.meta.url))
const BASELINE_TAG = (
  JSON.parse(readFileSync(new URL('./baseline.json', import.meta.url), 'utf8')) as {
    releaseTag: string
  }
).releaseTag

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.json': 'application/json',
}

let browser: Browser
let server: ReturnType<typeof createServer>
let baseUrl = ''
let upstreamRoot = ''
let tempRoot = ''
let zlibAvailable = false
let pageResult: Awaited<ReturnType<Browser['newPage']>>

beforeAll(async () => {
  tempRoot = mkdtempSync(join(tmpdir(), 'binflare-compat-'))
  upstreamRoot = join(tempRoot, 'upstream')
  mkdirSync(upstreamRoot, { recursive: true })
  const archive = join(tempRoot, 'privatebin.tar')
  execFileSync('git', ['-C', UPSTREAM_REPO, 'archive', BASELINE_TAG, '-o', archive])
  execFileSync('tar', ['-xf', archive, '-C', upstreamRoot])
  writeFileSync(join(upstreamRoot, 'js', 'blank.html'), '<!doctype html><html><body></body></html>')

  server = createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url ?? '/', 'http://local').pathname)
    const file = join(upstreamRoot, pathname.replace(/^\/+/, ''))
    if (!file.startsWith(upstreamRoot)) {
      response.writeHead(403).end()
      return
    }
    try {
      const body = readFileSync(file)
      response.writeHead(200, {
        'content-type': MIME_TYPES[extname(file)] ?? 'application/octet-stream',
        'cross-origin-opener-policy': 'same-origin',
        'cross-origin-embedder-policy': 'require-corp',
      })
      response.end(body)
    } catch {
      response.writeHead(404).end()
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('Could not start compatibility server')
  }
  baseUrl = `http://127.0.0.1:${address.port}`

  browser = await chromium.launch()
  pageResult = await browser.newPage()
  await pageResult.goto(`${baseUrl}/js/blank.html`)
  for (const script of [
    'base-x-5.0.1.js',
    'zlib.js',
    'showdown-2.1.0.js',
    'purify-3.4.17.js',
    'prettify.js',
    'kjua-0.10.0.js',
    'privatebin.js',
  ]) {
    await pageResult.addScriptTag({ url: `${baseUrl}/js/${script}` })
  }
  zlibAvailable = await pageResult.evaluate(async () => {
    const globals = globalThis as unknown as { zlib?: Promise<unknown> }
    if (!globals.zlib) return false
    try {
      await globals.zlib
      const pb = (globalThis as unknown as { PrivateBin?: { Controller?: { initZlib?: () => void } } }).PrivateBin
      pb?.Controller?.initZlib?.()
      return true
    } catch {
      return false
    }
  })
}, 120_000)

afterAll(async () => {
  await browser?.close()
  await new Promise<void>((resolve) => server?.close(() => resolve()))
  if (tempRoot) {
    rmSync(tempRoot, { recursive: true, force: true })
  }
})

async function upstreamCipher(
  text: string,
  password: string,
  compression: 'zlib' | 'none',
): Promise<{ keyBase58: string; ct: string; adata: unknown[] }> {
  return pageResult.evaluate(
    async ({ text, password, compression }) => {
      const pb = (globalThis as unknown as {
        PrivateBin: {
          CryptTool: {
            getSymmetricKey: () => string
            base58encode: (value: string) => string
            cipher: (
              key: string,
              password: string,
              message: string,
              adata: unknown[],
            ) => Promise<[string, unknown[]]>
          }
        }
      }).PrivateBin
      document.body.dataset.compression = compression
      const key = pb.CryptTool.getSymmetricKey()
      const [ct, adata] = await pb.CryptTool.cipher(
        key,
        password,
        JSON.stringify({ paste: text }),
        [null, 'plaintext', 0, 0],
      )
      return { keyBase58: pb.CryptTool.base58encode(key), ct, adata }
    },
    { text, password, compression },
  )
}

async function upstreamDecipher(
  keyBase58: string,
  password: string,
  ct: string,
  adata: unknown[],
): Promise<string> {
  return pageResult.evaluate(
    async ({ keyBase58, password, ct, adata }) => {
      const pb = (globalThis as unknown as {
        PrivateBin: {
          CryptTool: {
            base58decode: (value: string) => string
            decipher: (key: string, password: string, data: [string, unknown[]]) => Promise<string>
          }
        }
      }).PrivateBin
      return pb.CryptTool.decipher(pb.CryptTool.base58decode(keyBase58), password, [ct, adata])
    },
    { keyBase58, password, ct, adata },
  )
}

async function makeLegacyFixture(mode: 'ctr' | 'cbc'): Promise<{
  keyBase58: string
  ct: string
  adata: unknown[]
}> {
  const keyBytes = new Uint8Array(32).fill(9)
  const iv = new Uint8Array(16).fill(3)
  const salt = new Uint8Array(8).fill(4)
  const spec = [bytesToBase64(iv), bytesToBase64(salt), 100_000, 256, 128, 'aes', mode, 'none']
  const adata = [spec, 'plaintext', 0, 0]
  const material = bufferSource(keyBytes)
  const imported = await crypto.subtle.importKey('raw', material, { name: 'PBKDF2' }, false, [
    'deriveKey',
  ])
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: bufferSource(salt), iterations: 100_000, hash: 'SHA-256' },
    imported,
    { name: mode === 'ctr' ? 'AES-CTR' : 'AES-CBC', length: 256 },
    false,
    ['encrypt'],
  )
  const params =
    mode === 'ctr'
      ? { name: 'AES-CTR', counter: bufferSource(iv), length: 128 }
      : { name: 'AES-CBC', iv: bufferSource(iv) }
  const ciphertext = await crypto.subtle.encrypt(
    params as AesCtrParams | AesCbcParams,
    key,
    new TextEncoder().encode(JSON.stringify({ paste: `legacy ${mode}` })),
  )
  return {
    keyBase58: base58Encode(keyBytes),
    ct: bytesToBase64(new Uint8Array(ciphertext)),
    adata,
  }
}

describe('G1 protocol compatibility', () => {
  it('decrypts an upstream 2.1.0 GCM paste with and without a password', async () => {
    for (const password of ['', '口令é']) {
      const fixture = await upstreamCipher('upstream text', password, 'zlib')
      const result = await decryptMessage(
        fixture.keyBase58,
        password,
        fixture.ct,
        fixture.adata,
      )
      expect(parsePastePayload(JSON.parse(result.plaintext)).paste).toBe('upstream text')
      expect(result.mode).toBe('gcm')
    }
  })

  it('decrypts an upstream uncompressed paste when zlib is available', async () => {
    if (!zlibAvailable) {
      return
    }
    const fixture = await upstreamCipher('uncompressed upstream', '', 'none')
    const result = await decryptMessage(fixture.keyBase58, '', fixture.ct, fixture.adata)
    expect(result.plaintext).toContain('uncompressed upstream')
  })

  it('is decrypted by the upstream 2.1.0 CryptTool', async () => {
    const created = await createPasteCipher('binflare text')
    const plaintext = await upstreamDecipher(
      created.keyBase58,
      '',
      created.request.ct,
      created.request.adata,
    )
    expect(plaintext).toContain('binflare text')
  })

  it('accepts the 600k/12B spec variant', async () => {
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

  it('decrypts protocol-valid ctr and cbc pastes', async () => {
    for (const mode of ['ctr', 'cbc'] as const) {
      const fixture = await makeLegacyFixture(mode)
      const result = await decryptMessage(fixture.keyBase58, '', fixture.ct, fixture.adata)
      expect(parsePastePayload(JSON.parse(result.plaintext)).paste).toBe(`legacy ${mode}`)
      expect(result.mode).toBe(mode)

      // The current upstream web client only creates GCM. Try its reader and
      // record the result; CTR in particular is known to be sensitive to the
      // WebCrypto counter-length default.
      const upstream = await upstreamDecipher(fixture.keyBase58, '', fixture.ct, fixture.adata)
      console.log(
        `upstream decipher of ${mode}:`,
        typeof upstream === 'string' ? upstream.slice(0, 80) : String(upstream),
      )
    }
  })

  it('matches upstream PHP for FNV IDs and HMAC delete tokens', async () => {
    const ct = 'SGVsbG8gUHJpdmF0ZUJpbg=='
    const pasteId = '0123456789abcdef'
    const salt = 'ab'.repeat(256)
    const php = `echo hash('fnv1a64', '${ct}'), "\\n", hash_hmac('sha256', '${pasteId}', '${salt}');`
    const output = execFileSync('docker', ['run', '--rm', 'php:8.3-cli', 'php', '-r', php], {
      encoding: 'utf8',
      timeout: 120_000,
      env: {
        ...process.env,
        PATH: `/Applications/Docker.app/Contents/Resources/bin:${process.env.PATH ?? ''}`,
      },
    })
      .trim()
      .split('\n')
    expect(output[0]).toBe(fnv1a64Hex(ct))
    expect(output[1]).toBe(await deleteToken(pasteId, salt))
  })
})
