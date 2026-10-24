# Protocol contract

Binflare targets the PrivateBin **v2** protocol. The baseline is the upstream release tag below; changes follow the same rule: pin a release, run the compatibility harness, then update this file.

```json
{
  "project": "PrivateBin",
  "releaseTag": "2.1.0",
  "referenceCommit": "a88aa802a58bc4c93c8cd4b6623e7b9c99d3105c",
  "referenceDescribe": "2.1.0-83-ga88aa802",
  "harnessSource": "git archive 2.1.0"
}
```

The reference checkout is used for behavioral study and fixtures only. Binflare contains no copied upstream source or assets.

## Payloads

Paste:

```json
{
  "v": 2,
  "adata": [
    ["<iv base64>", "<salt base64>", 100000, 256, 128, "aes", "gcm", "zlib"],
    "markdown",
    0,
    0
  ],
  "ct": "<base64>",
  "meta": { "expire": "1week" }
}
```

Comment:

```json
{
  "v": 2,
  "adata": ["<iv base64>", "<salt base64>", 100000, 256, 128, "aes", "gcm", "zlib"],
  "ct": "<base64>",
  "pasteid": "<16 lowercase hex>",
  "parentid": "<16 lowercase hex>"
}
```

- Paste `adata[0]` is the cipher spec; comment `adata` is the spec itself.
- Paste keys are exactly `adata`, `v`, `ct`, `meta`. Comment keys are exactly `adata`, `v`, `ct`, `pasteid`, `parentid`.
- `meta` for a paste contains only `expire`. Comments have no meta in the request.
- Ciphertext, IV and salt are standard base64. The fragment key is base58.

## Client encryption

### Key

- A 256-bit random key, represented as a binary string in the upstream client and encoded with base58:
  `123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz`
- The key is stored only in the URL fragment: `/?<id>#<base58-key>`.
- A burn-after-reading link prefixes the fragment with `-`: `/?<id>#-<base58-key>`. The client must ask for confirmation before issuing the read request.

### Spec

Default spec for pastes created by Binflare:

| index | value | meaning |
|---|---|---|
| 0 | random 16 bytes, base64 | IV |
| 1 | random 8 bytes, base64 | salt |
| 2 | 100000 | PBKDF2 iterations |
| 3 | 256 | AES key size |
| 4 | 128 | GCM tag size |
| 5 | `aes` | algorithm |
| 6 | `gcm` | mode |
| 7 | `zlib` or `none` | compression |

Readers must not assume these defaults. Use the values in the payload's spec (for example, third-party clients may use 600000 iterations and a 12-byte IV).

### Key derivation

```
bytes = keyBytes || passwordBytes
derived = PBKDF2-SHA256(bytes, salt, iterations, keySize)
```

`keyBytes` is the base58-decoded fragment key. `passwordBytes` is produced with the upstream `stringToArraybuffer` semantics: for each UTF-16 code unit, take the low 8 bits; do not UTF-8 encode the password first. This is required to open pastes created by upstream clients with non-ASCII passwords.

### Cipher

- New pastes: AES-GCM. `additionalData = stringToArraybuffer(JSON.stringify(adata))`; `tagLength = spec[4]`.
- Readers also accept `ctr` and `cbc` for v2 compatibility. AES-CTR must be constructed with `length: 128` (full-block counter) to match the upstream SJCL counter semantics. CBC has no AAD/tag. The UI marks these as unauthenticated. The upstream 2.1.0 web client only creates GCM.
- Plaintext is UTF-8 encoded, then raw DEFLATE compressed when `spec[7] === "zlib"`; otherwise used uncompressed.
- The resulting ciphertext+tag bytes are converted to a binary string and base64-encoded.

### Plaintext

Paste:

```json
{
  "paste": "text",
  "attachment": ["data:...base64"],
  "attachment_name": ["name.txt"],
  "children": ["https://..."]
}
```

Comment:

```json
{ "comment": "text", "nickname": "optional" }
```

`attachment`, `attachment_name` and `children` are optional. `children` is a version-chain field; readers preserve and display safe `http(s)` links. Binflare's clone action appends the current document URL to `children` before creating the new document, so the chain is preserved without changing the v2 shape. More locales are future work; the protocol itself is locale-neutral.

## IDs, salt and deletion tokens

These are server-side semantics, not part of the encryption format:

- Paste ID: `fnv1a64(base64_ciphertext)` as 16 lowercase hex characters.
- Comment ID: `fnv1a64(base64_comment_ciphertext)` as 16 lowercase hex characters.
- Per-paste salt: 256 random bytes, stored as 512 lowercase hex characters. It is stripped from every read response.
- Delete token: `HMAC-SHA256(pasteId, salt)` as 64 lowercase hex characters. The salt is ASCII hex bytes; the HMAC key is the salt string.
- Duplicate paste/comment ID: reject with the upstream collision message.

