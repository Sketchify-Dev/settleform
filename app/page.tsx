import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import HeroInstrument from "@/components/HeroInstrument";
import Stamp from "@/components/Stamp";
import supportedAssets from "@/data/supported-assets.json";
import { SITE_URL } from "@/lib/site";
import seedInvoices from "@/data/invoices.example.json";
import seedConversions from "@/data/conversions.example.json";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const DESTINATION = supportedAssets.destinationAsset;
const SOURCES = supportedAssets.sources;
const VERIFIED_ROUTES = SOURCES.length;

const STEPS = [
  {
    n: "01",
    title: "Create the invoice",
    body: "Client, amount, due date, line items. Pick the NEAR account that receives USDC. You get a shareable pay link. Your client needs nothing new: no login, no install, no seed phrase. They pay from the wallet they already hold.",
  },
  {
    n: "02",
    title: "Your client gets a route",
    body: "The pay page lists only assets verified through the 1Click API. They preview a dry-run quote first: rate, expected USDC and the fee line, clearly marked as a quote that moved nothing.",
  },
  {
    n: "03",
    title: "You receive USDC on NEAR",
    body: "A live quote opens a deposit address and tracks each status change. Settlement renders a receipt with explorer links and one CSV row your accountant can open.",
  },
];

const CONVERT_STEPS = [
  {
    n: "01",
    title: "Name the account",
    body: "Any mainnet NEAR account, yours or anyone's. A testnet destination is refused with the same mainnet message the invoice form gives.",
  },
  {
    n: "02",
    title: "Get the exact figure",
    body: "Pick a supported token and a USDC amount. The quote returns the exact source figure to send plus a 1Click deposit address, polling from there. No conversion fee is taken: what you send is what lands.",
  },
  {
    n: "03",
    title: "Send and watch it land",
    body: "Send the figure, then watch the status line poll to SUCCESS, REFUNDED or FAILED. Finished swaps file into the shared history with explorer legs, a CSV row and a downloadable receipt.",
  },
];

// The hero's filed-conversion slip may only state what the shipped data actually
// contains, so it reads the seed file. If the seed ever empties, the slip
// disappears instead of inventing a swap.
const EXAMPLE_CONVERSION = seedConversions.length > 0 ? seedConversions[0] : null;
const EXAMPLE_DATE = EXAMPLE_CONVERSION
  ? EXAMPLE_CONVERSION.finishedAt.slice(0, 10)
  : null;

const STATES = [
  {
    key: "Invoice",
    values: ["UNPAID", "PAID"],
    body: "Whether the money you were owed has arrived in your account. Nothing else sets that fact.",
  },
  {
    key: "Swap",
    values: ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS", "INCOMPLETE_DEPOSIT", "REFUNDED", "FAILED"],
    body: "Where the conversion is. It moves on its own schedule, and it is not the same fact as the invoice.",
  },
  {
    key: "Refund",
    values: ["NONE", "REFUNDED"],
    body: "Whether the deposit went back to the sender. A refund is the swap failing, not the invoice being paid.",
  },
];

// The proof section may only state what the shipped data actually contains, so
// the count is read from the seed file. Written as a literal it had already
// drifted: it promised two pending-deposit invoices, and the seed holds one
// unpaid invoice with no payment at all.
const SEED_PHRASE =
  seedInvoices.length === 1 ? "one invoice" : seedInvoices.length + " invoices";

// Same honesty rule as the invoice seed: the history count is read from the
// shipped file, so the page cannot promise proof it does not carry.
const HISTORY_PHRASE =
  seedConversions.length === 1
    ? "one filed conversion"
    : seedConversions.length + " filed conversions";

const MISSING = [
  "No settled invoice in the seed. It ships " +
    SEED_PHRASE +
    ", unpaid, with no deposit address and no transaction reference.",
  "No invoice has reached PAID from a real deposit, so the paid state you can scroll through here is the one path still unproven. One live conversion has settled, though: 0.5 USDC withdrawn to a NEAR account on 2026-11-04, through the same swap request the pay links send.",
  "The live build runs at settleform.vercel.app. Records live in local JSON files, not a database, so a fresh deploy starts from the seed.",
];

