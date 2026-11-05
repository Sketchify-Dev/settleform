# Design

<!-- direction contract, step 1 of 5. Reconciled against the built world at finish: wherever a section had drifted from the build it was rewritten to say what the build actually does, and each rewrite records the reason. Revised 2026-11-03: the first viewport was recomposed, because the statement and the instrument were the only two things in it and the width between them was empty. §3, §5.5, §6 and §7 record the new composition. -->

The product truth lives in `PRODUCT.md`. This file records the visual decisions that bind the build, so the landing page and the three product screens cannot drift into two different worlds.

## 1. The scene, and what the page must prove

A freelancer opens a laptop at 9pm in a room lit by one lamp. Their client is on a phone, on a commuter train, in daylight, mildly annoyed, and does not want to install anything. Both of them need the same page to answer one question in under five seconds: **what was owed, what will arrive, and has it arrived yet.**

The scene forces light, not dark. It rules out a trading terminal (the freelancer is not a trader) and rules out a vault (nothing here is locked). Paper-white fields on a tinted ground, so that "this is a record of money" reads before any label is read.

What this first surface must prove, in order:

1. Money can arrive from anywhere and settle in one place.
2. The product tells the truth about which of those two things has actually happened.
3. It is a working thing, not a mockup.

## 2. Derivation

### The rut

Every payments landing page ships the same two things. First: near-black ground, one acid accent, a glowing coin or a floating phone, gradient headline, three feature columns. Second, its escape hatch: warm cream, a high-contrast serif, hairline rules, small tracked mono labels, italic display. Both are excluded from the candidates below. This product is about money moving between institutions, and the audience already has an entire visual tradition for exactly that. It is not on either list.

### Seven candidates from the audience's world

| # | System | Why it carries the mechanism | How it looks |
|---|---|---|---|
| 1 | **The cheque and its MICR line** | The original instrument that reconciles many banks into one settlement. Its bottom line is three separately positioned machine fields (routing, account, serial) that never merge, which is exactly this product's state model. It also states the amount twice, in figures and in words, because one statement of a number is not trusted. | Security-tinted ground, intaglio ink, ruled field grid, E-13B magnetic ink characters, a perforated stub. |
| 2 | **Columnar ledger paper and green-bar continuous form** | The accountant's grid. Banded rows, fixed columns, a balance tick. Carries the register screen directly. | White stock, alternating pale green bands, tractor holes, hairline column rules. |
| 3 | **The dater stamp and the teller's brass window** | The one emotion this product actually sells: the moment UNPAID becomes PAID. A stamp is imperfect, registered by hand, and impossible to fake. | Brass, red rubber, an ink pad, the off-register double impression. |
| 4 | **The pneumatic tube carrier** | Value physically travelling between two distant stations. Literal, charming, and completely wrong as a product language. | Brass tube, felt capsule, a whoosh. |
| 5 | **The carbon-copy triplicate invoice pad** | Three sheets, one record, each in a different colour. Maps to three state machines that stay separate. | NCR paper in pink, yellow, white, a serial in the corner, perforated edge. |
| 6 | **The telegraph money order and punched-tape ticker** | Money as a continuous advancing strip of machine-readable marks. | Strip paper, punched holes, a metal advance wheel. |
| 7 | **The remittance advice and the airmail postal order** | Proof of payment separated from payment. The hatched airmail edge marks something crossing a border. | Six-colour hatched border, postmark cancels, tissue envelope. |

Four material families across the seven: print and paper, metal and rubber, electromechanical, and postal. The derivation did not stop at the first object.

### Verdict

**Candidate 1 wins.** It is the only one whose *structure* is this product's argument: three fields that never collapse, an amount stated twice, and many sources reconciling to one settlement. It also survives the hardest test for a landing page direction, which is that it still works at product-screen scale, where a page is mostly a table, a form, and a status.

Candidates 2 and 3 are kept as supporting grammar, not as competing worlds: 2 supplies the register's row and column discipline, 3 supplies the single loud moment.

Candidate 4 is declined. Its motion is lovely and its metaphor is exact, but a page built on brass tubes is steampunk costume, and one world owns the page.

Candidates 5, 6 and 7 are declined as worlds. Nothing is borrowed from them, because 1 and 2 already cover the same ground with more precision.

