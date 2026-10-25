# Contributing

Thanks for reviewing or improving Binflare. This is a community rewrite derived from [PrivateBin](https://github.com/PrivateBin/PrivateBin), not the original project.

## Development

```bash
pnpm install
pnpm db:migrate:local
pnpm dev
```

Useful commands:

```bash
pnpm typecheck
pnpm test:unit
pnpm test:workers
pnpm test:compat
pnpm test:e2e
pnpm build
pnpm run deploy:dry-run
```

## Pull requests

Keep changes focused and run the full test suite before opening a PR. Protocol changes need compatibility fixtures and a clear baseline update in `docs/PROTOCOL.md`; do not track a floating upstream branch.

Security-sensitive changes should include a test that demonstrates the failure mode being fixed. Never commit API tokens, delete tokens, paste keys, `.env.deploy`, or `.dev.vars`.

## Attribution

Binflare's own code is MIT-licensed. The upstream attribution and non-original-project notice live in [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
