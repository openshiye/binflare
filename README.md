# Binflare

**A zero-knowledge pastebin that runs entirely on Cloudflare — no server, no PHP runtime, no patches to apply.**

Pastes are encrypted in your browser (AES-256-GCM via WebCrypto) before they are uploaded. The server only ever stores ciphertext; the decryption key lives exclusively in the URL `#fragment` and is never sent to the server.

> 🚧 **Status: stage 0 — project scaffolding.** Core implementation in progress. This repository is private during incubation and will be made public at v0.1.

零知识加密粘贴板，跑在 Cloudflare Workers + KV 上：浏览器端加密，服务端只存密文，没有服务器要维护。

## Upstream & attribution

This project is an **independent, clean-room reimplementation inspired by [PrivateBin](https://github.com/PrivateBin/PrivateBin)** by [@PrivateBin](https://github.com/PrivateBin) — originally created by Sébastien Sauvage.

- 🔗 Upstream repository: https://github.com/PrivateBin/PrivateBin
- 👤 Upstream organization: [@PrivateBin](https://github.com/PrivateBin)
- 📜 Upstream license: Zlib/libpng — full attribution in [NOTICE](NOTICE)

This is **not a fork** of PrivateBin, **not an official port**, and it is **not affiliated with or endorsed by** the PrivateBin project. No upstream code has been copied; none of upstream's bundled third-party libraries (including the GPLv2-licensed rawinflate) and none of its CC-BY-licensed artwork are used. Client-side compression and encryption are reimplemented on WebCrypto.

## ⚠️ Compatibility notice

**Pastes are NOT compatible with upstream PrivateBin.** Links and data formats differ (the client-side encryption format is different), so pastes created here cannot be opened in PrivateBin, and vice versa. This project is a new implementation, not a migration tool.

## Security model

- Encryption happens **client-side only** (WebCrypto, AES-256-GCM). The key is generated in the browser and carried in the URL `#fragment`, which browsers never send to servers.
- The server stores ciphertext + metadata only (expiry, burn flag, delete-token hash — tokens are stored as SHA-256 hashes, never in plain text).
- Burn-after-reading pastes are deleted on first successful read; expiry is enforced natively by KV TTL.

### Limitations (stated honestly)

- **KV is eventually consistent**: a freshly created paste may briefly 404 in some regions, and burn-after-reading has a theoretical race under truly concurrent first reads. A strict-atomicity mode based on Durable Objects is on the roadmap.
- **Minimum expiry is 60 seconds** (KV `expirationTtl` floor).
- **Cloudflare free-tier write quota is 1,000 KV writes/day** — plenty for a personal self-hosted instance (one deployment = one quota); public demo instances need rate limiting.

## Roadmap

See [ROADMAP.md](ROADMAP.md).

## License

This project's own code is released under the [MIT License](LICENSE).

Upstream attribution and the non-affiliation / non-compatibility statements live in [NOTICE](NOTICE).
