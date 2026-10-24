import { describe, expect, it } from 'vitest'
import { fnv1a64Hex } from '../../src/lib/fnv'

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
})
