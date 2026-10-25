import { describe, expect, it } from 'vitest'
import { fnv1a64Hex } from '../../src/lib/fnv'
import { bytesToBase64 } from '../../src/lib/binary'

describe('fnv on the Workers runtime', () => {
  it('matches the published vectors', () => {
    expect(fnv1a64Hex('')).toBe('cbf29ce484222325')
    expect(fnv1a64Hex('test')).toBe('f9e6e6ef197c2b25')
  })

  it('hashes 2.5 MB', () => {
    const bytes = new Uint8Array(2_500_000)
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index % 251
    }
    const start = performance.now()
    const hash = fnv1a64Hex(bytes)
    const elapsed = performance.now() - start
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
    console.log(`workers fnv 2.5 MB: ${elapsed.toFixed(1)}ms`)
  })

  it('measures the 10 MB base64 + FNV tail', () => {
    const bytes = new Uint8Array(10_000_000)
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index % 251
    }
    const encodeStart = performance.now()
    const base64 = bytesToBase64(bytes)
    const encodeMs = performance.now() - encodeStart
    const hashStart = performance.now()
    const hash = fnv1a64Hex(base64)
    const hashMs = performance.now() - hashStart
    expect(base64.length).toBe(13_333_336)
    expect(hash).toMatch(/^[a-f0-9]{16}$/)
    console.log(
      `workers 10 MB tail: base64 ${encodeMs.toFixed(1)}ms, fnv ${hashMs.toFixed(1)}ms`,
    )
  })
})

