# Roadmap

## Non-goals

- Data import/migration from existing PrivateBin instances.
- PrivateBin v1/ZeroBin compatibility.
- PHP, MySQL/PostgreSQL, S3/GCS, filesystem storage backends.
- JSON-LD endpoints, server-side URL shortener proxies, template switching, admin CLI, multi-language template packs.
- Accounts, analytics, tracking, cookies for application state.

## v0.1 — protocol + API + core UI

Release gate: an existing PrivateBin client can talk to Binflare by changing the base URL, and our own UI can complete create → share → read → burn/delete → comment.

- [x] PrivateBin 2.1.0 v2 wire format: `adata` layout, AES-GCM/CTR/CBC read, PBKDF2 `key||password`, raw DEFLATE, base58 fragment keys.
- [x] FNV-1a64 paste/comment IDs, per-paste 256-byte salt, HMAC-SHA256 delete tokens.
- [x] D1 schema, lazy expiry, atomic burn in one batch transaction, Cron cleanup.
- [x] Root compatible API (`POST /`, `GET /?pasteid=`, delete via query/body) and `/api/*` REST aliases.
- [x] Core UI: create, read, burn confirmation, password prompt, comments, copy link/delete link.
- [x] Formats: plaintext, Markdown, syntax highlighting; safe linkification.
- [x] Read-only attachment list/download for compatible pastes; `children` links.
- [x] Security headers, strict script CSP, XSS sanitization, rate limiting, optional Turnstile.
- [x] Compatibility harness (upstream CryptTool + PHP hash/HMAC), API contract tests, core E2E.
- [x] Operational docs: D1 migrations, Cron, bindings, deploy, Turnstile.

## v0.1.x

- Attachment authoring: multiple files, drag/drop, clipboard, size hints, inline previews, SVG/MIME sanitization, filenames, clone attachments.
- QR code, email, clone, raw text/download actions; clone writes `children` according to the pinned protocol baseline.
- Simplified Chinese UI, more locales, dark mode/theme polish, accessibility pass.
- Performance regression coverage for large paste reads.

## v0.2

- R2 for payloads beyond the D1 row cap.
- Optional D1 read replication, with documented consistency semantics.
- More protocol-baseline upgrades as separate, harness-verified changes.
- EdgeOne Makers port (China distribution), evaluated independently.

## Version policy

TanStack Start, Router, Vite, React, Wrangler and the Cloudflare Vite plugin are pinned to exact versions. Upgrades are separate changes with the full compatibility harness and E2E suite. The PrivateBin protocol baseline is pinned to a release tag in `docs/PROTOCOL.md` and `tests/compat/baseline.json`; do not track a floating major/minor.
