# Development guide

Local runbook, judge path, and API reference for Settleform contributors.
For the product overview, start at the [README](../README.md).

## Run it

Requirements: Node 20+, npm.

```bash
npm install
cp .env.example .env.local                        # optional, only if you have a 1Click JWT
cp data/invoices.example.json data/invoices.json  # optional, seeds one demo invoice
npm run dev
```

Open http://localhost:3000.

`data/invoices.json` is the local store and is git ignored, because it holds real client
names and amounts. Skip the seed step and `/invoices` opens on the empty state instead.

Set `NEXT_PUBLIC_SITE_URL` when this runs anywhere but localhost. It is the one origin that
`metadataBase`, canonical URLs, `robots.txt` and `sitemap.xml` all read; the fallback is
`http://localhost:3000`.

## Do X, see Y (judge path)

1. Do: open `/invoices/new`, fill client "Acme Studio", NEAR account `intents.near`, amount `250.00`, due date any future date, and submit.
   See: redirect to `/pay/[id]` showing an UNPAID invoice with number `SF-XXXX` and a "Copy pay link" button.
2. Do: on the pay page pick "ETH on Ethereum", leave the refund field empty, click "Get dry-run quote".
   See: a printed quote slip carrying the dry-run tint: quoted ETH in, expected USDC out, a "1Click fee" line, the label "Dry-run quote, no funds moved", and no deposit address.
3. Do: pick an unsupported scenario is impossible by design; the asset dropdown only lists `data/supported-assets.json`. Try submitting a quote with a forged assetId via the API.
   See: HTTP 400 "Unsupported asset. Choose a listed source asset."
4. Do: click "Start live payment" with refund `0x1234567890123456789012345678901234567890` on a fresh test invoice.
   See: a deposit address, a countdown, and status `PENDING_DEPOSIT` with "Waiting for your deposit to arrive." Polls every 5 seconds. No funds move until a real deposit is sent.
5. Do: reload the pay page mid-payment.
   See: a "Payment in progress" panel with the same deposit address and resumed tracking.
6. Do: with that live payment still open and nothing sent to it, click "Cancel this payment", then "Yes, cancel it".
   See: a "Payment cancelled" panel, the "Start live payment" control enabled again, and `POST /api/quote` accepting a new live quote that returns a different address. `GET /api/status?invoiceId=[id]` then says `"note":"The payment opened on this invoice was cancelled. Nothing was sent to it."`. A cancel attempt once 1Click has seen a deposit is refused with 409 instead: releasing a payment that holds money would drop the only record pointing at it.
7. Do: open `/api/status?invoiceId=[id]` for an invoice with no live payment.
   See: `{"invoiceStatus":"UNPAID","swapStatus":null,"plain":null,"dryRun":true,"note":"No live payment started. Dry-run quotes move no funds.","payment":null}`.
8. Do: open `/api/export/[id]` on a paid invoice, or the Download CSV button on the receipt.
   See: a CSV with columns `invoice_id,client,amount,currency,source_token,source_chain,quoted_rate,expected_usdc,settled_usdc,fee,status,created_at,paid_at,tx_refs`.
9. Do: open an unpaid invoice list with zero invoices (fresh `data/invoices.json` of `[]`).
   See: "No invoices yet. Create your first invoice."
10. Do: open `/convert`, name any mainnet NEAR account, pick a token and ask for a deposit address.
   See: the exact source figure to send and an address, then a status line that polls until SUCCESS, REFUNDED or FAILED. No invoice is created and the register is untouched. A `you.testnet` destination is refused with the same mainnet message the create form gives.
11. Do: open `/convert` on a fresh machine (no `data/conversions.json`) and scroll to the shared history.
   See: the history opens on one filed conversion, the builder's own settled 0.5 USDC swap of 2026-11-04, with both explorer legs, a CSV row and a receipt PNG. A finished swap files newest-first with CSV and receipt export; a still-running swap is refused with 409 because it belongs to the live view, not to history.

Expected states: dry-run never shows a deposit address; REFUNDED shows "Swap refunded to sender, invoice still unpaid" and never PAID; paid links disable payment and expose no deposit address (`POST /api/quote` returns 409).

## API

