# Settleform

**One sentence.** A freelancer can issue a shareable invoice payable in supported tokens on supported chains, so that the freelancer receives USDC on NEAR without crypto complexity.
**Owner.** Sketchify
**Date.** 2026-11-02
**Status.** AGREED
**Path.** docs/spec-settleform.md

---

## 1. Who it is for

**Role.** Freelancer (solo contractor or indie service provider who invoices international clients).
**How many.** Day one: the builder plus judges. Real users after the hackathon: tens of freelancers in pilot.
**Where they are.** Laptop, preparing or chasing an invoice.
**What they already have.** Invoice details (client name, amount, line items, due date). A NEAR account address for receiving USDC. No crypto knowledge assumed.

A second party opens the pay link: the client, on any device, holding a supported token on a supported chain. The client has no login and installs nothing.

## 2. Today, without this

The freelancer sends a PDF or payment link through existing tools, then waits 3 to 7 days for international transfer or wrestles the client through wallet setup, network choice, and address copy paste. Each invoice needs manual follow up in chat or email to confirm receipt. The accountant later asks what chain, what rate, and what fee applied, and the freelancer has no clean record.

## 3. Must do

1. Create an invoice with client name, amount, currency, due date, and line items.
2. Share each invoice through a unique public pay link that needs no login.
3. Show only supported source assets and routes verified against the 1Click API.
4. Preview a dry-run quote with rate, expected USDC output, and fee, labeled as not a payment.
5. Track a live payment through every 1Click status to SUCCESS, REFUNDED, or FAILED.
6. Keep swap status, invoice status, and refund status as three distinct states.
7. Show a paid invoice as a receipt with settlement amount, tx references, and explorer links, with payment disabled.
8. Export an accountant grade CSV per invoice.
9. Give judges reproducible do X, see Y steps in the README.

## 4. Non-goals

- No full accounting or bookkeeping platform. Invoicing, payment tracking, settlement records, and CSV export only. Bookkeeping stays in the accountant's existing software.
- No universal chain or token support. Only assets and routes verified through the 1Click API appear. Anything unverified is not listed.
- No mainnet customer funds in the hackathon build. Testnet plus clearly labeled dry-run demonstrations only.
- No gasless promise until proven. The meta transaction relayer is a separate scoped integration, added only after the core flow works.
- No invoice editing after payment. A paid invoice is immutable except for refund records.

## 5. Assumed decisions

- `ASSUMED 2026-11-02` MVP persists invoices in a local JSON file store, not a hosted database. Rules out multi-device sync and concurrent editors.
- `ASSUMED 2026-11-02`, superseded 2026-11-02: visual direction is light fintech in code (white cards, one dark ledger panel, tabular numerals). Replaced by the direction contract in `DESIGN.md`: a payment instrument printed on a sage security tint, document-white fields, two rationed state colours, and no dark panel anywhere in the product.
- `ASSUMED 2026-11-02` Pay links are capability URLs with unguessable ids and no client login. Rules out client accounts and password flows.

## 6. Open questions

1. Which exact source assetIds and which destination USDC assetId do we verify through GET https://1click.chaindefuser.com/v0/tokens? Asked of: Sketchify, against the 1Click docs. Waiting on it: the supported-assets list and quote integration.
2. Which NEAR testnet account receives demo settlements? Asked of: Sketchify. Waiting on it: the end-to-end paid flow on testnet. Dry-run mode is unblocked without it.
3. Submission payload values (lead name, contact email, payout address, public repo URL, demo post URL). Asked of: Sketchify at submit time. Waiting on it: the submission POST. Nothing in the build waits on it.

## 7. Constraints

**Deadline.** 2026-11-14T23:59:00Z because the hackathon development window closes and judging starts 2026-11-16.
**Must use.** The existing Next.js 16 plus React 19 plus Tailwind 4 repo. NEAR Intents 1Click API: tokens at https://1click.chaindefuser.com/v0/tokens, quote at POST https://1click.chaindefuser.com/v0/quote, status at https://1click.chaindefuser.com/v0/status.
**Must not touch.** Mainnet funds. No real customer money moves during the build or demo.
**People.** Solo builder (Sketchify) plus this agent, 12 days.
**Legal or policy.** Keys in environment variables, never in the repo. Submission consent line read verbatim at submit time. No post on X, no public push, no submission POST without explicit confirmation.

## 8. Failure and empty states

| Situation | What the user sees |
| --- | --- |
| Nothing to show yet | "No invoices yet. Create your first invoice." plus a link labeled "New invoice" to /invoices/new. |
| Still loading | Skeleton rows on list pages; the quote button shows "Getting quote..." and is disabled until the response returns. |
| Network or upstream failure | Quote failure: "Quote failed, no payment made." plus a Retry button; the invoice stays UNPAID. Status poll failure: "Status unavailable, retrying..." with the last known status kept on screen. |
| Input rejected | The field shows the message next to it, for example "Amount must be greater than 0." The form keeps all entered values. |
| Permission denied | Paid invoice: pay controls disabled with the text "This invoice is paid." No deposit address is shown. |
| Live payment abandoned | "Cancel this payment" next to the deposit address, asking "Yes, cancel it" or "Keep it". After it: "Payment cancelled", a new quote is possible, and the old address is kept on the record but not followed. Once a deposit has been seen the control is gone and the route answers 409 instead. |
| Paid link opened | "PAID" heading, settlement amount, tx and explorer links, receipt block. Payment action disabled. |

## 9. Acceptance criteria

