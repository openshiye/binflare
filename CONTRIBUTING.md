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

## How work is tracked

The public issue tracker is the backlog: if a change is not in an issue, it is not planned.
[docs/ROADMAP.md](docs/ROADMAP.md) keeps direction and non-goals only.

- One issue per unit of work, then a pull request that closes it with `Closes #123`.
- Milestones are releases (`v0.2`, `v0.3`, …) and carry only what will actually ship.
- Labels stay few: `bug`, `enhancement`, `parity`, `deploy`, `docs`, `good first issue`. Use
  `parity` for anything touching PrivateBin compatibility — reviewers look at it first.
- Security problems never go through a public issue. Use [SECURITY.md](SECURITY.md).

## Pull requests

Keep changes focused and run the full test suite before opening a PR. Protocol changes need compatibility fixtures and a clear baseline update in `docs/PROTOCOL.md`; do not track a floating upstream branch.

The pull request template lists the suites to run. Tick only what you actually ran, and say what you
could not run instead of leaving it implied. UI changes need a screenshot in the discussion — a green
build is not evidence that the interface looks right.

Security-sensitive changes should include a test that demonstrates the failure mode being fixed. Never commit API tokens, delete tokens, paste keys, `.env.deploy`, or `.dev.vars`.

## Attribution

Binflare's own code is MIT-licensed. The upstream attribution and non-original-project notice live in [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