## 3. Direction contract

**THESIS.** The interface is a payment instrument, drawn as one. It refuses the category's habit of rendering money as a flow diagram on a dark ground, and refuses the editorial-finance escape hatch. The product's honesty about state is not a footnote it says; it is the layout.

**OWN-WORLD.** A pale sage security tint (`#DCE3DC`) as the ground, document white (`#FCFDFA`) for every field, green-black intaglio ink (`#151A17`), hairline sage rules, one settlement green (`#00C08B`) that appears only where value has actually arrived, and one scarlet stamp (`#C0201F`) that appears only where it has not. Type is Archivo: expanded and heavy for display, normal width for everything else. Every figure is Martian Mono, wide and mechanical, tabular by construction.

**STORY.** Within five seconds the visitor understands that a client pays with what they already hold and the freelancer receives one thing, and that the page is not going to pretend a quote is a settlement. They believe it because the instrument states the amount twice and the status field is printed, not decorated. They act by creating an invoice or by opening the pay link on the sample invoice.

**FIRST VIEWPORT.** A ruled letterhead of four printed facts, the display statement in two authored lines, then one instrument, full bleed of the content column, landscape like the object it quotes, sitting on the sage ground with nothing beside it. No split hero, no image column. A rule above the instrument carries what the object is and how to advance it.

The letterhead is not decoration and it is not a feature row. A document introduces itself with its terms before it makes a claim: what settles, how many routes were verified, where the quote comes from, and that the other party needs no login. It also fills the width the statement leaves, which was the flattest part of the earlier build.

```
+------------------------------------------------------------------+
|  [mark] Settleform   How it works  Payment states  What is real   |
|                                        [ Dashboard ] [ New invoice ]|
+------------------------------------------------------------------+
|  SETTLEMENT ASSET | VERIFIED ROUTES | QUOTE SOURCE | CLIENT LOGIN |
|  USDC on NEAR     |        4        | 1Click API   | Not required |
+------------------------------------------------------------------+
|  Your client pays with what they have.                           |
|  You get USDC on NEAR.                                           |
|  Send a link. No account, no wallet and no network switch ...     |
|                                                                  |
|  [ Create an invoice ]  [ Open the dashboard ]  No funds needed. |
|                                                                  |
|  SAMPLE INVOICE, FIVE STATES                  SCROLL TO ADVANCE  |
|  +------------------------------------------------------------+  |
|  | SETTLEFORM INSTRUMENT          ----  ----  ----  2026-11-02|  |
|  |                                                            |  |
|  | PAY TO  you.near                          250.00           |  |
|  | ------------------------------            USD             |  |
|  |                                                            |  |
|  | TWO HUNDRED AND FIFTY US DOLLARS AND 00/100                |  |
|  |                                                            |  |
|  | MEMO  Invoice 0042 / Acme Studio / due 14 Nov              |  |
|  |                                                            |  |
|  | ETH / Ethereum   ~~~~~~~~~~~~~~~>  249.31 USDC / NEAR      |  |
|  | USDC / Base      ~~~~~~~~~~~~~~~>                          |  |
|  | wNEAR / NEAR     ~~~~~~~~~~~~~~~>                          |  |
|  |                                                            |  |
|  | INVOICE UNPAID    SWAP QUOTED    REFUND NONE      [UNPAID] |  |
|  +------------------------------------------------------------+  |
|  NOTE  The invoice exists. Nothing has been asked of any ...      |
+------------------------------------------------------------------+
```

Two actions, not four. They sit between the supporting sentence and the instrument, so the first screen promises and the second screen proves. Everything on the page shares one left edge: headline, supporting copy, actions, caption, instrument field labels. No centred text anywhere.

The statement breaks where it was authored to break, not where the measure runs out, so neither line of it ends mid-clause.

**FORM.** Candidate 1 of 7. The MICR line is the signature device: it is the only place in the world where three distinct facts are printed in three distinct positions by three distinct machines, and it is reproduced at the foot of every panel that carries a payment state.

**FINISH.** Unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## 4. Tokens

Colour commits at page scale, not as scattered accents: the sage ground owns the page, document white owns every field, and the two saturated colours are rationed to the two states that matter.

