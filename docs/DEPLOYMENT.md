# Deployment and release checklist

This is the operational closeout. The repository is private and the checked-in `wrangler.jsonc` contains a placeholder `database_id`; deployment is a separate decision.

## Prerequisites

- Cloudflare account with Workers, D1 and R2 access.
- Node.js >= 22 and pnpm 10.19.
- `wrangler login` or a Cloudflare MCP connection authorized for the target account.
- HTTPS custom domain; enable HSTS at Cloudflare before announcing a public instance.

## Release checklist

1. **CI green**
   - `.github/workflows/ci.yml` must pass on `main`: typecheck, unit, Workers/D1, project-owned compatibility fixtures, production build, E2E.
   - Compatibility is checked by `tests/compat/fixtures.json`, captured once from PrivateBin `2.1.0` and its PHP hash functions. CI does not checkout upstream or run Docker. When intentionally moving the baseline, regenerate/verify the fixtures as a separate change and update `docs/PROTOCOL.md` and `tests/compat/baseline.json`.

2. **Create resources**
   ```bash
   pnpm exec wrangler d1 create binflare
   pnpm exec wrangler r2 bucket create binflare-pastes
   ```
   Put the returned D1 `database_id` into `wrangler.jsonc`. Create the R2 bucket before deploying the R2 binding.

3. **R2 lifecycle rule (release blocker)**
   - Configure an R2 lifecycle rule on `binflare-pastes` that expires objects after the maximum supported retention plus a small buffer (for example, 366 days).
   - Why: burn/delete/expiry delete the D1 row first and then best-effort delete the R2 object. If the R2 delete fails, ciphertext can remain orphaned. The lifecycle rule bounds that residual exposure; it does not make burn perfectly atomic across D1 and R2.
   - Record the rule in the release notes/operator runbook. Do not deploy a public instance with R2 enabled and no lifecycle rule.

4. **Migrate and configure**
   ```bash
   pnpm db:migrate:remote
   # optional public demo
   pnpm exec wrangler secret put TURNSTILE_SECRET
   ```
   Set `TURNSTILE_SITE_KEY` as a var if Turnstile is enabled. Review `CORS_ORIGIN`, rate-limit vars, and `MAX_*` caps.

5. **Preflight**
   ```bash
   pnpm build
   pnpm exec wrangler deploy --config dist/server/wrangler.json --dry-run
   ```
   Confirm D1, R2, ASSETS and vars appear in the dry-run output.

6. **Deploy**
   ```bash
   pnpm deploy
   ```
   `pnpm deploy` targets the generated `dist/server/wrangler.json` so the Vite/TanStack server bundle and assets are used.

7. **Post-deploy smoke**
   - `GET /api/health` returns `{ok:true}`.
   - Create/read/delete a small paste.
   - Create a burn paste; confirm it returns exactly one read.
   - Create a paste above the D1 cap (for example, 3 MB ciphertext) to exercise R2.
   - Upload a text/image/SVG attachment and verify preview/download.
   - Verify CSP/nonce headers on `/`, `/about`, API `no-store`.
   - Trigger/observe one Cron cleanup run.

8. **Large-paste CPU note**
   - The 10 MB R2 path is supported, but a 10 MB read requires the Worker to base64-encode the ciphertext. Measured on 2026-10-24 in the Workers test runtime: base64 of 10 MB ≈ 2 ms, FNV over the 13.3 MB base64 string ≈ 125 ms. Local 10 MB API benchmark: create ≈ 281 ms, read ≈ 73 ms wall time (includes local R2/D1, not just CPU).
   - This is far beyond the free plan's 10 ms CPU. A 10 MB payload cannot be advertised as free-plan-safe. Use Workers Paid for heavy large-paste usage, or lower `MAX_R2_CT_BYTES` to a measured safe value. The `bench:large` script records the local wall-time profile.

## Cloudflare MCP

The Cloudflare MCP connector is configured in the Qoder app, but its tools were not exposed in the session used to implement this repository. Use it (or `wrangler`) only after the account authorization and resource IDs are confirmed. Never put API tokens or account secrets in the repository.
