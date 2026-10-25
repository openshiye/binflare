<p align="center">
  <img src="docs/logo.png" alt="Binflare logo" width="440">
</p>

# Binflare

[![CI](https://github.com/openshiye/binflare/actions/workflows/ci.yml/badge.svg)](https://github.com/openshiye/binflare/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Protocol: PrivateBin 2.1.0](https://img.shields.io/badge/protocol-PrivateBin%202.1.0-0f766e)](docs/PROTOCOL.md)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F6871F?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)

<p align="center">
  <a href="https://deploy.workers.cloudflare.com/?url=https://github.com/openshiye/binflare">
    <img src="https://deploy.workers.cloudflare.com/button" alt="Deploy to Cloudflare Workers">
  </a>
</p>

**Live preview:** <https://binflare.199595.xyz>

**A zero-knowledge pastebin on Cloudflare Workers, D1 and R2, speaking the PrivateBin v2 protocol.**

Pastes are encrypted in the browser before upload. The server stores ciphertext and the minimum metadata needed for expiry, burn-after-reading, comments and deletion. The decryption key lives only in the URL `#fragment` and is never sent to the server.

<p align="center">
  <img src="docs/screenshots/editor-light.png" alt="Binflare editor in light mode" width="49%">
  <img src="docs/screenshots/editor-dark.png" alt="Binflare editor in dark mode" width="49%">
</p>

## Protocol compatibility

Binflare implements the **PrivateBin v2 wire format and JSON API** as shipped in **PrivateBin 2.1.0**:

- Existing PrivateBin clients can point their base URL at Binflare and keep using the same paste format, fragment keys, expiry options, comments and delete links.
- The protocol baseline is pinned in [`docs/PROTOCOL.md`](docs/PROTOCOL.md). There is no v1/ZeroBin support.
- Binflare does **not** import or migrate pastes from an existing instance. Changing a host only works for data that exists on that host; old pastes stay on their original instance.

> **Binflare is a Cloudflare-native rewrite derived from PrivateBin, based on the PrivateBin 2.1.0 v2 protocol and JSON API.** This is a modified version, not the original PrivateBin project. PrivateBin is © Sébastien Sauvage and contributors and is licensed under Zlib/libpng. See [NOTICE](NOTICE).

## What works

- Create, read, expire, burn-after-reading and delete-token flows.
- Optional password protection (client-side only; no recovery).
- Plain text, Markdown and syntax-highlighted pastes, with a preview tab and line numbers.
- Comments / open discussion, including replies, nicknames and deterministic client-side avatars (no IP-derived metadata).
- Attachments: multiple files, drag/drop, clipboard paste, remove, filename/size display, safe previews (images, SVG sanitized, audio, video, PDF, text), download, and clone.
- Sharing: copy link/text, download, raw text, email, QR code and clone. Clones write the version-chain `children` links.
- A static, prerendered SPA shell. Paste content is fetched and decrypted in the browser; there is no server-side React rendering of paste data.
- D1 for small ciphertext; R2 for larger ciphertext (transparent to the PrivateBin v2 API). Atomic burn, lazy expiry checks and a scheduled cleanup job.
- English and Simplified Chinese UI, dark/light theme, optional Turnstile, and per-IP write rate limiting.

## How it works

```
Browser (static SPA shell)
  ├─ /?<id>#<key>       create / read / burn confirmation
  ├─ /api/*             REST aliases
  └─ fetch
       └─ Cloudflare Worker
            ├─ /         PrivateBin-compatible JSON API
            ├─ /api/*    REST API
            ├─ D1        pastes, comments, rate limits
            ├─ R2        large ciphertext
            └─ Cron      expiry cleanup
```

- The SPA shell is prerendered at build time. React does not render paste pages on the server.
- The root endpoint serves the PrivateBin-compatible API (`status: 0/1`, `?pasteid=`, `?id#key`, delete links) and the SPA shell. `/api/*` exposes the same operations with ordinary HTTP status codes.
- Storage is D1 for small ciphertext and R2 for larger ciphertext; the API still returns one PrivateBin v2 `ct`. Burn-after-reading is performed in one D1 batch transaction: select the paste and delete it (and its comments) atomically. Exactly one concurrent reader can receive the payload.

## Security model

- Encryption is client-side only: AES-GCM (new pastes) with keys derived from a 256-bit random fragment key plus an optional password. The server never receives the key or password.
- The server stores ciphertext plus metadata that must be visible to enforce policy: expiry, formatter, discussion/burn flags, comment timestamps, ciphertext size. The AAD covers the formatter/discussion/burn flags; expiry is enforced server-side.
- Paste IDs are the protocol's FNV-1a64 checksum of the ciphertext. Delete tokens are HMAC-SHA256(paste ID, per-paste salt); the salt is never returned.
- Comments inherit the paste key. Comment text and nicknames are encrypted.
- The HTML shell is served with a strict script CSP (no `unsafe-inline` for scripts), `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `noindex`. API responses are `no-store`.
- No accounts, no cookies, no analytics, no third-party fonts or scripts (except optional Turnstile).

### Honest limitations

- **Paste size**: D1 has a 2,000,000-byte row/value limit. Binflare stores up to 1.875 MB of ciphertext in D1 and spills larger ciphertext to R2, with a default 10 MB cap. Attachments live inside the ciphertext and share that cap. A deployment without an R2 binding is limited to 1.875 MB.
- **R2 cleanup**: burn/delete/expiry remove the R2 object after the D1 row is deleted. If that R2 delete fails, the D1 row is gone but ciphertext may remain orphaned in the bucket; use R2 lifecycle rules or an operator cleanup for strict storage hygiene.
- **D1 is a single primary** (read replication is not enabled). Writes are read-after-write consistent on that primary; clients far from it pay a round trip.
- **No native TTL**: expired pastes return the generic "does not exist" error on read; physical deletion happens lazily and via a Cron job.
- **Burn is an honest-server property**: the server deletes on first read, but a malicious operator could retain a copy. The same applies to any server-side pastebin.
- **The operator can serve modified JavaScript**: like any browser-delivered zero-knowledge tool, a compromised deployment can steal keys at the client. CSP and review reduce, but cannot eliminate, that risk.
- **`ctr`/`cbc` pastes are read-only compatibility**: they lack authentication and are shown with a warning. Binflare always creates AES-GCM pastes.
- **Burn + password is destructive on a wrong attempt**: the client asks for the password before reading a burn link, but reading is what consumes the document. A wrong password still destroys it.
- **Comments**: no pagination, no per-comment deletion; comments are removed with the paste.
- **No data migration**: existing PrivateBin pastes are not imported. The protocol is compatible; the data is not moved.
- **Not implemented**: v1/ZeroBin, JSON-LD, URL shortener proxies, template switching, admin CLI, multi-backend storage, automatic data migration from another instance, and translations beyond English/Simplified Chinese. These are documented as non-goals or optional integrations in [PARITY](docs/PARITY.md).
- **Free-tier envelope**: D1 free plan is 5M rows read/day, 100K rows written/day and 500 MB per database (5 GB per account); Workers free plan is 100K requests/day with 10 ms CPU. R2 has its own free storage/operation allowance. Static assets are not billed per request. Public demos should enable rate limiting and optionally Turnstile. Local measurements for the maximum 1.875 MB D1 ciphertext: ~156 ms create and ~77 ms read wall time (including local D1/network); the Workers runtime FNV takes ~25–27 ms CPU for the 2.5 MB base64 string, so max-size D1 requests can exceed the free plan's 10 ms CPU. The 10 MB R2 path is not free-plan CPU-safe either: measured FNV over the 13.3 MB base64 string is ~125 ms and a local 10 MB read is ~73 ms wall. Use Workers Paid for heavy large-paste usage, or lower the caps.

## Stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) (no Query/Form/Table/Virtual/Store/DB).
- React 19, Vite, TypeScript.
- Cloudflare Workers, D1, R2, Cron Triggers, optional Turnstile.
- Client crypto: WebCrypto (PBKDF2-SHA256, AES-GCM/CTR/CBC) and native `CompressionStream`/`DecompressionStream` for raw DEFLATE.
- Markdown: marked + DOMPurify; highlighting: highlight.js; QR: qrcode.

Exact package versions are pinned in `package.json`; upgrades are separate changes verified by the project-owned compatibility fixtures and E2E suite.

## Quick start

Prerequisites: Node.js >= 22, pnpm and a Cloudflare account.

```bash
pnpm install
cp .env.deploy.example .env.deploy
pnpm db:migrate:local
pnpm dev
```

Open `http://localhost:3000`.

`pnpm dev` runs the Vite dev server. To exercise the built Worker, including the nonce/CSP layer and the root compatibility API, run:

```bash
pnpm preview:worker
```

## Deploy

The committed `wrangler.jsonc` uses a placeholder D1 ID. Keep your account and database IDs in the ignored `.env.deploy` file; `scripts/deploy.mjs` injects them into the generated Worker config after build.

```bash
export CLOUDFLARE_ACCOUNT_ID=<account-id>
export CLOUDFLARE_API_TOKEN=<token-with-workers-d1-and-r2-write>

pnpm setup:cloudflare       # create/reuse D1 + R2, record migrations, set lifecycle, write .env.deploy
pnpm run deploy:dry-run     # validate the generated Worker config
pnpm run deploy             # build, apply D1 migrations, inject .env.deploy and deploy
```

`pnpm deploy` is reserved by pnpm itself, so use `pnpm run deploy` for this project.

The Cloudflare deploy button uses the same `deploy` script, so the button flow provisions D1/R2 and applies migrations without a second manual step.

Configure `TURNSTILE_SITE_KEY` (var) and `TURNSTILE_SECRET` (secret) if you want Turnstile; otherwise leave them empty. The Cloudflare deploy button becomes usable once the repository is public. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full checklist.

## API

- PrivateBin-compatible API: `GET /?pasteid=<id>`, `POST /` with a v2 payload, `GET /?pasteid=<id>&deletetoken=<token>`, comments via `POST /`.
- REST aliases: `POST /api/pastes`, `GET /api/pastes/:id`, `DELETE /api/pastes/:id`, `POST /api/pastes/:id/comments`.
- `GET /api/config` and `GET /api/health`.

Full contracts and examples: [docs/API.md](docs/API.md).

## Documentation

- [Protocol contract](docs/PROTOCOL.md)
- [Upstream parity matrix](docs/PARITY.md)
- [Architecture](docs/ARCHITECTURE.md)
- [API](docs/API.md)
- [Security](docs/SECURITY.md)
- [Deployment and release checklist](docs/DEPLOYMENT.md)
- [Contributing](CONTRIBUTING.md)
- [Roadmap](docs/ROADMAP.md)
- [GitHub issues](https://github.com/openshiye/binflare/issues)

## Upstream attribution

Binflare is a Cloudflare-native rewrite of the PrivateBin protocol. It is a derived, modified version of the upstream product and protocol; it does not copy upstream source code, assets, or bundled third-party libraries (including the GPLv2-licensed rawinflate). The protocol baseline is the [PrivateBin 2.1.0 release](https://github.com/PrivateBin/PrivateBin/releases/tag/2.1.0). PrivateBin is © Sébastien Sauvage and the PrivateBin contributors and is licensed under Zlib/libpng.

**Binflare is a derived, modified version; it is not the original PrivateBin project.** See [NOTICE](NOTICE) for the full attribution and compatibility scope.

## License

Binflare's own code is MIT-licensed. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
