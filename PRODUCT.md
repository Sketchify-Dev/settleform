# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**The freelancer.** A solo contractor or indie service provider invoicing international clients. At a laptop, preparing or chasing an invoice. Already holds the invoice details (client, amount, currency, due date, line items) and a NEAR account address for receiving USDC. No crypto knowledge is assumed, and none should become a prerequisite.

**The client who pays.** Opens a pay link on any device, holding a supported token on a supported chain. Has no login, installs nothing, and is never asked to choose a network.

**Hackathon judges.** Confirmed 2026-11-02 as an audience of equal weight to the freelancer. They arrive with no funds, little time, and a scoring rubric, and they evaluate from 2026-11-16.

## Product Purpose

A freelancer issues a shareable invoice payable in supported tokens on supported chains and receives USDC on NEAR without crypto complexity.

Success means: an invoice created and shared in minutes; a client paying without an account, a wallet install, or a seed phrase; and a settlement record the freelancer and their accountant can both trust afterwards. The product exists to remove the 3-to-7-day international transfer wait and the manual chat-and-email follow-up that replaces it today.

## Positioning

Cross-chain settlement where the freelancer never touches a wallet, a gas token, or a network switch.

Three claims a neighbouring invoicing product could not truthfully copy without rebuilding its payment tracking:

1. Only routes verified against the 1Click API appear. There is no free-text token entry anywhere on the pay page.
2. Invoice status, swap status, and refund status are three separate state machines that never collapse into one another.
3. A refunded swap renders the invoice as still unpaid. It never shows the word PAID, because the money did not settle.

## Operating Context

- The freelancer enters invoice details directly; no import or accounting sync exists.
- The 1Click API is the sole source of route and settlement truth: tokens, quote, and status endpoints.
- Quotes expire at the deadline returned per quote. Status is polled, not pushed.
- Day-one scale is tens of invoices, one payer per invoice, one quote at a time.
- Records leave the product as an accountant-grade CSV, one per invoice.
- Evaluation context: NEAR hackathon, primary track Real-World Money. The hackathon window closes 2026-11-14T23:59Z and judging starts 2026-11-16.

## Capabilities and Constraints

Eighteen acceptance criteria are specified and recorded as passing in `docs/spec-settleform.md` §9, covering invoice creation, the public pay link, verified-asset listing, dry-run quotes, live quotes with a deposit address, status tracking through the 1Click statuses, the paid receipt, CSV export, the empty state, payment cancel, the converter, and the README judge path.

Confirmed constraints:

- No mainnet customer funds move during the build or demo.
- A dry run must be labelled as one wherever it appears, in the UI and in the API response.
- A paid invoice is immutable except for refund records.
- Assets and routes not verified against the 1Click API are never listed.
- Settlement asset is USDC on NEAR. Four source routes were verified on 2026-11-02: ETH, USDC on Ethereum, USDC on Base, and wNEAR.
- Persistence is a local JSON file store. Multi-device sync and concurrent editors are explicitly out of scope.
- Keys live in environment variables and never in the repo.

Stack constraint worth preserving: this repo runs Next.js 16.4.2, React 19.3, and Tailwind 4 on Turbopack. `AGENTS.md` records that this version's APIs, conventions, and file structure differ from model training data and that `node_modules/next/dist/docs/` is the authority to read before writing code.

## Brand Commitments

- **Name.** Settleform.
- **Mark.** The Settleform S in mint gradient (`#00F3BC` to `#00E3A9`) on a dark tile (`#030D12`). Masters live in `public/brand/` as tile, inverse, symbol, and three lockups; the raster icon set is generated from them by `scripts/make-icons.mjs`.
- **Voice.** Plain, precise, and honest about money. Name states exactly. Never blur simulated from real.
- **Numerals.** Tabular numerals for every amount, always.
- **Binding prohibitions.** No invented testimonials, customers, benchmarks, pricing, or settlement claims.

## Evidence on Hand

Present and real:

- Four quotes returned by the live 1Click API on 2026-11-02, recorded with their verification note in `data/supported-assets.json`: ETH and USDC on Base as EXACT_OUTPUT, USDC on Ethereum as same-chain family, wNEAR as both EXACT_INPUT and EXACT_OUTPUT.
- A working application covering all eighteen acceptance criteria, runnable locally.
- One settled conversion, filed as the seed of the shared history: ETH to 0.5 USDC on 2026-11-04, with the deposit on Etherscan and the withdrawal to the named NEAR account on Nearblocks, both linked from the record.

Absent, and not to be implied by any future surface:

- No settled invoice exists. `data/invoices.json` holds one invoice, `UNPAID`, with no swap and no transaction reference. No invoice has reached PAID from a real deposit, because no pay link has been funded yet.
- No deployed public URL is recorded.
- No demo video or product screenshot exists yet. Captures can be taken from the running application.

Every proof surfaced in a design must be one of the items above. The four live quotes are the strongest available evidence; anything stronger must be produced before it is shown.

## Product Principles

1. **Money states stay separate.** Invoice, swap, and refund status never collapse into one another.
2. **Label simulation at the point of use.** A quote that moves nothing says so, in the panel and in the API response.
3. **Only verified routes ship.** If the 1Click API has not confirmed an asset, it is not listed and not offered.
4. **The freelancer never touches crypto mechanics.** No wallet, gas token, or network switch enters their workflow.
5. **A judge can reproduce every claim** without funds, an account, or a walkthrough.
