#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import process from 'node:process'

const root = resolve(dirname(new URL(import.meta.url).pathname), '..')
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipBuild = args.includes('--skip-build')
const configPath = resolve(root, 'dist/server/wrangler.json')
const userAgent = process.env.npm_config_user_agent ?? ''
const packageManager = userAgent.startsWith('pnpm/') ? 'pnpm' : userAgent.startsWith('yarn/') ? 'yarn' : 'npm'

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

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  })
  if (result.error) {
    console.error(result.error)
    process.exit(1)
  }
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function runWrangler(wranglerArgs) {
  if (packageManager === 'pnpm') {
    run('pnpm', ['exec', 'wrangler', ...wranglerArgs])
  } else if (packageManager === 'yarn') {
    run('yarn', ['exec', 'wrangler', ...wranglerArgs])
  } else {
    run('npx', ['--no-install', 'wrangler', ...wranglerArgs])
  }
}

async function configureR2Lifecycle(bucketName) {
  const token = process.env.CLOUDFLARE_API_TOKEN
  const account = process.env.CLOUDFLARE_ACCOUNT_ID
  if (!token || !account || !bucketName) {
    return
  }
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${account}/r2/buckets/${bucketName}/lifecycle`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
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
      },
    )
    const body = await response.json()
    if (!body.success) {
      throw new Error(body.errors?.[0]?.message ?? `HTTP ${response.status}`)
    }
    console.log(`Configured R2 lifecycle rule on ${bucketName}`)
  } catch (error) {
    console.warn(`R2 lifecycle was not configured: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const localEnv = loadEnvFile(resolve(root, '.env.deploy'))
const databaseId = localEnv.BINFLARE_D1_DATABASE_ID || process.env.BINFLARE_D1_DATABASE_ID

if (!skipBuild) {
  run(packageManager, ['run', 'build'])
}

if (!existsSync(configPath)) {
  console.error(`Missing ${relative(root, configPath)}. Run the build script first.`)
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf8'))
if (!Array.isArray(config.d1_databases) || config.d1_databases.length === 0) {
  console.error('The generated Wrangler config has no D1 binding.')
  process.exit(1)
}

const placeholderId = '00000000-0000-0000-0000-000000000000'
const configuredId = config.d1_databases[0].database_id
const effectiveId = databaseId ?? configuredId

if (!effectiveId || effectiveId === placeholderId) {
  if (!dryRun) {
    console.error(
      'No real D1 database_id was found. Locally, copy .env.deploy.example to .env.deploy. ' +
        'With the Cloudflare deploy button, the button updates wrangler.jsonc before running this script.',
    )
    process.exit(1)
  }
  console.warn('Using the placeholder database_id for dry-run validation.')
} else if (databaseId && databaseId !== configuredId) {
  config.d1_databases[0].database_id = databaseId
  writeFileSync(configPath, `${JSON.stringify(config)}\n`)
}

if (dryRun) {
  runWrangler(['deploy', '--config', relative(root, configPath), '--dry-run'])
} else {
  runWrangler(['deploy', '--config', relative(root, configPath)])
  await configureR2Lifecycle(config.r2_buckets?.[0]?.bucket_name)
}
