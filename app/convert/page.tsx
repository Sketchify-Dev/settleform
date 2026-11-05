export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import { loadAssets } from "@/lib/oneclick";
import ConvertClient from "./ConvertClient";

// A utility page, not a document. Nothing here belongs in an index.
export const metadata: Metadata = {
  title: "Convert to USDC on NEAR",
  description:
    "Send a supported token from a supported chain and receive USDC in a NEAR account you choose. No invoice, no login, nothing to sign up for.",
  // No canonical: this route is noindex, and a self-canonical would
  // contradict that. Only the indexable landing page names one.
  robots: { index: false, follow: false },
};

export default async function ConvertPage() {
  // The asset table stays on the server: it names the chains this demo can actually
  // reach, and the form should not invent a route the quote route will refuse.
  const { sources } = await loadAssets();
  const options = sources.map((s) => ({
    assetId: s.assetId,
    symbol: s.symbol,
    chain: s.blockchain,
    label: s.label,
    refundFormat: s.refundFormat,
  }));

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-rule py-5">
        <Logo />
        <nav aria-label="Convert" className="flex flex-none items-center gap-2">
          <Link href="/" className="btn-ghost hidden sm:inline-flex">Home</Link>
          <Link href="/invoices" className="btn-ghost">Dashboard</Link>
          <Link href="/invoices/new" className="btn-ghost">New invoice</Link>
        </nav>
      </header>

      <main id="main">
      <div className="pt-10">
        <h1 className="display text-[32px] sm:text-[40px]">Convert to USDC on NEAR</h1>
        <p className="mt-2 text-[14.5px] leading-7 text-ink-soft">
          Name the NEAR account you want the money in, pick what you are paying with, and send the
          exact figure to the address you are given. Nothing is charged until you send funds.
        </p>
      </div>

      <ConvertClient sources={options} />
      </main>
    </div>
  );
}
