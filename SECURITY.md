# Security policy

Binflare is a zero-knowledge pastebin. A bug that exposes paste content, decryption keys, or
delete tokens is treated as a serious defect — please report it privately rather than as a public
issue, so nobody has to read exploitation details before a fix ships.

中文报告完全可以，用下面同一个入口提交即可。

## Report a vulnerability

Open a **private security advisory**:
<https://github.com/openshiye/binflare/security/advisories/new>

Do not file a public issue, and do not paste a working exploit in an ordinary pull request
description. If you already opened a public issue by accident, say so in the advisory and we will
hide the comments.

A useful report includes:

- The affected version or commit, and how the instance is deployed (deploy button, `pnpm run deploy`,
  fork, or the public preview).
- The class of problem: authentication of the storage layer, XSS leading to key theft, size or rate
  limit bypass, R2/D1 data exposure, information oracle on paste existence, or supply chain.
- A reproduction against a deployment you control. Use throwaway pastes you created — never real
  user data, and never a live paste key or delete token.
- What an attacker gains, and what they still cannot read.

We aim to acknowledge within a week. This is a small project without a security retainer, so there
is no contractual response-time commitment; you will get a straight answer about where a fix stands.
Coordinated disclosure is welcome — tell us your preferred timeline and we will work to it.

## Out of scope

- Findings that require the operator to be actively malicious. A hostile deployment can serve
  modified JavaScript and take keys from the browser; that is inherent to any browser-delivered
  zero-knowledge tool and is documented as a limitation, not a vulnerability. See
  [docs/SECURITY.md](docs/SECURITY.md).
- Reading a paste whose full link — including the `#` fragment — you already have. The fragment is
  the key, and it never reaches the server.
- Rate-limit or Turnstile tuning on someone else's instance. Deployments choose their own posture;
  the defaults and their limits are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- Vulnerabilities in third-party Cloudflare services, or in the upstream PrivateBin project itself.
  Report those to Cloudflare or to
  [PrivateBin](https://github.com/PrivateBin/PrivateBin/security/policy).

## Hardening already in place

Client-side AES-GCM with a key that never leaves the fragment, PBKDF2-SHA256 derivation,
authenticated ciphertext, AAD-bound formatter and discussion/burn flags, strict script CSP with a
per-response nonce, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, DOMPurify on Markdown
and SVG, sanitized attachment filenames and MIME handling, per-IP write rate limiting, optional
Turnstile, generic errors for missing or expired pastes so reads do not leak existence, SHA-256
hashed rate-limit keys instead of raw IPs, and no analytics, tracking, or third-party assets.

The full threat model, cryptographic details, and known limitations live in
[docs/SECURITY.md](docs/SECURITY.md).
