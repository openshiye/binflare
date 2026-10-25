## What changes

<!-- One paragraph: the behaviour that is different after this pull request. -->

## Linked issue

Closes #

<!-- Every change must trace back to a public record. If nothing fits, open the issue first,
     then link it here — including for your own fix of something you noticed while working. -->

## Protocol alignment

- [ ] No effect on the PrivateBin 2.1.0 v2 wire format or JSON API
- [ ] Affects alignment — the linked issue records why, and `docs/PROTOCOL.md` plus
      `tests/compat/baseline.json` are updated in this pull request

## Verified

- [ ] `pnpm typecheck`
- [ ] `pnpm test:unit`
- [ ] `pnpm test:workers`
- [ ] `pnpm test:compat`
- [ ] `pnpm test:e2e`
- [ ] `pnpm build`
- [ ] `pnpm run deploy:dry-run` (when anything touches `wrangler.jsonc`, `scripts/`, or Worker bindings)

<!-- State what you actually ran. If a suite could not run, say so instead of ticking the box.
     UI changes need a screenshot in the discussion, not just a green build. -->

## Notes for review

<!-- Deployment-specific risk, migration or binding changes, quota or CPU impact, anything a
     reviewer should check on a real instance. Write "none" if there is nothing. -->
