# API

Binflare exposes two surfaces over the same storage service:

1. **PrivateBin-compatible root API** — the compatibility surface used by existing clients. App errors use HTTP 200 with `status: 0/1`.
2. **`/api/*` REST aliases** — ordinary HTTP status codes and REST-shaped bodies.

All request bodies contain **ciphertext only**. The server never accepts plaintext, a password or a key.

## PrivateBin-compatible API

### Create

```http
POST /
Content-Type: application/json
X-Requested-With: JSONHttpRequest

{
  "v": 2,
  "adata": [
    ["<iv base64>", "<salt base64>", 100000, 256, 128, "aes", "gcm", "zlib"],
    "plaintext",
    0,
    0
  ],
  "ct": "<base64>",
  "meta": { "expire": "1week" }
}
```

Response:

```json
{
  "status": 0,
  "id": "0123456789abcdef",
  "url": "/?0123456789abcdef",
  "deletetoken": "64 lowercase hex characters"
}
```

The client appends `#<base58-key>` (or `#-<key>` for burn) to build the public link. The server never receives the key.

### Read

```http
GET /?pasteid=0123456789abcdef
X-Requested-With: JSONHttpRequest
```

Response:

```json
{
  "status": 0,
  "id": "0123456789abcdef",
  "url": "/?0123456789abcdef",
  "v": 2,
  "adata": ["..."],
  "ct": "<base64>",
  "meta": { "time_to_live": 604800 },
  "comments": [],
  "comment_count": 0,
  "comment_offset": 0
}
```

- `meta.salt` and `meta.expire_date` are never returned.
- Burn pastes are deleted by this request; a second read returns the generic error.
- Missing, expired, burned and deleted all return the same generic message.

### Delete

Normal browser navigation:

```
GET /?pasteid=<id>&deletetoken=<token>
```

This returns a minimal HTML result page. JSON API clients can use the header above; the result is `{"status":0,"id":"<id>","url":"..."}` or `{"status":1,"message":"..."}`.

API clients may also use:

```http
POST /
Content-Type: application/json
X-Requested-With: JSONHttpRequest

{ "pasteid": "<id>", "deletetoken": "<token>" }
```

or the same body with `DELETE /`.

### Comment

```http
POST /
Content-Type: application/json
X-Requested-With: JSONHttpRequest

{
  "v": 2,
  "adata": ["<iv base64>", "<salt base64>", 100000, 256, 128, "aes", "gcm", "zlib"],
  "ct": "<base64>",
  "pasteid": "<paste id>",
  "parentid": "<paste id or comment id>"
}
```

Response: `{"status":0,"id":"<comment id>","url":"/?<comment id>"}`.

## REST aliases

| Method | Path | Success | Notes |
|---|---|---|---|
| `POST` | `/api/pastes` | 201 `{id, deleteToken, expiresAt}` | Same v2 body as root create |
| `GET` | `/api/pastes/:id` | 200 v2 fields + comments | No salt; burn consumes |
| `DELETE` | `/api/pastes/:id` | 204 | `Authorization: Bearer <deleteToken>` |
| `POST` | `/api/pastes/:id/comments` | 201 `{id, createdAt}` | Body `{v, adata, ct, parentId?}` |
| `GET` | `/api/config` | 200 | Expiry options, limits, features |
| `GET` | `/api/health` | 200 `{ok:true}` | No secrets |

REST status codes:

- 400 invalid request/shape/spec.
- 403 wrong delete token or Turnstile failure.
- 404 missing/expired/burned/deleted (generic body).
- 413 payload too large.
- 429 rate limited (`Retry-After`).
- 500 internal error (no stack trace).

Error body:

```json
{ "error": { "code": "not_found", "message": "Document does not exist, has expired or has been deleted." } }
```

## Config

`GET /api/config` returns public values:

```json
{
  "expire": ["5min", "10min", "1hour", "1day", "1week", "1month", "1year", "never"],
  "expireDefault": "1week",
  "formatters": ["plaintext", "markdown", "syntaxhighlighting"],
  "formatterDefault": "plaintext",
  "maxCiphertextBytes": 1875000,
  "maxCiphertextBase64": 2500000,
  "features": {
    "discussion": true,
    "password": true,
    "burn": true,
    "attachments": false,
    "qr": false,
    "email": false
  },
  "turnstileSiteKey": ""
}
```

`features.attachments` is false in v0.1 because attachment authoring is deferred; attachment payloads from compatible clients are still readable.

## Headers

- `Cache-Control: no-store` on all paste/comment API responses.
- `X-Content-Type-Options: nosniff`.
- `Referrer-Policy: no-referrer`.
- Root JSON API: `Access-Control-Allow-Origin: *` (upstream-compatible).
- REST CORS: same-origin by default; `CORS_ORIGIN` can allow one origin.
- HTML shell: strict CSP, `X-Frame-Options: DENY`, `noindex`.

## Limits and validation

- Ciphertext: base64 request <= 2,500,000 characters; decoded <= 1,875,000 bytes.
- Spec: v2 enums/ranges, not fixed defaults. 600000 iterations and a 12-byte IV are valid.
- Expiry: `5min`, `10min`, `1hour`, `1day`, `1week`, `1month`, `1year`, `never`.
- Rate limit: default one create/comment per 10 seconds per IP; configurable.
- Comments require `discussion=1`; burn + discussion is rejected.

## Not part of the API

JSON-LD, URL shortener proxies, template selection and admin operations are not implemented in v0.1. Requests for those paths may return 404.
