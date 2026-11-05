# Contributing

## Setup

Requirements: Node 20+, npm.

```bash
npm install
cp .env.example .env.local   # optional, only if you have a 1Click JWT
npm run dev
```

Open http://localhost:3000.

## Checks before a pull request

```bash
npm test        # 47 tests on Node's built-in runner, no network
npm run typecheck
npm run lint
npm run build
```

All four must pass. A PR that changes money copy, amounts, or states should
say which section of `docs/spec-settleform.md` it satisfies.

## Conventions

- Commits: a short title in the imperative, then bullet points saying what
  and why. One concern per commit.
- Amounts are decimal strings, never floats (`lib/amount.ts`).
- UI copy is plain and honest about money: label simulations at the point
  of use, never invent figures, never blur dry-run from live.
- Only `/` is indexable. New routes under `/pay/`, `/invoices`, or `/api/`
  must stay out of the sitemap and carry `robots: { index: false }`.
- The brand mark is drawn once as vector in `public/brand/`. Regenerate the
  icon set from the master after any change:
  `node scripts/make-icons.mjs public/brand/settleform-mark.svg`.
