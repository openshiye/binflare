import { env } from 'cloudflare:test'
import { expect, it } from 'vitest'
import { ensureSchema } from '../../src/server/schema'

it('initializes the schema idempotently and records the checked-in migrations', async () => {
  await ensureSchema(env.DB)
  await ensureSchema(env.DB)

  const tables = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('pastes', 'comments', 'rate_limits', 'd1_migrations') ORDER BY name",
  ).all<{ name: string }>()
  expect(tables.results.map((row) => row.name)).toEqual([
    'comments',
    'd1_migrations',
    'pastes',
    'rate_limits',
  ])

  const migrations = await env.DB.prepare('SELECT name FROM d1_migrations ORDER BY name').all<{ name: string }>()
  expect(migrations.results.map((row) => row.name)).toEqual(['0001_init.sql', '0002_r2.sql'])
})
