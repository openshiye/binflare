import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64 } from '../../src/lib/binary'

describe('large base64', () => {
  it('round-trips a 1.875 MB buffer', () => {
    const bytes = new Uint8Array(1_875_000)
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = index % 251
    }
    const start = performance.now()
    const encoded = bytesToBase64(bytes)
    const encodeMs = performance.now() - start
    const decodeStart = performance.now()
    const decoded = base64ToBytes(encoded)
    const decodeMs = performance.now() - decodeStart
    expect(encoded.length).toBeGreaterThan(2_000_000)
    expect(decoded.length).toBe(bytes.length)
    expect(decoded[0]).toBe(bytes[0])
    expect(decoded[bytes.length - 1]).toBe(bytes[bytes.length - 1])
    console.log(`base64 1.875 MB: encode ${encodeMs.toFixed(1)}ms, decode ${decodeMs.toFixed(1)}ms`)
  })
})