| Token | Value | Role | Never |
|---|---|---|---|
| `--ground` | `#DCE3DC` | Page ground | Behind body text |
| `--field` | `#FCFDFA` | Instrument, cards, table body, inputs | As a page ground |
| `--band` | `#F1F4EE` | Alternating register rows, inset fields | As a border colour |
| `--ink` | `#151A17` | All type | As a fill larger than a stamp |
| `--ink-soft` | `#4A524C` | Secondary and supporting text | For amounts |
| `--rule` | `#BEC7BD` | Field rules, column rules, perforation | Decoratively between sections |
| `--rule-strong` | `#8E9A8E` | The instrument's outer edge | On text |
| `--settled` | `#00C08B` | Value that has arrived | As text on white (1.9:1) |
| `--settled-ink` | `#06614A` | Type inside a settled stamp | Anywhere else |
| `--stamp` | `#C0201F` | The unpaid or refunded stamp | As decoration |
| `--stamp-ink` | `#8E1413` | Type inside a red stamp | Anywhere else |

`--settled` is a field colour, not a text colour. A green stamp is green stock with `--settled-ink` type on it, which is also how a real green stamp reads.

Type, two families, both self-hosted as variable `woff2` in `app/fonts` and loaded through `next/font/local`, so the build has no network dependency:

- **Archivo** (variable, weight and width axes). Display at weight 700, width 112, tracking `-0.022em`, sized by a major-third scale from 17px body. UI and body at width 100, weight 400 and 500, 17px with 1.55 line height and a 68 character measure.
- **Martian Mono** (variable). Every amount, invoice number, chain identifier, wallet address and the MICR line. Weight 500 for figures, 400 for the machine line. Its width is the point: money is wide, slow and exact.

No third family. No icon set; the only glyphs are the mark, arrows drawn from the rule weight, and the state stamps.

**Field labels are the only capitals on the page.** `PAY TO`, `MEMO`, `UNPAID` and their kin are the instrument's own printed fields, and each appears once per instrument. There is no tracked all-caps eyebrow above a section heading anywhere in this design, and no meta strings joined by middle dots.

## 5. Signature devices

1. **The amount is stated twice.** Every invoice amount a person might act on appears in figures and in a written-out form, as a cheque does, because a single statement of a number is not trusted. `250.00 USD` is paired with `TWO HUNDRED AND FIFTY US DOLLARS AND 00/100` on the instrument, on the receipt and on the void of the invoice form. The quote is the exception, deliberately: a quoted rate is re-quoted every minute, so spelling it out would be ceremony, and the quote states its route in figures only.
2. **The stamp is the only ornament, and it lands once.** A status change is a stamp placed on a field: slightly off-register, two impressions when it is re-struck. It appears only where a real state exists. It is never used to fill space.
3. **The dry-run pantograph.** A cheque carries a tint that photocopies into the word VOID. A dry-run quote carries a low-contrast repeating `DRY RUN` diagonally across its field. It is the simulation label, made structural. It never replaces the written label, which stays for screen readers and for anyone who cannot see the tint.
4. **The perforation.** One notched rule divides the record from the action. Used at most once per surface: on the pay page it stands vertically between "what you owe" and "how you pay"; on the invoice form it lies between the settlement account and the money fields, so the form reads as two halves: where it lands, then what is owed.
5. **Three fields that never merge.** Invoice status, swap status and refund status print as three separate fields in the MICR line at the foot of any panel showing a payment. The refunded-and-unpaid case is the one the design builds toward: red swap field, unstamped PAY TO field, and the page still reads as unpaid.

## 6. Surfaces

**Landing (`app/page.tsx`, cinematic).** Sections in order: the four-field letterhead, ruled across the top of the content column, which prints what settles, how many routes were verified, where the quote comes from, and that the client needs no login; the display statement in two authored lines with its supporting sentence and its two actions; the sample instrument, under a rule that prints what it is and how to advance it; `01` How it works, three invoice steps in ruled columns with the converter strip beneath for swaps without an invoice; `02` the three states, on the single inverted band, ending on the stamped refunded-but-unpaid case; `03` What is real today, which prints the four verified routes and, beside them, the exact list of what this build does not have; `04` the two-minute judge path, dashboard to pay link to states plus CSV to converter plus shared history, with its summary field and one repeat of the primary action; the footer; and the sticky action on small screens. One inverted band only, ink ground with field-coloured type, and it belongs to the states section because that is the most technical claim on the page.