- `POST /api/invoices` creates an invoice. Validates client name, NEAR account format, amount (over 0, at most two decimals, normalised to `250.00` before it is stored), currency against USD/EUR/GBP, a real calendar due date, and caps on client name and line-item count.
- `POST /api/quote` takes `invoiceId`, `originAsset`, `dry`, optional `refundTo`. Returns 404 for unknown invoices, 409 for paid invoices or duplicate in-flight live payments, 400 for unsupported assets, a live refund address that does not match the route's address format, or a missing one. A dry run never returns a `depositAddress`, whatever upstream sends for it; a live quote with no deposit address is refused rather than stored. Keys stay server-side.
- `GET /api/status?invoiceId=[id]` proxies 1Click status by stored depositAddress. SUCCESS marks the invoice PAID server-side; REFUNDED keeps it UNPAID with a refund reason and stops polling; FAILED keeps it UNPAID. A paid invoice is served from the record with the deposit address stripped.
- `POST /api/payment/cancel` takes `invoiceId` and releases the live payment the invoice has open, so a new quote can be made. It asks 1Click first and refuses (409) anything that is not still `PENDING_DEPOSIT`, or answers 503 when 1Click cannot confirm. It cannot recall the deposit address: 1Click issued it and only its own deadline retires it, so the released address is kept on the record in `cancelledPayments` (last five) for the audit, and the UI says not to send to it.
- `GET /api/export/[id]` downloads the accountant CSV. Cells are quoted and formula-neutralised, so a client name beginning `=`, `+`, `-` or `@` opens as text.
- `POST /api/convert` is the converter's quote. It takes `destinationNear`, `originAsset`, `refundAddress` and an `amount` of USDC to receive, and returns the exact source figure to send plus a deposit address. The destination is validated server-side (shape, mainnet, not testnet) and goes upstream as the swap recipient. It keeps no invoice: a conversion has no invoice to keep. Finished swaps are filed into the shared history (below) after the swap is read live from 1Click and found terminal.
- `GET /api/convert/status?depositAddress=[address]` proxies 1Click status for one deposit address, which is the only handle a conversion has. The address shape is checked before any upstream call, and the address is unguessable, so knowing it is proof enough to read it - the same capability-URL property the pay links rely on.
- `GET /api/conversions` lists the shared conversion history, newest first, seeded by `data/conversions.example.json` so a fresh machine opens on proof. `POST /api/conversions/file` files one finished swap: it re-reads the deposit address live from 1Click and writes only what upstream publishes, refusing anything still running. Same-origin only, rate limited like the other write endpoints.

The write endpoints reject a request whose `Origin` header names another site (403); a caller with no `Origin`, such as `curl`, is not a browser-driven cross-site request and is allowed. They are also rate limited in memory (30 invoices a minute, 60 quotes in five minutes, 30 cancellations in five minutes, 30 conversions in five minutes, 240 conversion status polls in five minutes per caller) and answer 429 with `Retry-After`. Every response carries `Cache-Control: no-store`. A store that cannot be parsed is never written over: reads and writes return 503 and `data/invoices.json` is left exactly as it was. `INVOICES_STORE` points the store at another file, which is how the test suite runs.

The limiter keys on the caller's address only when `TRUST_PROXY=1` is set, because `x-forwarded-for` is a header the caller can write itself: trusting it unasked lets a script mint a fresh allowance per request, which is the one thing the limiter exists to stop. Without it, every caller shares one bucket: correct for a demo on one machine, and honest about what it can prove.

 ## Tests

`npm test` runs the store, amount, CSV and origin-guard tests on Node's built-in runner, against a scratch store in the temp directory. No network, no fixtures to clean up.

## Rate limits

The write endpoints reject a request whose `Origin` header names another site (403); a caller with no `Origin`, such as `curl`, is not a browser-driven cross-site request and is allowed. They are also rate limited in memory (30 invoices a minute, 60 quotes in five minutes, 30 cancellations in five minutes, 30 conversions in five minutes, 240 conversion status polls in five minutes per caller) and answer 429 with `Retry-After`. Every response carries `Cache-Control: no-store`. A store that cannot be parsed is never written over: reads and writes return 503 and `data/invoices.json` is left exactly as it was. `INVOICES_STORE` points the store at another file, which is how the test suite runs.

The limiter keys on the caller's address only when `TRUST_PROXY=1` is set, because `x-forwarded-for` is a header the caller can write itself: trusting it unasked lets a script mint a fresh allowance per request, which is the one thing the limiter exists to stop. Without it, every caller shares one bucket: correct for a demo on one machine, and honest about what it can prove.
