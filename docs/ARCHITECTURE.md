# Architecture

## Components

```
Cloudflare Worker (src/server.ts)
  ├─ fetch: API dispatch → TanStack Start server routes
  │         HTML dispatch → ASSETS.fetch('/index.html')
  └─ scheduled: expired-row cleanup

D1
  ├─ pastes
  ├─ comments
  └─ rate_limits

Static assets (built SPA shell + JS/CSS)
```

The frontend is built by TanStack Start in SPA mode. The build prerenders `index.html`; React does not render paste data on the server. The Worker only handles API requests and serves the static shell for HTML routes.

## Routing

- `/api/*`: server routes in `src/routes/api/`.
- `/`: server handlers for the PrivateBin-compatible API plus the React page component.
- Everything else (except static assets): the SPA shell.

The root endpoint is Worker-first because the upstream API uses `POST /` and `GET /?pasteid=`. The Worker decides whether a request is API or HTML; it never renders React on the server.

### CSP/nonce decision (resolved)

The built SPA shell contains inline hydration scripts. Binflare therefore uses the nonce branch:

- HTML requests are Worker-first (`/*` with assets, favicon, robots and `theme.js` excluded); the Worker fetches the prerendered shell from `ASSETS`, injects a per-request nonce into every `script` tag with HTMLRewriter, and sets the CSP and other security headers itself.
- `_headers` is only a fallback for assets that Cloudflare serves directly; it is not relied on for Worker-produced HTML.
- If a future Start build emits only external scripts, the HTMLRewriter/nonce layer can be removed, `run_worker_first` can be reduced to `/` + `/api/*`, and `script-src 'self'` can be used instead. This must be re-decided from the actual built shell, not assumed.
- The shell is `no-store`; hashed assets are immutable.

## Request flows

### Create

1. Browser generates a 256-bit key, derives the AES key (PBKDF2), compresses and encrypts the JSON payload.
2. `POST /` (or `/api/pastes`) with the v2 body.
3. Server validates the shape/spec, enforces size and rate limits, computes FNV ID, generates a per-paste salt and HMAC delete token, and stores ciphertext in D1 (small) or R2 (large) plus metadata in D1.
4. Response contains the ID and delete token (root compat) or a REST-shaped body (`/api`). The browser builds `/?<id>#<key>` and shows copy/delete links.

### Read

1. Browser reads the ID from the query and the key from the fragment.
2. For burn links (`#-`), the browser asks for confirmation before any request.
3. `GET /?pasteid=<id>` with `X-Requested-With: JSONHttpRequest`.
4. Server:
   - Missing/expired: delete lazily if applicable; return the generic error.
   - Burn: fetch R2 ciphertext if needed, then execute one D1 batch (`SELECT`, delete comments, delete paste) and return the payload only to the batch that selected the row; delete the R2 object after the batch commits.
   - Normal: select the paste and comments; fetch R2 ciphertext if the row has an `r2_key`; return ciphertext and metadata without salt.
5. Browser decrypts with the fragment key and optional password; renders.

### Delete

- Normal navigation: `GET /?pasteid=<id>&deletetoken=<token>`; the server verifies the HMAC, deletes comments + paste in a batch, and returns a minimal HTML result page.
- API clients: `POST /` or `DELETE /` with `{pasteid,deletetoken}`; or `DELETE /api/pastes/:id` with a bearer token. Wrong token never deletes.

### Comment

- `POST /` with the comment body. Server verifies the paste exists, discussion is enabled, the parent belongs to the paste, and the ciphertext passes v2 validation. `created` is server time; no IP-derived icon is stored. The client renders a deterministic avatar from the comment ID.

## D1 schema

See `migrations/0001_init.sql` and `migrations/0002_r2.sql`. Key decisions:

- `pastes.ct` is a BLOB for small ciphertext; API responses base64-encode it.
- `pastes.r2_key` is set when the ciphertext is stored in R2 (`pastes/<id>`); `ct` is empty for those rows.
- `pastes.adata` stores the exact JSON array string for AAD reconstruction.
- `pastes.salt` is the 512-hex per-paste secret; never returned.
- `expire_date` is epoch seconds; `NULL` means never.
- `comments.parent_id` is the paste ID for root comments or another comment ID for replies.
- `rate_limits` is a fixed-window counter keyed by operation + SHA-256 of the client IP.

### Atomic burn

Primary implementation: one D1 `batch()` containing:

1. `SELECT` the paste row.
2. `DELETE FROM comments WHERE paste_id = ?`.
3. `DELETE FROM pastes WHERE id = ?`.

D1 batch statements execute sequentially and non-concurrently in a transaction. A concurrent first read cannot interleave between the select and delete. If the 20-way concurrency test does not produce exactly one successful read, fall back to `DELETE FROM pastes WHERE id = ? RETURNING ...` to decide the winner, then delete comments in the same batch.

### Expiry and cleanup

- Reads check `expire_date <= now` and delete lazily.
- A Cron trigger runs every 15 minutes, deleting expired pastes/comments in bounded batches, deleting their R2 objects, and pruning stale rate-limit rows.
- No native D1 TTL is assumed. A failed R2 delete can leave orphaned ciphertext; add R2 lifecycle rules or operator cleanup for strict hygiene.

### Rate limits

- Fixed-window D1 upsert; default 10 seconds per IP, matching upstream's default traffic limit.
- Optional Turnstile verification on create/comment when `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET` are configured.
- IP addresses are hashed before storage; raw IPs are not logged.

## Configuration

| Binding / var | Purpose |
|---|---|
| `DB` | D1 database |
| `PASTES` | R2 bucket for large ciphertext; bucket `binflare-pastes` |
| `ASSETS` | Static assets binding for the SPA shell |
| `MAX_PASTE_CT_BYTES` | D1 ciphertext cap; default 1875000 |
| `MAX_PASTE_CT_BASE64` | D1 base64 request cap; default 2500000 |
| `MAX_R2_CT_BYTES` | R2 ciphertext cap; default 10000000 |
| `MAX_R2_CT_BASE64` | R2 base64 request cap; default 13400000 |
| `RATE_LIMIT_WINDOW_SECONDS` | Fixed window; default 10 |
| `RATE_LIMIT_MAX_REQUESTS` | Requests per window; default 1 |
| `TURNSTILE_SITE_KEY` | Public site key; empty disables Turnstile |
| `TURNSTILE_SECRET` | Secret key; store with `wrangler secret put` |
| `CORS_ORIGIN` | Optional origin for REST CORS; empty = same-origin |

Cron: `*/15 * * * *`. D1 migrations live in `migrations/` and are applied with `wrangler d1 migrations apply`. Create the R2 bucket with `wrangler r2 bucket create binflare-pastes`.

## Performance notes

- The HTML shell is static; no React SSR.
- API work is validation + D1 I/O; PBKDF2/encryption happen in the browser.
- Large ciphertext reads require base64 encoding in the Worker. Native `Uint8Array` base64 is used when available (chunked fallback otherwise). Local measurements for the maximum 1.875 MB D1 ciphertext: ~156 ms create and ~77 ms read wall time. Node measured the WASM FNV at ~6 ms for the 2.5 MB base64 string, but the Workers runtime measured ~25–27 ms; max-size D1 creates can therefore exceed the free plan's 10 ms CPU. Lower `MAX_PASTE_CT_BYTES`, use a paid plan, or use R2 for large payloads. The FNV path uses a small inline WebAssembly module with a pure-JS fallback. R2 reads add object-fetch wall time; measure 10 MB reads before claiming free-plan CPU suitability.
- Attachments are encrypted inside the v2 payload; previews are generated client-side. Images/audio/video use data URLs, PDFs use a blob iframe, SVG is sanitized with DOMPurify before a blob URL, and unsafe MIME types are download-only. QR codes are generated locally with qrcode; email uses a mailto link.
