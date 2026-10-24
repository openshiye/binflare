# Roadmap

## Non-goals (explicit)

- ❌ Data-format compatibility with upstream PrivateBin (see NOTICE)
- ❌ Server-side storage of plaintext or keys — zero knowledge is the product

## v0.1 — core loop

- [ ] Create / read / expire / burn-after-reading / delete-token flow on Workers + D1 (atomic burn via `DELETE … RETURNING`; expiry checked on read + scheduled cleanup)
- [ ] Password-protected pastes
- [ ] Plain-text + code highlighting, size limits, expiry options (5 min – 1 year + burn)
- [ ] One-click deploy (Deploy to Cloudflare button, D1 binding out of the box)
- [ ] Public demo with Turnstile + rate limiting
- [ ] EN/ZH README final pass; repository goes public

## v0.2 — attachments & extras

- [ ] Attachment support (R2) for payloads beyond the 2 MB paste limit
- [ ] Discussion/comments (optional, off by default)

## Later

- [ ] EdgeOne Makers port