function SectionHead({
  index,
  title,
  children,
  id,
  muted = false,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
  id?: string;
  muted?: boolean;
}) {
  return (
    <div id={id} className="scroll-mt-8 border-t border-rule-strong pt-5">
      <div className="flex items-baseline gap-4">
        <span className={`mono text-[11.5px] ${muted ? "text-field/60" : "text-ink-soft"}`}>{index}</span>
        <h2 className={`display text-[28px] sm:text-[36px] ${muted ? "text-field" : "text-ink"}`}>
          {title}
        </h2>
      </div>
      {/* No width cap: the intro fills the container and wraps only when the line
          is full, the same rule as every other supporting paragraph. */}
      <div className={`mt-3 text-[14.5px] leading-7 ${muted ? "text-field/70" : "text-ink-soft"}`}>
        {children}
      </div>
    </div>
  );
}

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Settleform",
  url: SITE_URL,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description:
    "Create a shareable invoice, let clients pay with supported tokens from supported chains, and receive USDC on NEAR.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function Home() {
  return (
    <>
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }}
    />
    <div className="pb-28 sm:pb-16">
      <a href="#main" className="skip-link">Skip to content</a>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-rule py-5">
          <Logo />
          <nav aria-label="Primary" className="hidden items-center gap-7 text-[14px] font-medium text-ink-soft sm:flex">
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#states" className="hover:text-ink">Payment states</a>
            <a href="#proof" className="hover:text-ink">What is real</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link href="/invoices" className="btn-ghost hidden sm:inline-flex">Dashboard</Link>
            <Link href="/invoices/new" className="btn-primary">New invoice</Link>
          </div>
        </header>

        <main id="main">
          <dl className="hero-ledger" aria-label="What this build settles">
            <div>
              <dt className="field-label">Settlement asset</dt>
              <dd className="hero-ledger-value">USDC on NEAR</dd>
            </div>
            <div>
              <dt className="field-label">Verified routes</dt>
              <dd className="hero-ledger-value">{VERIFIED_ROUTES}</dd>
            </div>
            <div>
              <dt className="field-label">Quote source</dt>
              <dd className="hero-ledger-value">1Click API</dd>
            </div>
            <div>
              <dt className="field-label">Client login</dt>
              <dd className="hero-ledger-value">Not required</dd>
            </div>
          </dl>

          <section className="pt-9 sm:pt-12">
            <h1 className="display hero-h1">
              <span className="sm:block">Invoice a client, or convert it yourself.</span>{" "}
              <span className="sm:block">Either way, USDC lands on NEAR.</span>
            </h1>
            {/* No width cap: on desktop the paragraph fills the container and wraps
                only when the line is full, instead of stacking as short lines. */}
            <p className="mt-5 text-[16px] leading-7 text-ink-soft sm:text-[17px]">
              Send a client a pay link, or swap straight through to any NEAR account you name.
              Neither side needs a new account, a wallet install, or a network switch, and USDC
              settles on NEAR in full view.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-x-3 gap-y-4">
              <Link href="/invoices/new" className="btn-primary w-full sm:w-auto">Create an invoice</Link>
              <Link href="/convert" className="btn-ghost w-full sm:w-auto">Convert without an invoice</Link>
              <span className="hero-note">No funds needed to try it.</span>
            </div>
          </section>

          <section className="pt-9 sm:pt-11" aria-label="Example invoice moving through its states">
            <div className="flex items-baseline justify-between gap-4 border-t border-rule-strong pt-3">
              <span className="field-label">Sample invoice, five states</span>
              <span className="mono flex-none whitespace-nowrap text-[11px] text-ink-soft">Scroll to advance</span>
            </div>
            <HeroInstrument />
            {EXAMPLE_CONVERSION ? (
              <div className="mt-6 border border-rule-strong bg-field">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-5 py-3 sm:px-6">
                  <span className="field-label">Filed conversion, {EXAMPLE_DATE}</span>
                  <span className="mono text-[11px] text-ink-soft">{EXAMPLE_CONVERSION.status}</span>
                </div>
                <div className="px-5 py-5 sm:px-6">
                  <p className="mono text-[15px] leading-7 sm:text-[16px]">
                    {EXAMPLE_CONVERSION.amountInFormatted} {EXAMPLE_CONVERSION.sourceSymbol} to{" "}
                    {EXAMPLE_CONVERSION.settledUsdc} {EXAMPLE_CONVERSION.destinationSymbol} on NEAR
                  </p>
                  <p className="mono mt-1 text-[12.5px] text-ink-soft">
                    to {EXAMPLE_CONVERSION.destinationNear}
                  </p>
                  <p className="mt-3 text-[13.5px] leading-6 text-ink-soft">
                    The builder&apos;s own settled swap, through the same swap request the pay
                    links send. Both legs are on record:{" "}
                    {EXAMPLE_CONVERSION.legs.map((leg, i) => (
                      <span key={leg.label}>
                        {i > 0 ? " and " : ""}
                        <a
                          href={leg.links[0]}
                          className="font-medium text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                        >
                          {leg.label.toLowerCase()}
                        </a>
                      </span>
                    ))}
                    . No invoice was created for it, and the register is untouched. More file into
                    the{" "}
                    <Link href="/convert" className="font-medium text-ink underline decoration-rule underline-offset-4 hover:decoration-ink">
                      shared conversion history
                    </Link>
                    .
                  </p>
                </div>
              </div>
            ) : null}
          </section>

          <section className="pt-16 sm:pt-24">
            <SectionHead index="01" title="How it works" id="how">
              The freelancer never touches a wallet, a gas token or a network switch, invoicing
              or converting. That is the whole point, so neither path ever asks for one.
            </SectionHead>

            <h3 className="mt-8 text-[17px] font-medium leading-6">With an invoice</h3>
            <div className="mt-4 grid border-t border-rule md:grid-cols-3 md:border-t-0">
              {STEPS.map((step, i) => (
                <div
                  key={step.n}
                  className={`border-b border-rule py-7 md:border-t md:border-b-0 md:pr-8 ${
                    i > 0 ? "md:border-l md:pl-8" : ""
                  }`}
                >
                  <span className="mono text-[12px] font-medium text-ink-soft">{step.n}</span>
                  <h4 className="mt-3 text-[17px] font-medium leading-6">{step.title}</h4>
                  <p className="mt-2 text-[14px] leading-6 text-ink-soft">{step.body}</p>
                </div>
              ))}
            </div>

            <h3 className="mt-10 text-[17px] font-medium leading-6">Without an invoice</h3>
            <div className="mt-4 grid border-t border-rule md:grid-cols-3 md:border-t-0">
              {CONVERT_STEPS.map((step, i) => (
                <div
                  key={step.n}
                  className={`border-b border-rule py-7 md:border-t md:border-b-0 md:pr-8 ${
                    i > 0 ? "md:border-l md:pl-8" : ""
                  }`}
                >
                  <span className="mono text-[12px] font-medium text-ink-soft">{step.n}</span>
                  <h4 className="mt-3 text-[17px] font-medium leading-6">{step.title}</h4>
                  <p className="mt-2 text-[14px] leading-6 text-ink-soft">{step.body}</p>
                </div>
              ))}
            </div>
            <p className="mt-8 border-t border-rule pt-6 text-[14px] leading-6 text-ink-soft">
              Both paths quote against the same 1Click API and list only the verified routes
              below. Nothing unverified is ever offered.{" "}
              <Link href="/convert" className="font-medium underline decoration-rule underline-offset-4 hover:decoration-ink">
                Open the converter
              </Link>{" "}
              any time there is no invoice to send.
            </p>
          </section>
        </main>
      </div>

      <section id="states" className="mt-16 scroll-mt-8 bg-ink py-16 text-field sm:mt-24 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <SectionHead index="02" title="Three states, never one" muted>
            Most payment demos blur simulated and real until the reader cannot tell which happened.
            This one keeps three separate records, because they answer three different questions.
            Conversions without an invoice track the same swap record on its own, with no invoice
            for it to set.
          </SectionHead>

          <div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-0">
            {STATES.map((state, i) => (
              <div
                key={state.key}
                className={`border-t border-field/20 pt-5 md:border-t-0 md:pt-0 md:pr-8 ${
                  i > 0 ? "md:border-l md:border-field/20 md:pl-8" : ""
                }`}
              >
                <h3 className="text-[15px] font-medium text-field">{state.key} status</h3>
                <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
                  {state.values.map((value) => (
                    <li key={value} className="mono text-[12px] text-field/60">
                      {value}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-[14px] leading-6 text-field/70">{state.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 grid gap-10 border-t border-field/20 pt-8 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="display max-w-[34ch] text-[22px] text-field sm:text-[26px]">
                A refunded swap leaves the invoice unpaid.
              </p>
              <p className="measure mt-3 text-[14.5px] leading-7 text-field/70">
                The swap says REFUNDED, the deposit went back to the sender, and the invoice still
                reads UNPAID. It never borrows the word PAID, because no money settled, which is
                exactly why three separate records exist instead of one record with three labels.
              </p>
            </div>
            <Stamp />
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <section className="pt-16 sm:pt-24">
          <SectionHead index="03" title="What is real today" id="proof">
            Hackathon demos tend to show more than they have. This is the exact list of evidence
            behind this build, and the exact list of what it does not have yet.
          </SectionHead>

          <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="border-t border-rule-strong">
              <div className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
                <h3 className="text-[15px] font-medium">Routes verified against the 1Click API</h3>
                <span className="mono text-[12px] text-ink-soft">{VERIFIED_ROUTES}</span>
              </div>
              <ul>
                {SOURCES.map((source) => (
                  <li key={source.assetId} className="border-b border-rule py-3.5">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <span className="text-[14.5px] font-medium">{source.label}</span>
                      <span className="mono text-[11.5px] text-ink-soft">{source.blockchain}</span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{source.verified}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-[12.5px] leading-6 text-ink-soft">
                All {VERIFIED_ROUTES} settle to {DESTINATION.symbol} on NEAR. Everything that is not
                on this list is not offered, because it was never confirmed. One live conversion has
                run the whole way: a deposit on the source chain, {DESTINATION.symbol} withdrawn to the
                named NEAR account, confirmed on 2026-11-04. It is filed in the{" "}
                <Link href="/convert" className="font-medium underline decoration-rule underline-offset-4 hover:decoration-ink">
                  shared conversion history
                </Link>
                , newest first, with both explorer legs, a CSV row and a receipt PNG, so on a fresh
                machine the history opens on {HISTORY_PHRASE} rather than on an empty list.
              </p>
            </div>

            <div className="bg-band p-6">
              <h3 className="text-[15px] font-medium">What this build does not have yet</h3>
              <ul className="mt-4 space-y-3">
                {MISSING.map((item) => (
                  <li key={item} className="flex gap-3 text-[13.5px] leading-6 text-ink-soft">
                    <span aria-hidden="true" className="mt-2.5 block h-1.5 w-1.5 shrink-0 bg-ink" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-5 border-t border-rule pt-4 text-[13px] leading-6 text-ink">
                Any invoice shown on this page is labelled a sample, and any quote that moved nothing
                is labelled a dry run, in the panel and in the API response.
              </p>
            </div>
          </div>
        </section>

        <section className="pt-16 sm:pt-24">
          <SectionHead index="04" title="Try it in two minutes" id="judges">
            No funds, no setup and no walkthrough. Each step below works on a clean machine.
          </SectionHead>

          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
            <ol className="border-t border-rule-strong">
              {[
                ["Open the dashboard", "The register opens on the seed: " + SEED_PHRASE + ", unpaid, with no deposit address and no transaction reference. Nothing there is dressed up as settled."],
                ["Open a pay link", "Pick a supported route and request a dry-run quote. The rate comes from the live 1Click API and the panel says plainly that nothing moved."],
                ["Watch the states stay apart", "Invoice, swap and refund each change on their own. Then read the CSV export, which is the row your accountant would keep."],
                ["Convert without an invoice", "Name any mainnet NEAR account, pick a supported token and send the exact figure. Finished swaps file into the shared history with explorer links, CSV and receipt PNG, opening on the builder's own settled 0.5 USDC conversion."],
              ].map(([title, body], i) => (
                <li key={title} className="flex gap-5 border-b border-rule py-5">
                  <span className="mono mt-0.5 text-[12px] text-ink-soft">{`0${i + 1}`}</span>
                  <div>
                    <p className="text-[15px] font-medium">{title}</p>
                    <p className="mt-1.5 text-[14px] leading-6 text-ink-soft">{body}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="border border-rule-strong bg-field p-6">
              <dl className="space-y-3 text-[13px]">
                {[
                  ["Funds required", "none"],
                  ["Client login", "not needed"],
                  ["Live quote", "1Click API"],
                  ["Settlement asset", "USDC / NEAR"],
                  ["Without an invoice", "/convert"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 border-b border-rule pb-2.5 last:border-0 last:pb-0">
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className="mono text-[12.5px]">{v}</dd>
                  </div>
                ))}
              </dl>
              <Link href="/invoices" className="btn-primary mt-6 w-full">Open the dashboard</Link>
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t border-rule-strong pt-6 text-[13px] text-ink-soft">
          <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#how" className="underline decoration-rule underline-offset-4 hover:decoration-ink">How it works</a>
            <a href="#states" className="underline decoration-rule underline-offset-4 hover:decoration-ink">Payment states</a>
            <a href="#proof" className="underline decoration-rule underline-offset-4 hover:decoration-ink">What is real</a>
            <Link href="/convert" className="underline decoration-rule underline-offset-4 hover:decoration-ink">Convert without an invoice</Link>
            <Link href="/invoices" className="underline decoration-rule underline-offset-4 hover:decoration-ink">Dashboard</Link>
          </nav>
          <p className="mt-4">Built for NEAR Hackathon. Primary track: Real-World Money.</p>
        </footer>
      </div>

      <div className="sticky-cta sm:hidden">
        <Link href="/invoices/new" className="btn-primary w-full">Create an invoice</Link>
      </div>
    </div>
    </>
  );
}
