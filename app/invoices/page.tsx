export const dynamic = "force-dynamic";

import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import Logo from "@/components/Logo";
import { listInvoices } from "@/lib/invoices";

// No auth in this build: the list contains client names and amounts.
export const metadata: Metadata = {
  title: "Invoices",
  description: "Every invoice you have issued, its payment state, and its public pay link.",
  // No canonical: this route is noindex, and a self-canonical would
  // contradict that. Only the indexable landing page names one.
  robots: { index: false, follow: false },
};

/**
 * A status on this register is a stamp, not a coloured dot. The three inked
 * words are the only saturated colour on the page, because they are the only
 * thing a reader is scanning for.
 */
function StatusStamp({ status, swap }: { status: string; swap: string | null }) {
  if (status === "PAID") {
    return <span className="pill pill-paid">PAID</span>;
  }
  if (swap === "REFUNDED") {
    return <span className="pill pill-refunded">SWAP REFUNDED</span>;
  }
  return <span className="pill pill-unpaid">UNPAID</span>;
}

function TableSkeleton() {
  return (
    <div className="instrument mt-8 overflow-hidden" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading invoices</span>
      <div className="border-b border-rule px-5 py-4">
        <div className="skeleton h-3 w-24" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 border-b border-rule px-5 py-5 last:border-0">
          <div className="skeleton h-3.5 w-20" />
          <div className="skeleton h-3.5 w-32" />
          <div className="skeleton ml-auto h-3.5 w-20" />
          <div className="skeleton h-5 w-24" />
        </div>
      ))}
    </div>
  );
}

async function InvoicesBody() {
  let invoices: Awaited<ReturnType<typeof listInvoices>> = [];
  let storeFailed = false;
  try {
    invoices = await listInvoices();
  } catch {
    // The store refuses to be read rather than pretending to be empty, so the page
    // has to say so: an empty register and an unreadable one look identical to a
    // reader, and only one of them means "create your first invoice".
    storeFailed = true;
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-rule py-5">
        <Logo />
        <nav aria-label="Invoices" className="flex flex-none items-center gap-2">
          <Link href="/convert" className="btn-ghost">Convert</Link>
          <Link href="/invoices/new" className="btn-primary">New invoice</Link>
        </nav>
      </header>

      <main id="main">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-10">
        <div>
          <h1 className="display text-[32px] sm:text-[40px]">Invoices</h1>
          <p className="mt-2 text-[14.5px] text-ink-soft">Every invoice settles to USDC on NEAR.</p>
        </div>
        {invoices.length > 0 ? (
          <div className="text-right">
            <p className="field-label">ON THE REGISTER</p>
            <p className="mono mt-1 text-[22px] leading-none">{invoices.length}</p>
          </div>
        ) : null}
      </div>

      {storeFailed ? (
        <div className="instrument mt-8">
          <div className="inst-head">
            <span>REGISTER UNAVAILABLE</span>
            <span className="inst-date">-</span>
          </div>
          <div className="inst-body">
            <p className="text-[16px] font-medium">The invoice file could not be read.</p>
            <p className="measure mt-2 text-[14px] leading-6 text-ink-soft">
              Nothing has been changed on disk. The file is <span className="mono">data/invoices.json</span>,
              and it is either being written by another process or no longer holds valid JSON. Fix it and
              reload; issuing a new invoice over it would replace what is there.
            </p>
          </div>
        </div>
      ) : invoices.length === 0 ? (
        <div className="instrument mt-8">
          <div className="inst-head">
            <span>NO INVOICES ISSUED</span>
            <span className="inst-date">0</span>
          </div>
          <div className="inst-body">
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <p className="field-label">BILLED TO</p>
                <div className="mt-3 h-9 border-b border-rule" />
              </div>
              <div>
                <p className="field-label">AMOUNT</p>
                <div className="mt-3 h-9 border-b border-rule" />
              </div>
            </div>
            <div className="mt-8 border-t border-rule pt-6">
              <p className="text-[16px] font-medium">No invoices yet. Create your first invoice.</p>
              <p className="measure mt-2 text-[14px] leading-6 text-ink-soft">
                You get a shareable pay link. Your client pays with a supported asset and you receive
                USDC on NEAR.
              </p>
              <Link href="/invoices/new" className="btn-primary mt-6">Create the first invoice</Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <ul className="mt-8 sm:hidden">
            {invoices.map((inv) => (
              <li key={inv.id} className="border-t border-rule py-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="mono text-[12px] text-ink-soft">{inv.number}</p>
                    <p className="mt-1 truncate text-[16px] font-medium" title={inv.client}>
                      {inv.client}
                    </p>
                  </div>
                  <StatusStamp status={inv.status} swap={inv.swapStatus} />
                </div>
                <p className="mono mt-3 text-[20px]">
                  {inv.amount} <span className="text-[13px] text-ink-soft">{inv.currency}</span>
                </p>
                <Link href={"/pay/" + inv.id} className="btn-ghost mt-4 w-full">
                  Open the instrument
                </Link>
              </li>
            ))}
          </ul>

          <div className="instrument mt-8 hidden sm:block">
            <div className="table-wrap">
              <table className="w-full min-w-[680px] text-left text-[14px]">
                <caption className="sr-only">Your invoices, newest first</caption>
                <thead>
                  <tr className="border-b border-rule-strong">
                    <th scope="col" className="field-label px-5 py-3">NUMBER</th>
                    <th scope="col" className="field-label px-5 py-3">CLIENT</th>
                    <th scope="col" className="field-label px-5 py-3 text-right">AMOUNT</th>
                    <th scope="col" className="field-label px-5 py-3">STATUS</th>
                    <th scope="col" className="field-label px-5 py-3 text-right">PAY LINK</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="border-b border-rule transition-colors duration-150 last:border-0 even:bg-band hover:bg-field"
                    >
                      <td className="mono px-5 py-4 text-[13px]">{inv.number}</td>
                      <td className="px-5 py-4 font-medium">{inv.client}</td>
                      <td className="mono px-5 py-4 text-right">
                        {inv.amount}
                        <span className="ml-1.5 text-[12px] text-ink-soft">{inv.currency}</span>
                      </td>
                      <td className="px-5 py-4">
                        <StatusStamp status={inv.status} swap={inv.swapStatus} />
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={"/pay/" + inv.id}
                          className="font-medium underline decoration-rule underline-offset-4 hover:decoration-ink"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="inst-foot">
              <span>Held in one file on this machine, not a hosted ledger.</span>
              <span className="mono">newest first</span>
            </div>
          </div>
        </>
      )}
      </main>
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8">
          <div className="border-b border-rule py-5">
            <div className="skeleton h-8 w-40" />
          </div>
          <div className="pt-10">
            <div className="skeleton h-9 w-48" />
          </div>
          <TableSkeleton />
        </div>
      }
    >
      <InvoicesBody />
    </Suspense>
  );
}
