export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import { notFound } from "next/navigation";
import Logo from "@/components/Logo";
import { getInvoice, type Invoice } from "@/lib/invoices";
import PayClient from "./PayClient";

// A capability URL: unguessable, shared deliberately, never for a search index.
export const metadata: Metadata = {
  title: "Pay invoice",
  description: "Pay this invoice with a supported token from a supported chain. Settlement arrives as USDC on NEAR.",
  // No canonical: each pay link is a unique capability URL, and naming one URL
  // as canonical would tell a crawler the others are duplicates of it.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * A paid invoice is immutable and must not expose its deposit address, so strip it
 * before the invoice crosses the server/client boundary. Passing the record intact
 * would serialize the address into the page payload even though the UI never renders it.
 */
function forClient(inv: Invoice): Invoice {
  if (inv.status !== "PAID" || !inv.payment?.depositAddress) return inv;
  const payment = { ...inv.payment };
  delete payment.depositAddress;
  return { ...inv, payment };
}

function Unavailable() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 sm:px-8">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="border-b border-rule py-5">
        <Logo />
      </header>
      <main id="main">
      <div className="instrument mt-8">
        <div className="inst-head">
          <span>INSTRUMENT UNAVAILABLE</span>
          <span className="inst-date">-</span>
        </div>
        <div className="inst-body">
          <p className="text-[16px] font-medium">This invoice could not be read.</p>
          <p className="measure mt-2 text-[14px] leading-6 text-ink-soft">
            Nothing has been changed on disk and no payment was started. Try the link again in a
            moment; if it keeps failing, the invoice file on this machine needs a look.
          </p>
        </div>
      </div>
      </main>
    </div>
  );
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Resolve before returning any JSX. Inside a Suspense boundary the response has
  // already started streaming, so notFound() renders the 404 page with HTTP 200.
  // A store that cannot be read is not a 404: the invoice may well exist, and
  // saying it does not would invite the reader to pay it again.
  let invoice: Invoice | null;
  try {
    invoice = await getInvoice(id);
  } catch {
    return <Unavailable />;
  }
  if (!invoice) notFound();

  let sources: Parameters<typeof PayClient>[0]["sources"];
  try {
    const raw = await fs.readFile(path.join(process.cwd(), "data", "supported-assets.json"), "utf8");
    sources = (JSON.parse(raw) as { sources: unknown[] }).sources as Parameters<typeof PayClient>[0]["sources"];
  } catch {
    return <Unavailable />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="flex items-center justify-between gap-4 border-b border-rule py-5">
        <Logo />
        <Link href="/invoices" className="btn-ghost">Dashboard</Link>
      </header>
      <main id="main">
      <div className="pt-8">
        <PayClient invoice={forClient(invoice)} sources={sources} />
      </div>
      </main>
    </div>
  );
}