| # | Criterion | Where to check | Pass |
| --- | --- | --- | --- |
| AC-1 | A freelancer submitting the form at /invoices/new with client name, amount, currency, due date, and one line item sees the new invoice in the /invoices list with status UNPAID. | /invoices/new, /invoices || [x] |
| AC-2 | Each invoice has a unique public URL at /pay/[id] that opens with no login and shows the amount due with an enabled pay control while UNPAID. | /pay/[id] || [x] |
| AC-3 | The pay page lists source assets only from data/supported-assets.json. No free-text token entry exists on the page. | /pay/[id], data/supported-assets.json || [x] |
| AC-4 | Selecting a supported asset requests POST /api/quote with dry true and displays the quoted rate, expected USDC output, the 1Click fee line, and the label "Dry-run quote, no funds moved". | /pay/[id], /api/quote || [x] |
| AC-5 | A dry-run quote response contains no depositAddress, and the UI shows no deposit address for dry runs. | /api/quote response, /pay/[id] || [x] |
| AC-6 | A failed quote shows the text "Quote failed, no payment made." with a Retry button, and the invoice status remains UNPAID. | /pay/[id] with forced quote failure || [x] |
| AC-7 | A live quote (dry false) shows the deposit address, the deadline countdown, and a status tracker that polls GET /api/status. | /pay/[id] || [x] |
| AC-8 | The status tracker renders the exact status string returned (one of PENDING_DEPOSIT, KNOWN_DEPOSIT_TX, PROCESSING, SUCCESS, INCOMPLETE_DEPOSIT, REFUNDED, FAILED) plus a plain-language line next to it. | /pay/[id] || [x] |
| AC-9 | A REFUNDED swap sets the payment state to SWAP_REFUNDED and shows "Swap refunded to sender, invoice still unpaid." It never shows the word PAID. | /pay/[id], invoice record || [x] |
| AC-10 | A SUCCESS swap sets the invoice to PAID. The link shows a "PAID" heading, settlement amount, tx and explorer links, a receipt block, and a disabled pay control with the text "This invoice is paid." | /pay/[id] in paid state || [x] |
| AC-11 | A paid invoice exposes no deposit address, and POST /api/quote for a paid id returns HTTP 409. | /pay/[id], /api/quote || [x] |
| AC-12 | The export link on a paid invoice downloads a CSV with columns invoice_id, client, amount, currency, source_token, source_chain, quoted_rate, expected_usdc, settled_usdc, fee, status, created_at, paid_at, tx_refs. | Invoice page download, opened in a spreadsheet || [x] |
| AC-13 | With zero invoices, /invoices shows "No invoices yet. Create your first invoice." and a link to /invoices/new. | /invoices, fresh store || [x] |
| AC-14 | README.md holds judge steps written as "do X, see Y" for invoice create, dry-run quote, status check, and CSV export, plus a table of NEAR tools used with versions and endpoints. | README.md || [x] |
| AC-15 | `git ls-files` shows no .env file, only .env.example with empty values, and quote/status keys are read from environment variables. | Repo root, `git ls-files \| grep env` || [x] |
| AC-16 | The quote panel shows a fee line labeled "1Click fee", and the README states the unauthenticated fee rule from Q-006. | /pay/[id], README.md || [x] |
| AC-17 | A live payment nothing was deposited to can be released from the pay page. The route refuses with 409 once 1Click reports anything but PENDING_DEPOSIT, and with 503 when it cannot confirm, so a payment holding money is never dropped. The released address is kept in `cancelledPayments` and the invoice accepts a new live quote. | /pay/[id], /api/payment/cancel, invoice record || [x] |
| AC-18 | A converter at `/convert` takes any mainnet NEAR account, a source asset, a refund address and a USDC amount, and returns the exact source figure plus a 1Click deposit address; the page polls status to SUCCESS, REFUNDED or FAILED. The destination and refund address are validated server-side, a testnet destination is refused, and no invoice record is created or modified. | /convert, /api/convert, /api/convert/status, invoice record unchanged || [x] |

## 10. Data and scale

**Source.** Invoice metadata entered by the freelancer, stored locally. Route and settlement data from the 1Click API (tokens, quote, status endpoints above).
**Freshness.** Quotes expire at the deadline returned per quote. Status is polled, not pushed.
**Day one.** Tens of invoices, one payer per invoice, one quote at a time.
**In a year.** Thousands of invoices. Out of scope for this build.
**Personal data.** Client names and invoice amounts. Stored locally, never committed. No secrets in the repo.

## 11. Cut list

1. Testnet invoice registry contract. Ship the file-store MVP first.
2. Meta transaction relayer. Ship with a documented gas note instead.
3. Landing page sections beyond hero, how it works, and live demo entry. Ship the minimum that reads as a real product.

## 12. Change log

| Date | Request | Verdict | Cost |
| --- | --- | --- | --- |
| 2026-11-02 | Spec created from interview answers | N/A | 0 |
| 2026-11-03 | Cancel a live payment nobody paid into, so a wrongly opened deposit address does not wedge the invoice until its deadline | AGREED, AC-17 added | 0 |
| 2026-11-04 | A self-serve converter that is not an invoice: any NEAR account, any supported token, USDC out. Chosen over letting the payer name the destination on a pay link, which would let a payer redirect a payment to themselves and void the "settles to X" promise | AGREED, AC-18 added | 0 |

## 13. Sign-off

Anything not in this document is not in this build.

- Sketchify, [date TBD]
- Agent build start on AGREED only
