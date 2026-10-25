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

const localEnv = loadEnvFile(resolve(root, '.env.deploy'))
const databaseId = localEnv.BINFLARE_D1_DATABASE_ID || process.env.BINFLARE_D1_DATABASE_ID

if (!skipBuild) {
  run('pnpm', ['build'])
}

if (!existsSync(configPath)) {
  console.error(`Missing ${relative(root, configPath)}. Run pnpm build first.`)
  process.exit(1)
}

const config = JSON.parse(readFileSync(configPath, 'utf8'))
if (!Array.isArray(config.d1_databases) || config.d1_databases.length === 0) {
  console.error('The generated Wrangler config has no D1 binding.')
  process.exit(1)
}

if (!databaseId) {
  if (!dryRun) {
    console.error('BINFLARE_D1_DATABASE_ID is required. Copy .env.deploy.example to .env.deploy and fill it in.')
    process.exit(1)
  }
  console.warn('BINFLARE_D1_DATABASE_ID is missing; using the placeholder database_id for dry-run validation.')
} else {
  config.d1_databases[0].database_id = databaseId
  writeFileSync(configPath, `${JSON.stringify(config)}\n`)
}

const wranglerArgs = ['exec', 'wrangler', 'deploy', '--config', relative(root, configPath)]
if (dryRun) {
  wranglerArgs.push('--dry-run')
}
run('pnpm', wranglerArgs)
