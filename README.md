<p align="center">
  <img src="docs/logo.png" alt="Binflare logo" width="440">
</p>

# Binflare

**A zero-knowledge pastebin on Cloudflare Workers and D1, speaking the PrivateBin v2 protocol.**

Pastes are encrypted in the browser before upload. The server stores ciphertext and the minimum metadata needed for expiry, burn-after-reading, comments and deletion. The decryption key lives only in the URL `#fragment` and is never sent to the server.

## Protocol compatibility

Binflare implements the **PrivateBin v2 wire format and JSON API** as shipped in **PrivateBin 2.1.0**:

- Existing PrivateBin clients can point their base URL at Binflare and keep using the same paste format, fragment keys, expiry options, comments and delete links.
- The protocol baseline is pinned in [`docs/PROTOCOL.md`](docs/PROTOCOL.md). There is no v1/ZeroBin support.
- Binflare does **not** import or migrate pastes from an existing instance. Changing a host only works for data that exists on that host; old pastes stay on their original instance.

> **Binflare is an independent implementation. It is not affiliated with, endorsed by, or an official port of the PrivateBin project.** PrivateBin is © Sébastien Sauvage and contributors and is licensed under Zlib/libpng. See [NOTICE](NOTICE).

## What works in v0.1

- Create, read, expire, burn-after-reading and delete-token flows.
- Optional password protection (client-side only; no recovery).
- Plain text, Markdown and syntax-highlighted pastes, with a preview tab.
- Comments / open discussion, including replies and optional nicknames.
- PrivateBin-compatible pastes and comments, including attachment payloads (read-only in v0.1: files are listed and downloadable, without inline previews).
- Version-chain `children` links are preserved and shown when present.
- A static, prerendered SPA shell. Paste content is fetched and decrypted in the browser; there is no server-side React rendering of paste data.
- D1 storage, atomic burn on first read, lazy expiry checks and a scheduled cleanup job.
- Optional Turnstile for public demos, plus per-IP write rate limiting.

Attachment authoring, inline previews, QR/email/clone actions, a Chinese UI and theme polish are v0.1.x work. See [ROADMAP](docs/ROADMAP.md).

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
            └─ Cron      expiry cleanup
```

- The SPA shell is prerendered at build time. React does not render paste pages on the server.
- The root endpoint serves the PrivateBin-compatible API (`status: 0/1`, `?pasteid=`, `?id#key`, delete links) and the SPA shell. `/api/*` exposes the same operations with ordinary HTTP status codes.
- Storage is Cloudflare D1. Burn-after-reading is performed in one D1 batch transaction: select the paste and delete it (and its comments) atomically. Exactly one concurrent reader can receive the payload.

## Security model

