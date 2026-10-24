import { base64ToBytes, bufferSource } from './binary'

// Small wasm module compiled from:
//   (func (export "fnv") (param i32 i32) (result i64) ... FNV-1a over memory)
// It keeps 2.5 MB of ciphertext under the Workers free-plan CPU budget;
// the pure-JS limb implementation below is the fallback.
const FNV_WASM_BASE64 =
  'AGFzbQEAAAABBwFgAn9/AX4DAgEABQMBAEAHEAIGbWVtb3J5AgADZm52AAAKQQE/AgF+AX9CpcaIocicp/lLIQICQANAIAMgAU8NASACIAAgA2oxAACFQrODgICAIH4hAiADQQFqIQMMAAsLIAIL'

type FnvExports = {
  memory: WebAssembly.Memory
  fnv: (ptr: number, length: number) => bigint
}

let fnvExports: FnvExports | null = null
try {
  const module = new WebAssembly.Module(bufferSource(base64ToBytes(FNV_WASM_BASE64)))
  const instance = new WebAssembly.Instance(module)
  fnvExports = instance.exports as unknown as FnvExports
} catch {
  fnvExports = null
}

const P0 = 0x01b3
const P2 = 0x0100

function multiply(h0: number, h1: number, h2: number, h3: number): [number, number, number, number] {
  let sum = h0 * P0
  const o0 = sum & 0xffff
  let carry = sum >>> 16

  sum = h1 * P0 + carry
  const o1 = sum & 0xffff
  carry = sum >>> 16

  sum = h2 * P0 + h0 * P2 + carry
  const o2 = sum & 0xffff
  carry = sum >>> 16

  sum = h3 * P0 + h1 * P2 + carry
  const o3 = sum & 0xffff
  return [o0, o1, o2, o3]
}

function fnvFallback(bytes: Uint8Array): string {
  let h0 = 0x2325
  let h1 = 0x8422
  let h2 = 0x9ce4
  let h3 = 0xcbf2

  for (const byte of bytes) {
    h0 ^= byte
    const next = multiply(h0, h1, h2, h3)
    h0 = next[0]
    h1 = next[1]
    h2 = next[2]
    h3 = next[3]
  }

  return (
    h3.toString(16).padStart(4, '0') +
    h2.toString(16).padStart(4, '0') +
    h1.toString(16).padStart(4, '0') +
    h0.toString(16).padStart(4, '0')
  )
}

export function fnv1a64Hex(input: string | Uint8Array): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  if (fnvExports) {
    const memory = fnvExports.memory
    if (bytes.length > memory.buffer.byteLength) {
      const extraPages = Math.ceil((bytes.length - memory.buffer.byteLength) / 65536)
      memory.grow(extraPages)
    }
    new Uint8Array(memory.buffer, 0, bytes.length).set(bytes)
    return BigInt.asUintN(64, fnvExports.fnv(0, bytes.length)).toString(16).padStart(16, '0')
  }
  return fnvFallback(bytes)
}
