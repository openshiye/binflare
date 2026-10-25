# Deployment and release checklist

This is the operational closeout. The repository is public; `wrangler.jsonc` keeps a placeholder D1 ID, and the maintainer's real IDs live in the ignored `.env.deploy`. The deployed instance is <https://binflare.199595.xyz> (Worker custom hostname on the `199595.xyz` zone).

## Prerequisites

- Cloudflare account with Workers, D1 and R2 access.
- Node.js >= 22 and pnpm 10.19.
- `wrangler login` or a Cloudflare MCP connection authorized for the target account.
- HTTPS custom domain; enable HSTS at Cloudflare before announcing a public instance.

## Release checklist

1. **CI green**
   - `.github/workflows/ci.yml` must pass on `main`: typecheck, unit, Workers/D1, project-owned compatibility fixtures, production build, deploy dry-run, E2E.
   - Compatibility is checked by `tests/compat/fixtures.json`, captured once from PrivateBin `2.1.0` and its PHP hash functions. CI does not checkout upstream or run Docker. When intentionally moving the baseline, regenerate/verify the fixtures as a separate change and update `docs/PROTOCOL.md` and `tests/compat/baseline.json`.

2. **Create or reuse resources**
   ```bash
   export CLOUDFLARE_ACCOUNT_ID=<account-id>
   export CLOUDFLARE_API_TOKEN=<token-with-workers-d1-and-r2-write>
   pnpm setup:cloudflare
   ```
   The setup script is idempotent: it finds or creates D1 `binflare`, creates R2 `binflare-pastes`, records the checked-in migrations in `d1_migrations`, configures the lifecycle rule and writes `.env.deploy`. Do not commit `.env.deploy`.

3. **R2 lifecycle rule (release blocker)**
   - For a local/operator deployment, `pnpm setup:cloudflare` configures `expire-pastes-after-366-days` on `pastes/`.
   - For a Cloudflare button deployment, the build token may not have R2 lifecycle permission. Configure the rule once after the Worker is deployed:
     ```bash
     pnpm run r2:lifecycle binflare-pastes
     ```
     Or use the dashboard: **R2 → bucket → Settings → Object lifecycle rules → Create rule**, prefix `pastes/`, delete objects after `31622400` seconds (366 days).
   - Why: burn/delete/expiry delete the D1 row first and then best-effort delete the R2 object. If the R2 delete fails, ciphertext can remain orphaned. The lifecycle rule bounds that residual exposure; it does not make burn perfectly atomic across D1 and R2.
   - Record the rule in the release notes/operator runbook. Do not announce a public instance with R2 enabled and no lifecycle rule.

4. **Configure optional services**
   ```bash
   pnpm exec wrangler secret put TURNSTILE_SECRET
   ```
   Set `TURNSTILE_SITE_KEY` as a var if Turnstile is enabled. Review `CORS_ORIGIN`, rate-limit vars, and `MAX_*` caps.

5. **Preflight**
   ```bash
   pnpm run deploy:dry-run
   ```
   Confirm D1, R2, ASSETS and vars appear in the dry-run output.

6. **Deploy**
   ```bash
   pnpm run deploy
   ```
   The script builds, injects `BINFLARE_D1_DATABASE_ID` from `.env.deploy` when present, deploys the Worker, and attempts the R2 lifecycle rule. If the token lacks R2 access, follow step 3. The Worker initializes the D1 schema on its first API request, so the Cloudflare deploy button does not need direct D1 query permission. The button uses this same script after provisioning resources and updating `wrangler.jsonc`; keep its detected commands as `npm run build` and `npm run deploy`. Use `pnpm run deploy` or `npm run deploy`; bare `pnpm deploy` is a pnpm built-in command.

7. **Post-deploy smoke**
   - The first `GET /api/health` request initializes the D1 schema.
   - `GET /api/health` returns `{ok:true}`.
   - Create/read/delete a small paste.
   - Create a burn paste; confirm it returns exactly one read.
   - Create a paste above the D1 cap (for example, 3 MB ciphertext) to exercise R2.
   - Upload a text/image/SVG attachment and verify preview/download.
   - Verify CSP/nonce headers on `/`, `/about`, API `no-store`.
   - Load `/about` directly and confirm the browser console has no React hydration errors.
   - Trigger/observe one Cron cleanup run.

8. **Large-paste CPU note**
   - The 10 MB R2 path is supported, but a 10 MB read requires the Worker to base64-encode the ciphertext. Measured on 2026-10-24 in the Workers test runtime: base64 of 10 MB ≈ 2 ms, FNV over the 13.3 MB base64 string ≈ 125 ms. Local 10 MB API benchmark: create ≈ 281 ms, read ≈ 73 ms wall time (includes local R2/D1, not just CPU).
   - This is far beyond the free plan's 10 ms CPU. A 10 MB payload cannot be advertised as free-plan-safe. Use Workers Paid for heavy large-paste usage, or lower `MAX_R2_CT_BYTES` to a measured safe value. The `bench:large` script records the local wall-time profile.

## Cloudflare MCP

The Cloudflare MCP connector can create and inspect D1/R2 resources and deploy a Worker bundle through the API. It cannot read local build artifacts, so use `pnpm run deploy` (or a short-lived scoped API token created through the connector) for the full TanStack asset build. Never commit API tokens or account secrets.