- Encryption is client-side only: AES-GCM (new pastes) with keys derived from a 256-bit random fragment key plus an optional password. The server never receives the key or password.
- The server stores ciphertext plus metadata that must be visible to enforce policy: expiry, formatter, discussion/burn flags, comment timestamps, ciphertext size. The AAD covers the formatter/discussion/burn flags; expiry is enforced server-side.
- Paste IDs are the protocol's FNV-1a64 checksum of the ciphertext. Delete tokens are HMAC-SHA256(paste ID, per-paste salt); the salt is never returned.
- Comments inherit the paste key. Comment text and nicknames are encrypted.
- The HTML shell is served with a strict script CSP (no `unsafe-inline` for scripts), `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and `noindex`. API responses are `no-store`.
- No accounts, no cookies, no analytics, no third-party fonts or scripts (except optional Turnstile).

### Honest limitations

- **Paste size**: D1 has a 2,000,000-byte row/value limit. Binflare caps ciphertext at 1.875 MB (base64 request up to 2.5 MB). Attachments are inside the ciphertext and share that cap. R2 for larger payloads is planned.
- **D1 is a single primary** (read replication is not enabled). Writes are read-after-write consistent on that primary; clients far from it pay a round trip.
- **No native TTL**: expired pastes return the generic "does not exist" error on read; physical deletion happens lazily and via a Cron job.
- **Burn is an honest-server property**: the server deletes on first read, but a malicious operator could retain a copy. The same applies to any server-side pastebin.
- **The operator can serve modified JavaScript**: like any browser-delivered zero-knowledge tool, a compromised deployment can steal keys at the client. CSP and review reduce, but cannot eliminate, that risk.
- **`ctr`/`cbc` pastes are read-only compatibility**: they lack authentication and are shown with a warning. Binflare always creates AES-GCM pastes.
- **Burn + password is destructive on a wrong attempt**: the client asks for the password before reading a burn link, but reading is what consumes the document. A wrong password still destroys it.
- **Comments**: no pagination, no per-comment deletion; comments are removed with the paste.
- **No data migration**: existing PrivateBin pastes are not imported. The protocol is compatible; the data is not moved.
- **Not implemented in v0.1**: v1/ZeroBin, JSON-LD, URL shortener proxies, template switching, admin CLI, multi-backend storage, 39 locales.
- **Free-tier envelope**: D1 free plan is 5M rows read/day, 100K rows written/day and 500 MB per database (5 GB per account); Workers free plan is 100K requests/day with 10 ms CPU. Static assets are not billed per request. Public demos should enable rate limiting and optionally Turnstile. Local measurements for the maximum 1.875 MB ciphertext: ~156 ms create and ~77 ms read wall time (including local D1/network); the Workers runtime FNV takes ~27 ms CPU for the 2.5 MB base64 string, so max-size requests can exceed the free plan's 10 ms CPU. Lower `MAX_PASTE_CT_BYTES`, use a paid plan, or wait for the R2 path if that matters for your deployment.

## Stack

- [TanStack Start](https://tanstack.com/start) + [TanStack Router](https://tanstack.com/router) (no Query/Form/Table/Virtual/Store/DB).
- React 19, Vite, TypeScript.
- Cloudflare Workers, D1, Cron Triggers, optional Turnstile.
- Client crypto: WebCrypto (PBKDF2-SHA256, AES-GCM/CTR/CBC) and native `CompressionStream`/`DecompressionStream` for raw DEFLATE.
- Markdown: marked + DOMPurify; highlighting: highlight.js.

Exact package versions are pinned in `package.json`; upgrades are separate changes verified by the compatibility harness.

## Quick start

Prerequisites: Node.js >= 22, pnpm, a Cloudflare account, and Wrangler login.

```bash
pnpm install
# create a D1 database and put its id into wrangler.jsonc
pnpm exec wrangler d1 create binflare
pnpm db:migrate:local
pnpm dev
```

Open `http://localhost:3000`.

`pnpm dev` runs the Vite dev server. To exercise the built Worker (including the nonce/CSP layer and the root compatibility API), run:

```bash
pnpm preview:worker
```

For a production deploy:

```bash
pnpm db:migrate:remote
pnpm deploy
```

Configure `TURNSTILE_SITE_KEY` (var) and `TURNSTILE_SECRET` (secret) if you want Turnstile; otherwise leave them empty. The optional one-click Deploy to Cloudflare button becomes usable when the repository is public. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for bindings, Cron and configuration.

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
- [Roadmap](docs/ROADMAP.md)

## Upstream attribution

Binflare is an independent reimplementation of the PrivateBin protocol. No upstream source code, assets, or bundled third-party libraries (including the GPLv2-licensed rawinflate) are used. The protocol baseline is the PrivateBin 2.1.0 release. PrivateBin is © Sébastien Sauvage and the PrivateBin contributors and is licensed under Zlib/libpng.

**Binflare is not affiliated with or endorsed by the PrivateBin project, and is not an official PrivateBin distribution.**

## License

Binflare's own code is MIT-licensed. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