The instrument prints five states rather than one picture of a payment: nothing quoted, with the amount box left blank as an unfilled field; a dry-run quote, with the amount landed in the settlement field and one of the four routes inked; a deposit address issued, with the swap pending and the invoice still reading UNPAID; swap success, and only then PAID; and the refund, where the swap and the refund fields both read REFUNDED and the invoice deliberately does not. The three fields at the foot of the instrument advance one at a time, the foot line prints the one fact that changed, and the caption beneath changes with the state.

Rewritten at finish. This paragraph had described the statement and the instrument as a single unit, which was true of the first viewport before it was recomposed (§3), and it had never listed How it works, which is one of the page's four numbered sections. It now lists the sections in the order a reader meets them and describes the instrument by its five printed states, because "the routing sequence" named the diagram at the top of the object rather than the object itself.

The brief also asked for a live fragment of the real pay page. It is declined, and recorded here rather than quietly dropped: a fragment of the routing slip without a captured quote would show invented figures, which the product's own honesty rule forbids, and a fragment with a captured quote would be a screenshot of a panel the reader can open in one click anyway. The proof section carries the routing facts instead: the four routes, each with the date and the quote that verified it.

**Invoices (`app/invoices/page.tsx`, register).** The green-bar register, drawn flat: banded rows, column rules, money in Martian Mono, status as a stamp in its own column. The count of invoices sits at the top right as a field, not as a badge. Empty state is an unprinted instrument with the field labels present and blank, which invites action without a card.

**New invoice (`app/invoices/new/page.tsx`, the instrument being written).** A deposit-slip field grid: labelled fields in ruled boxes on document white, the perforation once between the settlement account and the money fields, the amount echoed in words as it is typed so a missing zero shows before send. Focus states are a 2px ink rule on the field, never a glow.

**Pay (`app/pay/[id]/PayClient.tsx`, the instrument presented for payment).** Two documents, split by the vertical perforation: left, the instrument as received, with the amount stated twice and the memo; right, the routing slip: the same document grammar on band stock, where the client chooses a source and a quote comes back as a printed slip. It is the loudest surface in the product without being the darkest: the hierarchy is carried by size, rule weight and the one ink-filled button, not by an inverted fill, because the boldness belongs to the instrument and its stamps. The quote slip that returns is document white, tinted with the dry-run pantograph when it moves nothing. The receipt state replaces the routing slip with a stamped PAID instrument and keeps the explorer reference as a printed field.

All four keep their current information architecture, copy facts and flows. This is a replacement of the visual world, not of the product.

## 7. Motion

The landing's motion is **scroll-linked, not entrance-based**. The hero instrument is sticky, and the page scrolls it through its real states: unpaid, quoting, deposit address issued, settled, and the refund case. On each advance, one thing moves: the field that actually changed. The three MICR fields advance independently and never together, which is the whole product's argument rendered as behaviour rather than as a diagram. Scrolling back rewinds it. There is no other scroll animation on the page.

This replaces the one-shot page-load sequence a cinematic page usually opens with, because a load animation is a decoration that plays once and a scroll-linked instrument is a demonstration that keeps making its point.

The stamp is the page's only other beat: it strikes once, when the states band is reached, overshooting slightly before it settles and leaving a second, lighter impression 2px off register, the mark of a stamp pressed by hand rather than a badge that faded in.

No animation library. CSS transitions, CSS keyframes, one `IntersectionObserver` that strikes the stamp, and one scroll listener, throttled through `requestAnimationFrame`, that decides which of the five states is set. A field that changes takes a 340ms ink strike that fades, so the eye lands on the field that moved. Every narrative beat is under 600ms: the stamp's 460ms, the strike's 340ms, field transitions of 200 to 260ms. The only animations longer than that are the indeterminate ones that exist while the page waits on the API, a 1.4s shimmer on the invoice list's loading stencil and a 0.8s spinner on the submit and quote buttons, which are waiting states rather than beats. Nothing animates on hover except colour and rule weight, at 160 to 200ms; the only movement a button makes is a 1px press offset; and there is no fade-and-slide-up entrance on any section.

