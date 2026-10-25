# Security

## Threat model

Binflare protects paste content from the storage layer and from an honest-but-curious operator at rest. It does not protect against an operator who actively serves modified client code, nor against a compromised browser or endpoint.

- The browser encrypts before upload. The server stores ciphertext and the metadata required to enforce expiry, burn, discussion and deletion.
- The key and password are never sent to the server. The key lives in the URL fragment, which browsers do not send in HTTP requests or Referer headers.
- Burn-after-reading is an honest-server property. A malicious operator can retain a copy before deleting the row.
- Anyone with the full link (including the fragment) can read a paste unless a password is also set.

## Cryptographic details

- New pastes: AES-GCM (256-bit key, 128-bit tag) with a 16-byte IV and 8-byte salt by default.
- Key derivation: PBKDF2-SHA256 over `keyBytes || passwordBytes`; password bytes use the upstream low-byte-per-UTF-16-code-unit convention. This is intentionally compatible with PrivateBin, not a modern password-hashing recommendation.
- AAD binds the cipher spec, formatter, discussion and burn flags. Expiry is not covered by AAD because the server must enforce it; a malicious server could shorten or extend expiry but cannot decrypt content.
- Compression is raw DEFLATE. Decompression enforces an output cap to reduce compression-bomb risk. The server also caps ciphertext size.
- Readers accept `ctr`/`cbc` v2 payloads for compatibility. These modes are unauthenticated; the UI marks them. Binflare never creates them. AES-CTR uses `length: 128` to match the upstream counter semantics. The upstream 2.1.0 web client only creates GCM and its CTR reader uses the WebCrypto default counter length; Binflare's 128-bit reader is tested with an independent fixture.
- Burn + password: the client prompts for the password before reading a burn link, but the read is destructive. A wrong password still consumes the document. This is inherent to the protocol because the server cannot verify a client-only password.

## XSS and content rendering

- The fragment key is in the DOM and in `location.hash`. XSS in the app could steal it. The shell uses a strict script CSP with no `unsafe-inline` for scripts (nonce or self-hosted scripts only), `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY` and `nosniff`.
- Markdown is rendered with marked and sanitized with DOMPurify. Raw scripts, event handlers and `javascript:` links are removed.
- Plain text and highlighted code are escaped; linkification only allows safe schemes.
- Comment text is plain text plus linkification, not Markdown.
- External images in Markdown are blocked by the CSP image policy (`self`, `data:`, `blob:`) to avoid third-party requests.
- Attachment downloads are client-side data URLs; unsafe MIME types are download-only. Images/audio/video use data URLs, PDFs use a blob iframe, SVG is sanitized with DOMPurify before creating a blob URL, and text previews are rendered as text. Filenames are sanitized. Attachment content is inside the encrypted payload.
- QR codes are generated locally and contain the key; the UI warns. Email is a mailto link containing the key; the UI warns. Neither sends data to a third party from the app.
- `children` links are rendered only for `http(s)` URLs. Clone appends the current document URL inside the encrypted payload; it is not visible to the server.

## Tokens and identifiers

- Paste/comment IDs are FNV-1a64 of ciphertext, 16 lowercase hex; the server rejects malformed IDs before touching storage.
- Delete tokens are HMAC-SHA256(pasteId, per-paste 256-byte salt), 64 lowercase hex. The salt is stored but never returned. Wrong tokens do not delete.
- Delete links put the token in the query string for upstream compatibility. This means the token can appear in server logs or browser history; treat it as a secret and do not share it with the paste link.
- The root compatibility API accepts CORS `*` because that is the upstream contract. CORS is not an authorization boundary; the paste ID and fragment key are.

## Abuse controls

- Per-IP fixed-window rate limiting on create/comment, default one request per 10 seconds (upstream default).
- Optional Turnstile on public demos.
- Ciphertext/size limits and a Cron cleanup job.
- No accounts or global quotas; a public instance needs rate limiting and monitoring of D1/Workers quotas.

## Storage and cleanup

- Small ciphertext is in D1; large ciphertext is in R2. Burn/delete/expiry remove the D1 row first, then the R2 object. If the R2 delete fails, the D1 row is gone but ciphertext may remain orphaned; configure an R2 lifecycle rule before public deployment and use it as the backstop. The release checklist in [DEPLOYMENT.md](DEPLOYMENT.md) treats the rule as a blocker.
- A deployment without an R2 binding is limited to the D1 ciphertext cap (1.875 MB). With R2, the default ciphertext cap is 10 MB.
- The service does not log request bodies, keys, passwords, ciphertext or raw IPs. Rate-limit keys use SHA-256 of the IP.
- Errors returned to clients are generic for missing/expired/burned/deleted pastes to avoid an existence oracle.
- No analytics, tracking pixels, third-party fonts, or cookies for application state.

## Supply chain

- The frontend uses TanStack Start/Router, React, Vite, marked, DOMPurify, highlight.js and qrcode, pinned to exact versions. The lockfile is committed.
- The protocol is reimplemented; no upstream PrivateBin source or bundled libraries are vendored, including the GPLv2-licensed rawinflate. Compatibility fixtures are static test data captured from the pinned release tag and its PHP hash functions; CI does not load upstream code or Docker. See `THIRD_PARTY_NOTICES.md`.

## Reporting

Report vulnerabilities through a [private GitHub security advisory](../SECURITY.md), not a public issue. Include the affected version, how the instance is deployed, a reproduction, and whether paste content or keys are exposed. Do not include real paste keys or user data in a report.
