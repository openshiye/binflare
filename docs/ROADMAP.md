# Roadmap

## Non-goals

- Data import/migration from existing PrivateBin instances.
- PrivateBin v1/ZeroBin compatibility.
- PHP, MySQL/PostgreSQL, S3/GCS, filesystem storage backends.
- JSON-LD endpoints, server-side URL shortener proxies, template switching, admin CLI, multi-template packs.
- Accounts, analytics, tracking, cookies for application state.

## v0.1 — protocol + complete client

Release gate: an existing PrivateBin client can talk to Binflare by changing the base URL, and the Binflare UI covers the current client surface.

- [x] PrivateBin 2.1.0 v2 wire format: `adata` layout, AES-GCM/CTR/CBC read, PBKDF2 `key||password`, raw DEFLATE, base58 fragment keys.
- [x] FNV-1a64 paste/comment IDs, per-paste 256-byte salt, HMAC-SHA256 delete tokens.
- [x] D1 schema, lazy expiry, atomic burn in one batch transaction, Cron cleanup.
- [x] R2 spillover for large ciphertext; transparent v2 `ct` on read; delete/expiry cleanup.
- [x] Root compatible API (`POST /`, `GET /?pasteid=`, delete via query/body) and `/api/*` REST aliases.
- [x] Core UI: create, read, burn confirmation, password prompt, comments, copy link/delete link.
- [x] Attachments: multiple files, drag/drop, clipboard, remove, names/sizes, safe image/SVG/audio/video/PDF/text previews, download, clone.
- [x] Sharing: copy link/text, download, raw text, email, QR code, clone; clone writes `children`.
- [x] Formats: plaintext, Markdown, syntax highlighting with line numbers, safe linkification.
- [x] English/Simplified Chinese UI, dark/light theme, language and theme persistence.
- [x] Client-side comment avatars (deterministic from comment ID; no IP metadata).
- [x] Security headers, strict script CSP, XSS sanitization, rate limiting, optional Turnstile.
- [x] Compatibility harness (upstream CryptTool + PHP hash/HMAC), API contract tests, core E2E.
- [x] Operational docs: D1/R2 bindings, migrations, Cron, deploy, Turnstile.

## v0.1.x

- More locales (translation loader/dictionaries).
- R2 lifecycle rules and orphan cleanup tooling.
- Accessibility and visual polish; performance regression coverage for 10 MB R2 reads.
- Optional external shortener integration, if it can be done without silently leaking keys.

## v0.2

- Optional D1 read replication, with documented consistency semantics.
- More protocol-baseline upgrades as separate, harness-verified changes.
- EdgeOne Makers port (China distribution), evaluated independently.

## Version policy

TanStack Start, Router, Vite, React, Wrangler and the Cloudflare Vite plugin are pinned to exact versions. Upgrades are separate changes with the full compatibility harness and E2E suite. The PrivateBin protocol baseline is pinned to a release tag in `docs/PROTOCOL.md` and `tests/compat/baseline.json`; do not track a floating major/minor.

The release checklist (CI, D1/R2 creation, R2 lifecycle rule, migrations, deploy smoke, large-paste CPU) is in [DEPLOYMENT.md](DEPLOYMENT.md).