The PHP reference uses `hash('fnv1a64', $ct)` and `hash_hmac('sha256', $id, $salt)`; the compatibility harness cross-checks both with a pinned PHP runtime.

## URLs and HTTP

| Operation | Contract |
|---|---|
| Public link | `/?<16hex>#<base58>` |
| Burn link | `/?<16hex>#-<base58>` |
| Read | `GET /?pasteid=<id>` with `X-Requested-With: JSONHttpRequest` |
| Create | `POST /` with a v2 JSON body; `PUT /` also accepted |
| Delete link | `GET /?pasteid=<id>&deletetoken=<token>` (normal navigation) |
| Delete API | `POST /` or `DELETE /` with `{ "pasteid": "...", "deletetoken": "..." }` |
| Comment | `POST /` with the comment body |
| JSON detection | `X-Requested-With: JSONHttpRequest`, or an Accept header negotiated to JSON |

### Responses

Create:

```json
{ "status": 0, "id": "<16hex>", "url": "<path>?<id>", "deletetoken": "<64hex>" }
```

Read:

```json
{
  "status": 0,
  "id": "<16hex>",
  "url": "<path>?<id>",
  "v": 2,
  "adata": ["..."],
  "ct": "<base64>",
  "meta": { "time_to_live": 604800 },
  "comments": [],
  "comment_count": 0,
  "comment_offset": 0
}
```

Comment create:

```json
{ "status": 0, "id": "<comment id>", "url": "<path>?<comment id>" }
```

Errors use HTTP 200 with `{"status":1,"message":"..."}`. The message strings match upstream English, including:

- `Invalid data.`
- `Document does not exist, has expired or has been deleted.`
- `Wrong deletion token. Document was not deleted.`
- `Document is limited to %s of encrypted data.`
- `Please wait %d seconds between each post.`
- `Invalid document ID.`
- `You are unlucky. Try again.`

### Expiry and burn

- Options: `5min`, `10min`, `1hour`, `1day`, `1week`, `1month`, `1year`, `never`; default `1week`.
- `expire_date` is server time in seconds; `never` stores no date.
- Reads return `time_to_live` and strip `expire_date` and `salt`.
- Expired reads return the generic error and delete the paste lazily. A Cron job removes expired rows in batches.
- Burn pastes are deleted on first read. The response is returned after the deletion commits, so exactly one concurrent reader wins. Burn and open discussion are mutually exclusive.
- Burn + password: the server cannot know whether a password is set. The client should ask for the password before the destructive read, but a wrong password still consumes the paste.

### Comments

- `meta.created` is server time in seconds; `meta.icon` is omitted. The client renders a deterministic avatar from the comment ID, so no IP-derived identifier is stored or transmitted.
- `parentid` is the paste ID for a root comment, or another comment ID for a reply. The server validates that the parent belongs to the same paste.
- Comments are deleted with the paste. There is no pagination or per-comment delete.

### Validation

Server-side validation mirrors the upstream `FormatV2` enums and ranges:

- `v` is numeric and `>= 2`.
- spec length is at least 8.
- IV/salt/ciphertext are valid base64; IV string length <= 24, salt string length <= 14.
- iterations is an integer `> 10000`.
- key size is 128, 192 or 256; tag size is 64, 96 or 128.
- algorithm is `aes`; mode is `ctr`, `cbc` or `gcm`; compression is `zlib` or `none`.
- Paste meta is exactly `{expire}`; formatter must be enabled; discussion/burn are 0 or 1; burn + discussion is rejected.

It does not hardcode the default IV length, salt length or iteration count.

## Storage and size

The v2 wire format is unchanged. Binflare stores small ciphertext in D1 and large ciphertext in R2 (`pastes/<id>`), returning a single base64 `ct` to clients either way. D1 ciphertext is capped at 1.875 MB by default; R2 ciphertext is capped at 10 MB. Attachments are inside the encrypted payload. A deployment without an R2 binding is limited to the D1 cap.

Burn/delete/expiry remove the D1 row and then the R2 object. If the R2 delete fails, the D1 row is gone but orphaned ciphertext may remain; use R2 lifecycle rules or operator cleanup for strict hygiene.

## Not supported

- v1/ZeroBin payloads.
- JSON-LD endpoints.
- Server-side URL shortener proxies.
- Template switching, admin CLI, alternate storage backends.
- Import/migration of data from an existing instance.

## API aliases

`/api/*` exposes the same storage operations with ordinary HTTP status codes and a REST-shaped JSON body. It is documented in [API.md](API.md). The root contract above is the compatibility surface; the aliases are for programmatic clients.