`prefers-reduced-motion: reduce` collapses every duration and iteration to a single frame, so the stamp is already struck when it is reached, the strike on a changed field leaves no residue, and the loading shimmer is removed rather than slowed. The stamp is present, not absent. The instrument still prints each state as the page scrolls; it does so without easing, because a state change is not an animation.

## 8. Anti-reference

The current site is the anti-reference. Explicitly not carried forward: the `#f7f7f5` neutral ground, the `#0e1512` dark ledger panel, the emerald-on-neutral-rest-of-the-page accent economy, the rounded-2xl card with a soft shadow as the answer to every grouping problem, the pill with a coloured dot, and the three up-front feature cards with emoji-adjacent icons.

Also banned, because they would drift the new world back toward the default: gradient text, blurred glows, glassmorphism, drop shadows on any document surface, skeuomorphic paper texture, torn edges, tape, and any `→` appended to button text.

## 9. Must not break

The redesign is visual. These are load-bearing and survive every change: the three state machines and their refusal to collapse; a paid invoice never serializing its deposit address across the server/client boundary; dry-run labelling in both the UI and the API response; `robots: { index: false }` on `/invoices` and `/pay/[id]`; tabular numerals on every amount; the CSV export; the skip link; keyboard focus visibility; the sticky mobile action on the landing page; and the `AGENTS.md` instruction to read `node_modules/next/dist/docs/` before writing framework code.

## 10. Self-check

Run against the brief before building.

- **Is the palette guessable from the category?** No. Nothing about cross-chain invoicing predicts sage, document white, scarlet and one arriving green.
- **Is it the category-plus-avoidance look?** No. Avoiding neon does not lead to a security-print instrument; it leads to cream and a serif, which is excluded.
- **Is the hero a big number with a small label, stats and a gradient accent?** No. It is a document that happens to contain a number.
- **Does the direction survive as a table and a form?** Yes, and it is stronger there, which is why candidate 1 beat candidate 4.
- **Is the boldness spent in one place?** Yes: the instrument and its stamps. Everything around them is quiet, ruled and flat.
- **Is anything borrowed that is only a costume?** The E-13B glyphs are not reproduced as a font. The magnetic characters are drawn as field marks at small size only, where they read as registration marks. The material becomes structure and type, not texture.

## 11. Shipping assets and their provenance

The mark is the only artwork, and it is drawn once as vector. Everything else in the icon set is that file, rasterised:

| Shipping file | Size | Where it comes from |
|---|---|---|
| `public/brand/settleform-mark.svg` | 512 viewBox | The master. The Settleform S on its dark tile, drawn once as one path. |
| `public/brand/settleform-mark-inverse.svg` | 359x278 viewBox | The bare S in white, for dark surfaces. |
| `public/brand/settleform-symbol.svg` | 359x278 viewBox | The S in mint gradient, no tile. |
| `public/brand/settleform-lockup-light.svg` / `-dark.svg` / `-white-mono.svg` | 1342x398 viewBox | S plus Settleform wordmark, as supplied. |
| `app/icon.svg` | vector | Copy of the master; served directly to browsers that take SVG. |
| `app/icon.png` | 512 | Rendered from the master by `scripts/make-icons.mjs`. |
| `app/apple-icon.png` | 180 | Same source, square, no transparency. |
| `app/favicon.ico` | 16 / 32 / 48 | Same source, PNG-encoded entries in one ICO container. |
| `public/icon-192.png`, `public/icon-32.png`, `public/favicon.svg` | 192, 32, vector | Stable public URLs for manifests, hotlinks and anything that wants a fixed path. |

Regenerate the whole set from the master in one command; nothing in the set is hand-edited, so a change to the mark cannot leave half the icons behind:

```bash
node scripts/make-icons.mjs public/brand/settleform-mark.svg
```

No 1200x630 Open Graph card ships in this build, which is recorded rather than papered over: the metadata block carries text only and `twitter.card` stays `summary`. A card built from a screenshot would go stale the first time the instrument changed, and the mark alone at that size reads as a favicon.
