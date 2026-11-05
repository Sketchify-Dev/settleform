## What

<!-- One concern per PR. Say what changed, in the imperative. -->

## Why

<!-- The reason, not the mechanism. Link the issue if there is one. -->

## Verification

- [ ] `npm test`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build`

## Money checklist

Only tick what applies; delete the rest.

- [ ] No new invented figures (amounts, fees, testimonials, settlement claims)
- [ ] Dry-run vs live is labeled at the point of use
- [ ] New route under `/pay/`, `/invoices`, or `/api/` is excluded from indexing
- [ ] Amounts stay decimal strings, never floats
