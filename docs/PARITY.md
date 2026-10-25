# Upstream parity

Baseline: PrivateBin 2.1.0 (`2.1.0-83-ga88aa802` reference checkout). Binflare is a Cloudflare-native rewrite derived from it; this matrix records what is preserved, adapted, deferred or deliberately rejected.

## Matrix

| Area | Upstream behavior | Binflare v0.1 | Status |
|---|---|---|---|
| Zero knowledge | Browser encrypts; server stores ciphertext; key in fragment | Same, including `#-` burn links | Preserve |
| v2 payload | `adata`, `ct`, `meta`, comment `pasteid`/`parentid` | Same wire shape | Preserve |
| Crypto | PBKDF2 `key||password`, 100k/16B/8B defaults, AES-GCM, raw DEFLATE | Same defaults; spec-driven reader; 600k/12B accepted | Preserve |
| Legacy modes | v2 allows `ctr`/`cbc` | Read-only, warned as unauthenticated | Preserve (read) |
| ID | `fnv1a64(ct)` 16 hex | Same | Preserve |
| Delete token | HMAC-SHA256(pasteId, 256-byte salt) | Same; salt stripped from reads | Preserve |
| URLs/API | `?id#key`, `?pasteid=`, `X-Requested-With`, `status:0/1` | Same root contract | Preserve |
| Create/read/delete | Single front controller | Root compat API + `/api/*` alias | Adapt |
| Expiry | 5min–1year/never; lazy check; purge on create | Same options; lazy check + Cron | Adapt |
| Burn | Read then delete; race in upstream | D1 batch transaction; exactly one winner | Improve |
| Comments | Encrypted text/nickname, server timestamp, cascade delete | Same; deterministic client-side avatars from comment ID (no IP metadata) | Adapt |
| Attachments | Multiple files, drag/drop/clipboard, previews, MIME/SVG sanitization, clone | Same; previews are client-side, unsafe MIME download-only | Preserve |
| `children` | Version-chain links in plaintext | Read/render safe links; clone appends the current URL | Preserve |
| Formats | plaintext, markdown, syntax highlighting | Same, plus line numbers and ftp/magnet linkification | Preserve |
| Sharing | Copy, raw, download, clone, email, QR | Same, including raw/download/email/QR/clone | Preserve |
| Password | Client-side only; no recovery | Same; burn+password prompts before the destructive read | Preserve |
| Dark mode / i18n | 39 locales, Bootstrap themes | English/Simplified Chinese, dark/light theme; more locales future | Adapt |
| JSON-LD | Public metadata endpoints, including `?jsonld=` | Not implemented; `?jsonld=` is routed to the error response, not metadata | Reject |
| Shortener proxies | YOURLS/Shlink/Chhoto | Not implemented; optional external integration future | Reject |
| Template switching / admin CLI | PHP-specific | Not implemented | Reject |
| Storage backends | FS/DB/S3/GCS | D1 + R2 | Adapt |
| v1/ZeroBin | Legacy format | Not supported | Reject |
| Identicons | IP-derived comment icon | Client-side deterministic avatar from comment ID | Adapt (privacy) |

## Upstream quirks not copied

- Read-then-delete race for burn pastes; Binflare uses one D1 batch transaction.
- Delete verifies existence by reading before checking the token, which could destroy burn pastes with a wrong token. Binflare checks the token before deleting.
- The upstream validator accepts unauthenticated `ctr`/`cbc`; Binflare only reads them for compatibility and never creates them.
- Filesystem partial reads, S3 purge prefix bug, orphaned comments after partial deletes: avoided by D1 batch operations and explicit comment deletion.
- Comment parents are not checked upstream; Binflare validates that the parent belongs to the same paste.
- The upstream 2.1.0 web client only creates GCM pastes. Its WebCrypto CTR reader uses the default 64-bit counter and fails on a protocol-valid 128-bit-counter CTR fixture; Binflare reads CTR with `length: 128` (SJCL semantics). CBC interoperates both ways in the harness.
- Duplicate ciphertext IDs are a protocol behavior; Binflare keeps the collision error.
- The upstream client sends `@context` in read responses; Binflare may omit JSON-LD context because JSON-LD is out of scope. Clients that need it should be tested before relying on it.

## Deliberate divergences

- D1 stores up to 1.875 MB of ciphertext; larger ciphertext goes to R2 (default 10 MB). The v2 API still returns one `ct`.
- Comment avatars are generated client-side from the comment ID, not from IP + server salt. This preserves the visual feature without a stable per-IP metadata leak.
- No JSON-LD, shortener, template switching, admin CLI or multi-backend storage.
- No data import. Protocol compatibility does not imply data migration.
- English and Simplified Chinese UI; more locales can be added through the dictionary layer.

## License facts

- Upstream PrivateBin is Zlib/libpng: commercial use, modification and redistribution are allowed with attribution and an explicit notice that modified versions are not the original.
- Upstream bundles third-party components under GPLv2, BSD-3-Clause, MIT, Apache-2.0 and CC-BY-4.0. Binflare uses none of those bundled components or artwork; it reimplements the protocol with its own code and modern browser APIs.
- Binflare is a derived rewrite, not the original PrivateBin project. Attribution and derivation notes are in [NOTICE](../NOTICE) and the README.
