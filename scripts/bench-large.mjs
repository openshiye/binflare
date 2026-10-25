const baseUrl = process.env.BINFLARE_URL ?? 'http://127.0.0.1:3012'
const size = Number(process.env.BINFLARE_BENCH_BYTES ?? 10_000_000)

const bytes = Buffer.alloc(size)
for (let index = 0; index < bytes.length; index++) {
  bytes[index] = index % 251
}
const ct = bytes.toString('base64')
const body = {
  v: 2,
  adata: [
    [Buffer.alloc(16).toString('base64'), Buffer.alloc(8).toString('base64'), 100_000, 256, 128, 'aes', 'gcm', 'none'],
    'plaintext',
    0,
    0,
  ],
  ct,
  meta: { expire: '5min' },
}

const createdStart = performance.now()
const createdResponse = await fetch(`${baseUrl}/`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-requested-with': 'JSONHttpRequest' },
  body: JSON.stringify(body),
})
const created = await createdResponse.json()
const createMs = performance.now() - createdStart
if (created.status !== 0) {
  console.error('create failed', created)
  process.exit(1)
}

const readStart = performance.now()
const readResponse = await fetch(`${baseUrl}/?pasteid=${created.id}`, {
  headers: { 'x-requested-with': 'JSONHttpRequest' },
})
const read = await readResponse.json()
const readMs = performance.now() - readStart
const readMatches = read.status === 0 && read.ct === ct

await fetch(`${baseUrl}/api/pastes/${created.id}`, {
  method: 'DELETE',
  headers: { authorization: `Bearer ${created.deletetoken}` },
})

console.log(JSON.stringify({
  sizeBytes: size,
  ctBase64Chars: ct.length,
  createWallMs: Number(createMs.toFixed(1)),
  readWallMs: Number(readMs.toFixed(1)),
  readMatches,
}, null, 2))
