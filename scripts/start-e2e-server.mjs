import { execFileSync, spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const port = process.env.PORT ?? '3012'

execFileSync('pnpm', ['db:migrate:local'], { stdio: 'inherit' })
writeFileSync(
  'dist/server/.dev.vars',
  ['RATE_LIMIT_MAX_REQUESTS=1000', 'RATE_LIMIT_WINDOW_SECONDS=1', 'TURNSTILE_SITE_KEY=', ''].join('\n'),
)

const child = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--config',
    'dist/server/wrangler.json',
    '--persist-to',
    '.wrangler/state',
    '--port',
    port,
  ],
  { stdio: 'inherit' },
)

function shutdown() {
  child.kill('SIGTERM')
  process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
child.on('exit', (code) => process.exit(code ?? 0))
