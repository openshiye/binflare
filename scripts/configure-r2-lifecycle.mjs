#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const token = process.env.CLOUDFLARE_API_TOKEN
const account = process.env.CLOUDFLARE_ACCOUNT_ID

function loadEnvFile(path) {
  if (!existsSync(path)) {
    return {}
  }
  const values = {}
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (!match || line.trim().startsWith('#')) {
      continue
    }
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2')
  }
  return values
}

const localEnv = loadEnvFile(resolve(root, '.env.deploy'))
const generatedConfigPath = resolve(root, 'dist/server/wrangler.json')
const generatedBucket = existsSync(generatedConfigPath)
  ? JSON.parse(readFileSync(generatedConfigPath, 'utf8')).r2_buckets?.[0]?.bucket_name
  : undefined

const bucketName =
  process.argv[2] ??
  process.env.BINFLARE_R2_BUCKET ??
  localEnv.BINFLARE_R2_BUCKET ??
  generatedBucket ??
  'binflare-pastes'

if (!token || !account) {
  console.error('Usage: CLOUDFLARE_API_TOKEN=<token> CLOUDFLARE_ACCOUNT_ID=<account> pnpm run r2:lifecycle [bucket-name]')
  console.error('The token needs Workers R2 Storage:Edit.')
  process.exit(1)
}

async function request(path, init = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const body = await response.json()
  if (!body.success) {
    throw new Error(body.errors?.[0]?.message ?? `HTTP ${response.status}`)
  }
  return body.result
}

await request(`/accounts/${account}/r2/buckets/${bucketName}/lifecycle`, {
  method: 'PUT',
  body: JSON.stringify({
    rules: [
      {
        id: 'expire-pastes-after-366-days',
        enabled: true,
        conditions: { prefix: 'pastes/' },
        deleteObjectsTransition: { condition: { type: 'Age', maxAge: 31622400 } },
      },
    ],
  }),
})

const result = await request(`/accounts/${account}/r2/buckets/${bucketName}/lifecycle`)
console.log(`Configured R2 lifecycle on ${bucketName}: ${result.rules?.[0]?.id ?? 'rule applied'}`)
