const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
const ALPHABET_INDEX = new Map<string, number>(
  [...ALPHABET].map((character, index) => [character, index]),
)

export function base58Encode(bytes: Uint8Array): string {
  let zeroes = 0
  while (zeroes < bytes.length && bytes[zeroes] === 0) {
    zeroes++
  }

  let value = 0n
  for (const byte of bytes) {
    value = (value << 8n) | BigInt(byte)
  }

  let encoded = ''
  while (value > 0n) {
    const remainder = Number(value % 58n)
    encoded = ALPHABET[remainder]! + encoded
    value /= 58n
  }

  return '1'.repeat(zeroes) + encoded
}

export function base58Decode(value: string): Uint8Array {
  if (value.length === 0) {
    return new Uint8Array()
  }

  let zeroes = 0
  while (zeroes < value.length && value[zeroes] === '1') {
    zeroes++
  }

  let numeric = 0n
  for (const character of value) {
    const digit = ALPHABET_INDEX.get(character)
    if (digit === undefined) {
      throw new Error('Invalid base58 character')
    }
    numeric = numeric * 58n + BigInt(digit)
  }

  let hex = numeric.toString(16)
  if (hex.length % 2 !== 0) {
    hex = `0${hex}`
  }
  const body = hex === '00' ? new Uint8Array() : new Uint8Array(hex.length / 2)
  if (hex !== '00') {
    for (let index = 0; index < body.length; index++) {
      body[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16)
    }
  }

  const result = new Uint8Array(zeroes + body.length)
  result.set(body, zeroes)
  return result
}
