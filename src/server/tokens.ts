import { bytesToHex, constantTimeEqual, hexToBytes, randomBytes, utf8Encode, bufferSource } from '../lib/binary'

export function randomHex(byteLength: number): string {
  return bytesToHex(randomBytes(byteLength))
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bufferSource(utf8Encode(value)))
  return bytesToHex(new Uint8Array(digest))
}

export async function deleteToken(pasteId: string, salt: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    bufferSource(utf8Encode(salt)),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, bufferSource(utf8Encode(pasteId)))
  return bytesToHex(new Uint8Array(signature))
}

export async function verifyDeleteToken(
  pasteId: string,
  salt: string,
  candidate: string,
): Promise<boolean> {
  if (!/^[a-f0-9]{64}$/.test(candidate)) {
    return false
  }
  const expected = await deleteToken(pasteId, salt)
  try {
    return constantTimeEqual(hexToBytes(expected), hexToBytes(candidate))
  } catch {
    return false
  }
}
