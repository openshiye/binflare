export function upstreamStringToBytes(value: string): Uint8Array {
  const bytes = new Uint8Array(value.length)
  for (let index = 0; index < value.length; index++) {
    bytes[index] = value.charCodeAt(index) & 0xff
  }
  return bytes
}

export function bytesToBinaryString(bytes: Uint8Array): string {
  let result = ''
  const chunkSize = 0x8000
  for (let index = 0; index < bytes.length; index += chunkSize) {
    result += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
  }
  return result
}

export function bytesToBase64(bytes: Uint8Array): string {
  const nativeToBase64 = (Uint8Array.prototype as Uint8Array & {
    toBase64?: () => string
  }).toBase64
  if (typeof nativeToBase64 === 'function') {
    return nativeToBase64.call(bytes)
  }
  return btoa(bytesToBinaryString(bytes))
}

export function base64ToBytes(value: string): Uint8Array {
  const nativeFromBase64 = (Uint8Array as unknown as {
    fromBase64?: (input: string) => Uint8Array
  }).fromBase64
  if (typeof nativeFromBase64 === 'function') {
    return nativeFromBase64(value)
  }
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

export function utf8Encode(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

export function utf8Decode(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(total)
  let offset = 0
  for (const part of parts) {
    result.set(part, offset)
    offset += part.length
  }
  return result
}

export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

export function bytesToHex(bytes: Uint8Array): string {
  let result = ''
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, '0')
  }
  return result
}

export function hexToBytes(value: string): Uint8Array {
  if (value.length % 2 !== 0 || /[^0-9a-f]/i.test(value)) {
    throw new Error('Invalid hex')
  }
  const bytes = new Uint8Array(value.length / 2)
  for (let index = 0; index < bytes.length; index++) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16)
  }
  return bytes
}

export function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false
  }
  let diff = 0
  for (let index = 0; index < a.length; index++) {
    diff |= a[index]! ^ b[index]!
  }
  return diff === 0
}

// TypeScript's DOM lib distinguishes Uint8Array<ArrayBuffer> from
// Uint8Array<ArrayBufferLike>; these helpers keep WebCrypto calls readable.
export function bufferSource(bytes: Uint8Array): BufferSource {
  return bytes as unknown as BufferSource
}

export function blobPart(bytes: Uint8Array): BlobPart {
  return bytes as unknown as BlobPart
}
