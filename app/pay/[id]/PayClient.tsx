"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Invoice } from "@/lib/invoices";
import { amountInWords } from "@/lib/amount-words";
import { IN_FLIGHT, releasable } from "@/lib/payment-window";

interface SourceAsset {
  assetId: string;
  blockchain: string;
  symbol: string;
  decimals: number;
  label: string;
  refundFormat: string;
}

interface QuoteOut {
  dry: boolean;
  correlationId: string | null;
  deadline: string;
  originAsset: string;
  sourceSymbol: string;
  sourceChain: string;
  amountIn: string;
  amountInFormatted: string;
  amountOut: string;
  amountOutFormatted: string;
  minAmountOut: string;
  amountOutUsd: string;
  timeEstimate: number | null;
  withdrawFee: string;
  refundFee: string;
  depositAddress: string | null;
}

interface StatusOut {
  invoiceStatus: string;
  swapStatus: string | null;
  plain: string | null;
  error?: string;
  refundReason?: string;
  payment?: Invoice["payment"];
}

const POLL_MS = 5000;

/** A transaction reference prints as its hash, never as a full URL. */
function txHashOnly(ref: string): string {
  const trimmed = ref.trim();
  const m = trimmed.match(/^https?:\/\/[^\/]+\/(?:.*\/)?([^\/\?#]+)(?:[\?#].*)?$/);
  return m ? m[1] : trimmed;
}

/**
 * One proof reference as printed: the hash, linked when it points at one.
 * The text always reads the hash; the link goes to the scanner.
 */
function proofRef(ref: string) {
  const hash = txHashOnly(ref);
  if (/^https?:\/\//.test(ref)) {
    return (
      <a href={ref} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{hash}</a>
    );
  }
  return <span>{ref}</span>;
}

/** Swap states that have stopped moving for this deposit. */
const TERMINAL_SWAP = ["REFUNDED", "FAILED"];

/** The live payment an invoice has open, assembled from whichever source is freshest. */
interface OpenPayment {
  address: string;
  symbol: string | null;
  chain: string | null;
  amountIn: string | null;
  expectedUsdc: string | null;
  fee: string | null;
  deadline: string | null;
}

function openFromStored(p: Invoice["payment"] | null | undefined): OpenPayment | null {
  if (!p?.depositAddress) return null;
  return {
    address: p.depositAddress,
    symbol: p.sourceSymbol ?? null,
    chain: p.sourceChain ?? null,
    amountIn: p.quotedRate ?? null,
    expectedUsdc: p.expectedUsdc ?? null,
    fee: p.fee ?? null,
    deadline: p.deadline ?? null,
  };
}

function openFromQuote(q: QuoteOut | null): OpenPayment | null {
  if (!q || q.dry || !q.depositAddress) return null;
  return {
    address: q.depositAddress,
    symbol: q.sourceSymbol,
    chain: q.sourceChain,
    amountIn: q.amountInFormatted ? q.amountInFormatted + " " + q.sourceSymbol : null,
    expectedUsdc: q.amountOutFormatted,
    fee: q.withdrawFee,
    deadline: q.deadline || null,
  };
}

function openFromResponse(body: { depositAddress?: unknown; deadline?: unknown }): OpenPayment | null {
  if (typeof body.depositAddress !== "string" || !body.depositAddress) return null;
  return {
    address: body.depositAddress,
    symbol: null,
    chain: null,
    amountIn: null,
    expectedUsdc: null,
    fee: null,
    deadline: typeof body.deadline === "string" ? body.deadline : null,
  };
}

/**
 * Past its deadline a quote will no longer settle through its address, so the
 * payment is over. A deposit the route has already seen is money in flight and
 * outlives the clock, which is the same rule the quote route applies.
 */
function hasExpired(p: OpenPayment | null, swapStatus: string | null, now: number): boolean {
  if (!p?.deadline) return false;
  if (swapStatus && IN_FLIGHT.includes(swapStatus) && swapStatus !== "PENDING_DEPOSIT") return false;
  const at = Date.parse(p.deadline);
  return Number.isNaN(at) ? false : now >= at;
}

const STAGES = [
  { key: "deposit", label: "Deposit" },
  { key: "swap", label: "Swap" },
  { key: "settle", label: "Settle" },
] as const;

function stageIndex(swap: string | null): number {
  if (!swap) return -1;
  if (swap === "PENDING_DEPOSIT" || swap === "INCOMPLETE_DEPOSIT") return 0;
  if (swap === "KNOWN_DEPOSIT_TX") return 1;
  if (swap === "PROCESSING") return 1;
  if (swap === "SUCCESS") return 2;
  return -1;
}

const CHAIN_NAMES: Record<string, string> = {
  eth: "Ethereum",
  base: "Base",
  near: "NEAR",
  arbitrum: "Arbitrum",
  polygon: "Polygon",
  bnb: "BNB Chain",
};

function chainName(chain: string | undefined): string {
  if (!chain) return "the source chain";
  return CHAIN_NAMES[chain] ?? chain;
}

function Tick() {
  return (
    <span className="inst-tick" aria-hidden="true">
      <b />
    </span>
  );
}

const CANCEL_NOTE =
  "Cancelling reopens this invoice for a new quote. It cannot close the deposit address itself, so do not send funds to it afterwards.";

/**
 * Releasing the open payment, as two clicks.
 *
 * It is the one control on this page that takes something away, so it asks first
 * and says what it cannot do while it asks: the address stays payable until 1Click
 * retires it, and a payer who reads "cancel" as "recall" would send funds into a
 * payment nothing here is watching any more.
 */
function CancelControl({
  expired,
  busy,
  confirming,
  onAsk,
  onKeep,
  onConfirm,
}: {
  expired: boolean;
  busy: boolean;
  confirming: boolean;
  onAsk: () => void;
  onKeep: () => void;
  onConfirm: () => void;
}) {
  const cls = "btn-ghost min-h-0 px-3 py-1.5 text-[12px]";
  if (!confirming) {
    return (
      <button type="button" onClick={onAsk} disabled={busy} className={cls}>
        {expired ? "Clear this address" : "Cancel this payment"}
      </button>
    );
  }
  return (
    <>
      <button type="button" onClick={onConfirm} disabled={busy} className={cls}>
        {busy ? (<><span className="spinner" aria-hidden="true" /> Cancelling...</>) : "Yes, cancel it"}
      </button>
      <button type="button" onClick={onKeep} disabled={busy} className={cls}>
        Keep it
      </button>
    </>
  );
}

function CancelNote({ confirming, error }: { confirming: boolean; error: string | null }) {
  if (!confirming && !error) return null;
  return (
    <>
      {confirming ? <p className="mt-2 text-[12px] leading-5 text-ink-soft">{CANCEL_NOTE}</p> : null}
      {error ? <p className="mt-1 text-[12.5px] leading-6 text-stamp-ink">{error}</p> : null}
    </>
  );
}

export default function PayClient({
  invoice: initial,
  sources,
}: {
  invoice: Invoice;
  sources: SourceAsset[];
}) {
  const [invoice, setInvoice] = useState<Invoice>(initial);
  const [assetId, setAssetId] = useState(sources[0]?.assetId ?? "");
  const [refundTo, setRefundTo] = useState("");
  const [quote, setQuote] = useState<QuoteOut | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quoteBusy, setQuoteBusy] = useState<null | "dry" | "live">(null);
  const [failedMode, setFailedMode] = useState<"dry" | "live">("dry");
  const [status, setStatus] = useState<StatusOut | null>(null);
  const paid = invoice.status === "PAID";
  const storedAddress = invoice.payment?.depositAddress ?? null;
  /**
   * The payment the server told us about after this page was rendered. The props
   * on this component are a snapshot from the server render, so a payment
   * started in another tab, or started here a moment after the page was
   * generated, exists on the invoice but not in `invoice`. Without this the payer
   * sees the quote form, presses the only button that makes sense, and is
   * answered with a conflict about a payment the page never mentioned.
   */
  const [adopted, setAdopted] = useState<OpenPayment | null>(null);
  const resumesLive = !paid && !!storedAddress && !!invoice.swapStatus && IN_FLIGHT.includes(invoice.swapStatus);
  // A swap that already ended (refunded or failed) has to be read once as
  // well. Otherwise opening a refunded pay link shows the invoice without the
  // refund reason: nothing on the page is polling, and the reader is left to
  // request a quote to find out what happened to their money. The poll that this
  // starts stops itself on the first terminal answer, so it is one request, not
  // a loop.
  const endedStored = !paid && !!invoice.swapStatus && TERMINAL_SWAP.includes(invoice.swapStatus);
  const [live, setLive] = useState(resumesLive || endedStored);
  const [copied, setCopied] = useState<null | "link" | "address">(null);
  // Releasing the open payment. It lives on the invoice, not on a quote, so it
  // survives a reload and is the one way out of a deposit address the payer has
  // decided not to use.
  const [cancelStep, setCancelStep] = useState<null | "confirming">(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [released, setReleased] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  // A live payment is polled from the moment it starts until it reaches a terminal
  // swap state. The effect is keyed on this counter rather than on the swap status
  // it is watching, so a status that moves every few seconds does not tear down and
  // restart the interval, and a retry after a refund restarts it deliberately.
  const [pollEpoch, setPollEpoch] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const quotePanelRef = useRef<HTMLDivElement>(null);

  const selected = sources.find((s) => s.assetId === assetId);

  // The countdown is the only reader of the clock, and it exists only while a
  // live quote with a deposit address is on screen. Keyed on the quote rather
  // than on `live`, so resuming a refunded payment (which now reads the record
  // once) does not tick a timer for a countdown that is not there.
  useEffect(() => {
    if (paid || !quote || quote.dry || !quote.depositAddress) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [paid, quote]);

  useEffect(() => {
    if (!live || paid) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }
    async function poll() {
      try {
        const res = await fetch("/api/status?invoiceId=" + encodeURIComponent(invoice.id));
        const data = (await res.json()) as StatusOut;
        setStatus(data);
        if (data.invoiceStatus === "PAID" || data.swapStatus === "REFUNDED" || data.swapStatus === "FAILED") {
          setInvoice((prev) => ({
            ...prev,
            status: data.invoiceStatus === "PAID" ? "PAID" : "UNPAID",
            paidAt: data.invoiceStatus === "PAID" ? new Date().toISOString() : prev.paidAt,
            swapStatus: data.swapStatus,
            payment: (data.payment as Invoice["payment"]) ?? prev.payment,
          }));
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        } else if (data.swapStatus) {
          setInvoice((prev) => ({ ...prev, swapStatus: data.swapStatus }));
        }
      } catch {
        // A poll that never reached the server is not a state change. The last
        // known status stays on screen and the retry line is added to it, rather
        // than the panel going blank and implying the payment restarted.
        setStatus((prev) =>
          prev
            ? { ...prev, error: "Status unavailable, retrying..." }
            : {
                invoiceStatus: "UNPAID",
                swapStatus: null,
                plain: "Status unavailable, retrying...",
              }
        );
      }
    }
    void poll();
    pollRef.current = setInterval(() => void poll(), POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [live, paid, invoice.id, pollEpoch]);

  async function requestQuote(dry: boolean) {
    setQuoteError(null);
    // A new quote is the payer moving on from whatever was released, so the notice
    // that says they can has done its job.
    setReleased(false);
    setQuoteBusy(dry ? "dry" : "live");
    setFailedMode(dry ? "dry" : "live");
    try {
      const res = await fetch("/api/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id, originAsset: assetId, dry, refundTo: refundTo.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 409 && data.paid) {
          setInvoice((prev) => ({ ...prev, status: "PAID" }));
          setQuoteError("This invoice is already paid.");
        } else if (res.status === 409 && (data.depositAddress || data.payment)) {
          // The server refused a second live payment and handed back the one
          // already open. Showing it is the whole answer; an error with a retry
          // button would only invite the same refusal until the swap ends, and the
          // payer's money would have nowhere to go.
          const open = openFromStored(data.payment) ?? openFromResponse(data);
          setAdopted(open);
          setQuote(null);
          setQuoteError(null);
          setLive(true);
          setPollEpoch((n) => n + 1);
          setQuoteBusy(null);
          return;
        } else if (res.status === 409) {
          // A payment is open but its address did not come back with the refusal.
          // Only a fresh server render can show it, so reload instead of offering
          // a retry that can only be refused again.
          window.location.reload();
          return;
        } else {
          setQuoteError(typeof data.error === "string" ? data.error : "The quote service did not respond. Nothing was charged.");
        }
        setQuote(null);
        setQuoteBusy(null);
        return;
      }
      setQuote(data as QuoteOut);
      if (!dry) {
        setLive(true);
        setPollEpoch((n) => n + 1);
        setStatus({ invoiceStatus: "UNPAID", swapStatus: "PENDING_DEPOSIT", plain: "Waiting for your deposit to arrive." });
      }
    } catch {
      setQuoteError("Network error. No payment was made.");
      setQuote(null);
    }
    setQuoteBusy(null);
  }

  async function copy(value: string, kind: "link" | "address") {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(value);
        setCopied(kind);
        setTimeout(() => setCopied(null), 2000);
      }
    } catch {
      /* clipboard unavailable, leave the value selectable on screen */
    }
  }

  /**
   * Release the payment this invoice has open, so a fresh quote can be made.
   *
   * The route does the deciding: it re-reads 1Click and refuses anything that has
   * money on it. What belongs here is leaving the page true afterwards, which means
   * dropping the address from this component's state as well as from the record,
   * and stopping the poll that would otherwise keep asking about an address the
   * invoice no longer has.
   */
  async function cancelPayment() {
    setCancelBusy(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/payment/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.paid) {
          setInvoice((prev) => ({ ...prev, status: "PAID" }));
        } else if (data.payment) {
          // Another payment won the race. Show that one: this page was about to
          // hide an address that belongs to a different deposit.
          setAdopted(openFromStored(data.payment));
          setQuote(null);
        }
        setCancelError(typeof data.error === "string" ? data.error : "The payment could not be cancelled.");
        // A refusal because the deposit has moved is a fact the status poll states
        // better than this message can, so let it read the record again.
        if (!data.paid && data.swapStatus && data.swapStatus !== "PENDING_DEPOSIT") {
          setLive(true);
          setPollEpoch((n) => n + 1);
        }
        setCancelBusy(false);
        return;
      }
      setInvoice((prev) => ({ ...prev, payment: null, swapStatus: null }));
      setQuote(null);
      setAdopted(null);
      setStatus(null);
      setLive(false);
      setCancelStep(null);
      setReleased(true);
    } catch {
      setCancelError("Network error. Nothing was cancelled.");
    }
    setCancelBusy(false);
  }

  const deadlineLeft = quote && !quote.dry && quote.depositAddress
    ? Math.max(0, Math.floor((new Date(quote.deadline).getTime() - now) / 1000))
    : null;

  const expiresLabel = useMemo(() => {
    if (deadlineLeft == null) return null;
    if (deadlineLeft <= 0) return "Quote expired";
    return Math.floor(deadlineLeft / 60) + "m " + String(deadlineLeft % 60).padStart(2, "0") + "s";
  }, [deadlineLeft]);

  const words = amountInWords(invoice.amount, invoice.currency);

  /* ---------------------------------- PAID --------------------------------- */

  if (paid) {
    const p = invoice.payment;
    const lineTotal = invoice.lineItems.reduce((sum, li) => sum + li.qty * li.price, 0);

    return (
      <div className="instrument">
        {/* The instrument is a printed document, so its heading is carried by the
            stamp rather than by display type. The heading element stays for
            screen readers and for the document outline. */}
        <h1 className="sr-only">Invoice {invoice.number}, PAID</h1>

        <div className="inst-head">
          <span>SETTLEFORM INSTRUMENT</span>
          <span className="inst-date">{invoice.number}</span>
        </div>

        <div className="inst-body">
          <div className="inst-row">
            <div>
              <p className="field-label">BILLED TO</p>
              <p className="mt-2 text-[18px] font-medium leading-6">{invoice.client}</p>
              <p className="mono mt-1 text-[12px] text-ink-soft">due {invoice.dueDate}</p>
            </div>
            <div className="inst-amount">
              <p className="field-label">AMOUNT</p>
              <p className="inst-fig">{invoice.amount}</p>
              <p className="inst-cur">{invoice.currency}</p>
            </div>
          </div>

          {words ? <p className="inst-words">{words}</p> : null}

          <p className="inst-memo">
            <b>MEMO</b> &nbsp; {invoice.number} &nbsp;/&nbsp; settled to {invoice.freelancerNear}
          </p>

          <div className="inst-micr">
            <span className="inst-mf"><Tick />INVOICE PAID</span>
            <span className="inst-mf">SWAP {p ? "SUCCESS" : "RECORD PENDING"}</span>
            <span className="inst-mf">REFUND NONE</span>
            <span className="inst-stamp" data-tone="settled">
              <s aria-hidden="true" />
              PAID
            </span>
          </div>
        </div>

        <div className="inst-body border-t border-rule">
          <h2 className="display text-[24px] sm:text-[28px]">Receipt</h2>
          <p className="measure mt-2 text-[14px] leading-6 text-ink-soft">
            {invoice.client} paid {invoice.amount} {invoice.currency}. Payment is disabled because
            this invoice is settled.
          </p>

          <dl className="mt-7 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <div className="border-b border-rule pb-3">
              <dt className="field-label">Settled amount</dt>
              <dd className="mono mt-1.5 text-[19px] leading-none">{p?.settledUsdc ?? invoice.amount} USDC</dd>
            </div>
            <div className="border-b border-rule pb-3">
              <dt className="field-label">Quoted expectation</dt>
              <dd className="mono mt-1.5 text-[19px] leading-none">{p?.expectedUsdc ?? invoice.amount} USDC</dd>
            </div>
            <div className="border-b border-rule pb-3">
              <dt className="field-label">Paid from</dt>
              <dd className="mono mt-1.5 text-[13.5px] leading-5">
                {p ? p.sourceSymbol + " on " + chainName(p.sourceChain) : "record pending"}
              </dd>
            </div>
            <div className="border-b border-rule pb-3">
              <dt className="field-label">Paid at</dt>
              <dd className="mono mt-1.5 text-[13.5px] leading-5">
                {invoice.paidAt ? new Date(invoice.paidAt).toLocaleString() : "recorded"}
              </dd>
            </div>
          </dl>

          <div className="mt-8">
            <p className="field-label">Invoice detail</p>
            <div className="mt-3 space-y-2 text-[13.5px]">
              {invoice.lineItems.map((li, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-rule pb-2">
                  <span className="text-ink-soft">{li.desc} x {li.qty}</span>
                  <span className="mono">{(li.qty * li.price).toFixed(2)} {invoice.currency}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 pt-1">
                <span className="font-medium">Total</span>
                <span className="mono font-medium">{lineTotal.toFixed(2)} {invoice.currency}</span>
              </div>
            </div>
          </div>

          {p?.txRefs && p.txRefs.length > 0 ? (
            <div className="mt-7">
              <p className="field-label">Transaction references</p>
              <ul className="mt-2 space-y-2">
                {p.txRefs.map((t) => (
                  <li key={t} className="mono break-all text-[12.5px] leading-6">
                    {proofRef(t)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="px-6 pb-6 sm:px-7">
          <div className="no-print flex flex-wrap gap-3">
            <a href={"/api/export/" + invoice.id} className="btn-primary" download>Download CSV</a>
            {/* The pay action is not removed, it is closed: the control stays on
                the document in its disabled state so the reader can see that
                paying again is impossible rather than merely hard to find. */}
            <button type="button" className="btn-ghost" disabled aria-disabled="true">
              This invoice is paid.
            </button>
            <button type="button" className="btn-ghost" onClick={() => window.print()}>Print receipt</button>
            <button type="button" className="btn-ghost" onClick={() => void copy(window.location.href, "link")}>
              {copied === "link" ? "Link copied" : "Copy link"}
            </button>
          </div>
          <p className="no-print measure mt-5 text-[12.5px] leading-6 text-ink-soft">
            No deposit address is exposed on a settled invoice, so there is nothing here to pay
            into twice.
          </p>
        </div>

        <div className="inst-foot">
          <span>Settled in USDC on NEAR.</span>
          <span className="mono">{invoice.freelancerNear}</span>
        </div>
      </div>
    );
  }

  /* --------------------------------- UNPAID -------------------------------- */

  const busy = quoteBusy !== null;
  const stage = stageIndex(status?.swapStatus ?? invoice.swapStatus);
  const refunded = (status?.swapStatus ?? invoice.swapStatus) === "REFUNDED";
  const invoiceState = "UNPAID";
  const swapState = status?.swapStatus ?? invoice.swapStatus ?? "NOT STARTED";
  const refundState = refunded ? "REFUNDED" : "NONE";
  const swapEnded = swapState === "REFUNDED" || swapState === "FAILED";
  const refundReason = status?.refundReason ?? invoice.payment?.refundReason ?? "";
  // With no quote on screen the status panel below does not exist, so an invoice
  // whose swap already ended would say only "SWAP REFUNDED" in a field and leave
  // the reader to guess. The notice is the same fact stated in words, and it is
  // only shown when the quote panel is not already carrying it.
  const showEndedNotice = !quote && swapEnded;

  // The one payment this invoice may have open at a time, in order of freshness:
  // the quote just requested, the record the server handed back after refusing a
  // second one, then the payment stored on the invoice this page was rendered
  // from. One object decides both what the reader is shown and whether they may
  // start another, so the two cannot disagree.
  const liveQuote = openFromQuote(quote);
  const openPayment = liveQuote ?? adopted ?? openFromStored(invoice.payment);
  const openExpired = hasExpired(openPayment, swapState === "NOT STARTED" ? null : swapState, now);
  // A refunded or failed swap leaves its address on the record, and an expired
  // quote is no longer payable through: neither is an open payment, and neither
  // may hold the control shut. The payer can legitimately ask for a new quote.
  const paymentOpen = !!openPayment && !openExpired && !swapEnded;
  const showOpenPayment = !!openPayment && !liveQuote && !swapEnded;
  // The client mirror of the server's rule: from the first seen deposit onwards the
  // money is in flight and is not the payer's to release. The button is not offered
  // for a state that would only answer with a refusal.
  const canCancel = releasable(swapState === "NOT STARTED" ? null : swapState);

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
      <h1 className="sr-only">
        Invoice {invoice.number} for {invoice.client}, {invoiceState}, {invoice.amount} {invoice.currency}
      </h1>

      {/* The instrument as the client receives it. */}
      <div className="instrument">
        <div className="inst-head">
          <span>SETTLEFORM INSTRUMENT</span>
          <span className="inst-date">{invoice.number}</span>
        </div>

        <div className="inst-body">
          <div className="inst-row">
            <div>
              <p className="field-label">BILLED TO</p>
              <p className="mt-2 text-[18px] font-medium leading-6">{invoice.client}</p>
              <p className="mono mt-1 text-[12px] text-ink-soft">due {invoice.dueDate}</p>
            </div>
            <div className="inst-amount">
              <p className="field-label">AMOUNT</p>
              <p className="inst-fig">{invoice.amount}</p>
              <p className="inst-cur">{invoice.currency}</p>
            </div>
          </div>

          {words ? <p className="inst-words">{words}</p> : null}

          <p className="inst-memo">
            <b>MEMO</b> &nbsp; {invoice.number} &nbsp;/&nbsp; {invoice.client}
          </p>

          <div className="space-y-2 border-t border-rule pt-4 text-[13.5px]">
            {invoice.lineItems.map((li, i) => (
              <div key={i} className="flex justify-between gap-3">
                <span className="text-ink-soft">{li.desc} x {li.qty}</span>
                <span className="mono">{(li.qty * li.price).toFixed(2)}</span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[12.5px] leading-6 text-ink-soft">
            Settles to <span className="mono break-all">{invoice.freelancerNear}</span> in USDC on NEAR.
          </p>

          <div className="inst-micr">
            <span className="inst-mf"><Tick />INVOICE {invoiceState}</span>
            <span className="inst-mf">SWAP {swapState}</span>
            <span className="inst-mf">REFUND {refundState}</span>
            <span className="inst-stamp">
              <s aria-hidden="true" />
              {invoiceState}
            </span>
          </div>
        </div>

        <div className="border-t border-rule px-6 py-5">
          <button type="button" onClick={() => void copy(window.location.href, "link")} className="btn-ghost w-full">
            {copied === "link" ? "Link copied" : "Copy pay link"}
          </button>
        </div>

        <div className="inst-foot">
          <span>
            {refunded
              ? "Swap refunded to sender. This invoice is still unpaid."
              : "Nothing here has moved any funds."}
          </span>
          <span className="mono">USDC / NEAR</span>
        </div>
      </div>

      {/* The routing slip. A second document, inset in band stock, where the
          client acts. The perforation sits between the two. */}
      <div className="routing-slip perf-edge">
        <div className="inst-head">
          <span>SETTLEFORM ROUTING SLIP</span>
          <span className="inst-date">{sources.length} ROUTES</span>
        </div>

        <div className="p-6 sm:p-7">
          <h2 className="display text-[22px]">Choose a source</h2>
          <p className="mt-2 text-[13.5px] leading-6 text-ink-soft">
            Choose a supported asset. A dry-run quote previews the route and moves nothing.
          </p>

          {showOpenPayment ? (
            <div className="mt-5 border border-rule-strong bg-field p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="field-label">{openExpired ? "Quote expired" : "Payment in progress"}</p>
                {openPayment.symbol && openPayment.chain ? (
                  <span className="mono text-[12px] text-ink-soft">
                    {openPayment.symbol} on {openPayment.chain}
                  </span>
                ) : null}
              </div>

              {openExpired ? (
                <p className="mt-2 text-[12.5px] leading-6 text-stamp-ink">
                  This deposit address stopped accepting the quote it was issued for. Nothing
                  arrived on it, so nothing was charged. Do not send to it; start a new live quote
                  for a fresh address.
                </p>
              ) : (
                <>
                  <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">
                    Send exactly this to the address below, from a wallet on {openPayment.chain ?? "the source chain"}.
                    Nothing settles until the deposit arrives, and the status follows it here.
                  </p>
                  {/* A NEAR source is a NEP-141 token, not the coin. Someone who sends
                      NEAR instead sees a swap that silently never starts, so the
                      difference is said here rather than left to be discovered. */}
                  {openPayment.chain === "near" ? (
                    <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">
                      {openPayment.symbol ?? "The source token"} is a token on NEAR, not the NEAR coin itself. Send it
                      as a token transfer from a wallet that holds it: a plain NEAR transfer to this address is a
                      different thing and is not swapped.
                    </p>
                  ) : null}
                  <p className="field-label mt-4">Send exactly</p>
                  <p className="mono mt-1 text-[15px] font-medium leading-6">
                    {openPayment.amountIn ?? "the quoted amount"}
                  </p>
                </>
              )}

              <p className="field-label mt-4">{openExpired ? "Expired deposit address" : "Deposit address"}</p>
              <p className={`mono mt-1 break-all text-[13px] leading-6 ${openExpired ? "text-ink-soft line-through" : ""}`}>
                {openPayment.address}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void copy(openPayment.address, "address")}
                  className="btn-ghost min-h-0 px-3 py-1.5 text-[12px]"
                >
                  {copied === "address" ? "Address copied" : "Copy address"}
                </button>
                {canCancel ? (
                  <CancelControl
                    expired={openExpired}
                    busy={cancelBusy}
                    confirming={cancelStep === "confirming"}
                    onAsk={() => { setCancelStep("confirming"); setCancelError(null); }}
                    onKeep={() => { setCancelStep(null); setCancelError(null); }}
                    onConfirm={() => void cancelPayment()}
                  />
                ) : null}
              </div>
              <CancelNote confirming={cancelStep === "confirming"} error={cancelError} />

              {!openExpired && openPayment.expectedUsdc ? (
                <>
                  <p className="field-label mt-4">Settles as</p>
                  <p className="mono mt-1 text-[13px] leading-6">
                    {openPayment.expectedUsdc} USDC on NEAR
                    {openPayment.fee ? " (1Click fee " + openPayment.fee + ")" : ""}
                  </p>
                </>
              ) : null}

              <p className="mono mt-4 text-[13px]">{swapState}</p>
              {status?.plain ? (
                <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{status.plain}</p>
              ) : null}
              {status?.error ? <p className="mt-1 text-[12.5px] text-stamp-ink">{status.error}</p> : null}
              {!liveQuote ? (
                <p className="mt-3 text-[12px] leading-5 text-ink-soft">
                  This receipt is read from the invoice record, so a reload keeps tracking the
                  same address rather than opening a second one.
                </p>
              ) : null}
            </div>
          ) : null}

          {released ? (
            <div role="status" className="mt-5 border border-rule-strong bg-field p-4">
              <p className="field-label">Payment cancelled</p>
              <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">
                This invoice is open again. A new live payment issues a fresh deposit address.
                Nothing sent to the old address is tracked here any more.
              </p>
            </div>
          ) : null}

          {showEndedNotice ? (
            <div className="mt-5 border border-stamp bg-field p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="field-label">Swap status</p>
                <span className="mono text-[12px] font-medium text-stamp-ink">{swapState}</span>
              </div>
              <p className="mt-2 text-[12.5px] leading-6 text-stamp-ink">
                {swapState === "REFUNDED"
                  ? "Swap refunded to sender, invoice still unpaid. A swap refund is not an invoice refund."
                  : "Swap failed, no payment made. The invoice stays unpaid. Request a new quote to retry."}
              </p>
              {refundReason ? (
                <p className="mt-2 text-[12.5px] leading-6 text-ink-soft">
                  Reason given by the route: <span className="mono">{refundReason}</span>
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6">
            <label className="field-label" htmlFor="asset">Pay with</label>
            <select
              id="asset"
              className="field mt-2"
              value={assetId}
              onChange={(e) => { setAssetId(e.target.value); setQuote(null); setQuoteError(null); }}
            >
              {sources.map((s) => (
                <option key={s.assetId} value={s.assetId}>{s.label}</option>
              ))}
            </select>
            {selected ? (
              <p className="helper">Refunds on this route return to a {selected.refundFormat}.</p>
            ) : null}
          </div>

          <div className="mt-4">
            <label className="field-label" htmlFor="refund">Refund address on {chainName(selected?.blockchain)}</label>
            <input
              id="refund"
              className="field mono mt-2"
              value={refundTo}
              onChange={(e) => setRefundTo(e.target.value)}
              placeholder={selected?.blockchain === "near" ? "you.near" : "0x..."}
              autoCapitalize="none"
              spellCheck={false}
              aria-describedby="refund-help"
            />
            <p id="refund-help" className="helper">Required for a live payment. Not needed for a dry-run quote.</p>
          </div>

          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void requestQuote(true)}>
              {quoteBusy === "dry" ? (<><span className="spinner" aria-hidden="true" /> Getting quote...</>) : "Get dry-run quote"}
            </button>
            {/* One live payment at a time is the server's rule, so the control
                says so rather than offering an action that will be refused. The
                dry run stays available throughout: it moves nothing. */}
            {paymentOpen ? (
              <button type="button" className="btn-ghost" disabled aria-disabled="true">
                A payment is in progress.
              </button>
            ) : (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => void requestQuote(false)}
              >
                {quoteBusy === "live" ? (<><span className="spinner" aria-hidden="true" /> Starting...</>) : "Start live payment"}
              </button>
            )}
          </div>
          <p className="helper">
            {paymentOpen
              ? "Finish the payment already open. A second live payment on one invoice is refused."
              : "A live payment opens a deposit address. Nothing is charged until you send funds."}
          </p>

          {quoteError ? (
            <div role="alert" className="notice mt-5">
              <p className="notice-title">Quote failed, no payment made.</p>
              <p className="mt-1 text-[13px] leading-6">{quoteError}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => void requestQuote(failedMode === "dry")}
                className="btn-ghost mt-3 min-h-0 bg-field px-3 py-1.5 text-[12px]"
              >
                {failedMode === "dry" ? "Retry dry-run quote" : "Retry live payment"}
              </button>
            </div>
          ) : null}

          {quote ? (
            <div
              ref={quotePanelRef}
              tabIndex={-1}
              className="quote-slip mt-6"
              aria-live="polite"
            >
              <div className={`flex flex-wrap items-baseline justify-between gap-2 border-b border-rule px-4 py-3 ${quote.dry ? "pantograph" : ""}`}>
                <p className="field-label">{quote.dry ? "DRY-RUN QUOTE" : "LIVE QUOTE"}</p>
                <span className="mono text-[11.5px] text-ink-soft">
                  {quote.sourceSymbol} on {quote.sourceChain}
                </span>
              </div>

              <div className={`px-4 py-4 ${quote.dry ? "pantograph" : ""}`}>
                {quote.dry ? (
                  <p className="border border-stamp px-3 py-2 text-[12.5px] font-medium leading-6 text-stamp-ink">
                    Dry-run quote, no funds moved. This is a preview, not a payment.
                  </p>
                ) : null}

                <dl className="mono mt-4 space-y-2.5 text-[13px] sm:text-[13.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">You pay, quoted</dt>
                    <dd className="break-all text-right">{quote.amountInFormatted} {quote.sourceSymbol}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">Freelancer receives</dt>
                    <dd className="text-right">{quote.amountOutFormatted} USDC</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-soft">1Click fee</dt>
                    <dd className="text-right">{quote.withdrawFee} USDC</dd>
                  </div>
                  {quote.refundFee && quote.refundFee !== "0" ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-soft">Refund fee if returned</dt>
                      <dd className="text-right">{quote.refundFee} {quote.sourceSymbol}</dd>
                    </div>
                  ) : null}
                  {quote.timeEstimate != null ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-ink-soft">Time estimate</dt>
                      <dd className="text-right">about {quote.timeEstimate}s</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="mt-3 text-[11.5px] leading-5 text-ink-soft">
                  1Click fee applied by the router at quote time. No funds move until a deposit is sent.
                </p>

                {!quote.dry && quote.depositAddress ? (
                  <div className="mt-4 border border-rule-strong p-3">
                    <p className="field-label">Deposit address</p>
                    <p className="mono mt-1 break-all text-[13px] leading-6">{quote.depositAddress}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => void copy(quote.depositAddress!, "address")}
                        className="btn-ghost min-h-0 px-3 py-1.5 text-[12px]"
                      >
                        {copied === "address" ? "Address copied" : "Copy address"}
                      </button>
                      {expiresLabel ? (
                        <span className={"mono text-[12px] " + (deadlineLeft === 0 ? "text-stamp-ink" : "text-ink-soft")}>
                          {deadlineLeft === 0 ? expiresLabel : "Expires in " + expiresLabel}
                        </span>
                      ) : null}
                      {canCancel ? (
                        <CancelControl
                          expired={deadlineLeft === 0}
                          busy={cancelBusy}
                          confirming={cancelStep === "confirming"}
                          onAsk={() => { setCancelStep("confirming"); setCancelError(null); }}
                          onKeep={() => { setCancelStep(null); setCancelError(null); }}
                          onConfirm={() => void cancelPayment()}
                        />
                      ) : null}
                    </div>
                    <CancelNote confirming={cancelStep === "confirming"} error={cancelError} />
                  </div>
                ) : null}

                {!quote.dry && !quote.depositAddress ? (
                  <p className="mt-3 text-[13px] leading-6 text-stamp-ink">
                    Live quote returned no deposit address. Treat this as failed and request a new quote.
                  </p>
                ) : null}

                {status ? (
                  <div className="mt-4 border-t border-rule pt-4">
                    <p className="field-label">Swap status</p>
                    <p className="mono mt-1 break-all text-[13.5px] font-medium">
                      {status.swapStatus ?? "starting"}
                    </p>
                    {status.plain ? <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">{status.plain}</p> : null}
                    {status.error ? <p className="mt-1 text-[12.5px] text-stamp-ink">{status.error}</p> : null}
                    {status.refundReason ? <p className="mt-1 text-[12.5px] text-stamp-ink">{status.refundReason}</p> : null}

                    {stage >= 0 ? (
                      <ol className="mt-4 grid grid-cols-3 gap-2" aria-label="Settlement progress">
                        {STAGES.map((s, i) => (
                          <li key={s.key}>
                            <span
                              className="block h-1 w-full"
                              style={{ background: i <= stage ? "var(--ink)" : "var(--rule)" }}
                              aria-hidden="true"
                            />
                            <span className={"mono mt-2 block text-[11px] " + (i <= stage ? "text-ink" : "text-ink-soft")}>
                              {s.label}
                            </span>
                          </li>
                        ))}
                      </ol>
                    ) : null}

                    {status.swapStatus === "REFUNDED" ? (
                      <p className="mt-4 border border-stamp px-3 py-2 text-[12.5px] leading-6 text-stamp-ink">
                        Swap refunded to sender, invoice still unpaid. A swap refund is not an invoice refund.
                      </p>
                    ) : null}
                    {status.swapStatus === "FAILED" ? (
                      <p className="mt-4 border border-stamp px-3 py-2 text-[12.5px] leading-6 text-stamp-ink">
                        Swap failed, no payment made. The invoice stays unpaid. Request a new quote to retry.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
