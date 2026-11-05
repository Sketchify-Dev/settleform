# Security policy

## Reporting a vulnerability

Do not open a public issue for anything that could put funds or personal data
at risk. Email **sketchifydev@gmail.com** with:

- what you found and where (route, file, or commit),
- what an attacker could do with it, step by step,
- what you already tried, so it is not reproduced twice.

Expect an acknowledgement within 72 hours. Once a fix ships, the report and
the reporter are credited in the release notes unless you ask otherwise.

## Scope

In scope: the pay links, quote and status routes, the converter, refund
handling, CSV export, and anything that decides what a record says.

Out of scope as findings (they are documented limitations, not surprises):

- Persistence is a local JSON file store. It is a demo limitation, not
  production storage.
- Rate limiting is in-memory and per-process.
- Without `TRUST_PROXY=1`, every caller behind a proxy shares one bucket.

## Ground rules

- Never send a real deposit to a deposit address you do not control the
  refund path for.
- Never commit keys, seeds, or client data. `.env*` (except `.env.example`)
  and the local stores are git-ignored for this reason.
