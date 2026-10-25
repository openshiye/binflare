#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const token = process.env.CLOUDFLARE_API_TOKEN
const account = process.env.CLOUDFLARE_ACCOUNT_ID
const d1Name = process.env.BINFLARE_D1_NAME || 'binflare'
const bucketName = process.env.BINFLARE_R2_BUCKET || 'binflare-pastes'

if (!token || !account) {
  console.error('CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID are required.')
  process.exit(1)
}

async function api(path, init = {}) {
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
    const message = body.errors?.map((error) => error.message).join('; ') ?? response.statusText
    throw new Error(`${init.method ?? 'GET'} ${path}: ${message}`)
  }
  return body.result
}

function splitSql(sql) {
  return sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean)
}

async function ensureD1() {
  const databases = await api(`/accounts/${account}/d1/database?per_page=1000`)
  const existing = databases.find((database) => database.name === d1Name)
  if (existing) {
    return { id: existing.uuid, created: false }
  }
  const created = await api(`/accounts/${account}/d1/database`, {
    method: 'POST',
    body: JSON.stringify({ name: d1Name }),
  })
  return { id: created.uuid, created: true }
}

async function ensureMigrations(databaseId) {
  const status = await api(`/accounts/${account}/d1/database/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({
      sql: "SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table' AND name IN ('pastes','comments','rate_limits')",
    }),
  })
  const tableCount = status?.[0]?.results?.[0]?.n ?? 0
  if (tableCount >= 3) {
    return 0
  }
  const files = ['migrations/0001_init.sql', 'migrations/0002_r2.sql']
  let applied = 0
  for (const file of files) {
    for (const statement of splitSql(readFileSync(resolve(root, file), 'utf8'))) {
      await api(`/accounts/${account}/d1/database/${databaseId}/query`, {
        method: 'POST',
        body: JSON.stringify({ sql: statement }),
      })
      applied += 1
    }
  }
  return applied
}

async function ensureBucket() {
  const buckets = await api(`/accounts/${account}/r2/buckets`)
  const existing = buckets.buckets?.find((bucket) => bucket.name === bucketName)
  if (!existing) {
    await api(`/accounts/${account}/r2/buckets`, {
      method: 'POST',
      body: JSON.stringify({ name: bucketName }),
    })
  }
  await api(`/accounts/${account}/r2/buckets/${bucketName}/lifecycle`, {
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
  return Boolean(existing)
}

const d1 = await ensureD1()
const migrated = await ensureMigrations(d1.id)
const bucketExisted = await ensureBucket()
const envPath = resolve(root, '.env.deploy')
const next = `CLOUDFLARE_ACCOUNT_ID=${account}\nBINFLARE_D1_DATABASE_ID=${d1.id}\n`
if (!existsSync(envPath) || readFileSync(envPath, 'utf8') !== next) {
  writeFileSync(envPath, next)
}

console.log(`D1 ${d1Name}: ${d1.id}${d1.created ? ' (created)' : ' (existing)'}`)
console.log(`D1 migrations: ${migrated ? `${migrated} statements applied` : 'already current'}`)
console.log(`R2 ${bucketName}: ${bucketExisted ? 'existing' : 'created'}; lifecycle rule configured`)
console.log('Wrote .env.deploy')
