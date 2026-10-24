import { applyD1Migrations, env } from 'cloudflare:test'
import type { D1Migration } from '@cloudflare/vitest-pool-workers'
import { beforeAll } from 'vitest'

beforeAll(async () => {
  const migrations = (env as typeof env & { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS
  await applyD1Migrations(env.DB, migrations)
})
