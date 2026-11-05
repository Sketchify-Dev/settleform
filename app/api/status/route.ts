import { NextRequest } from "next/server";
import { getInvoice, mutateInvoice } from "@/lib/invoices";
import { failure, json } from "@/lib/http";

const ONECLICK_STATUS = "https://1click.chaindefuser.com/v0/status";

/** The pay page polls this route; a hung upstream must not hold the poll open. */
const UPSTREAM_TIMEOUT_MS = 8000;

/** Swap states that will not move again for this deposit. */
const TERMINAL_SWAP = new Set(["REFUNDED", "FAILED"]);

const PLAIN: Record<string, string> = {
  PENDING_DEPOSIT: "Waiting for your deposit to arrive.",
  KNOWN_DEPOSIT_TX: "Deposit seen, waiting for confirmations.",
  PROCESSING: "Swap is executing.",
  SUCCESS: "Settled.",
  INCOMPLETE_DEPOSIT: "Deposit below the required amount.",
  REFUNDED: "Swap refunded to sender, invoice still unpaid.",
  FAILED: "Swap failed, no payment made.",
};

interface StatusUpstream {
  status?: string;
  swapDetails?: {
    amountOutFormatted?: string;
    amountOut?: string;
    originChainTxHashes?: Array<{ hash?: string; explorerUrl?: string; url?: string } | string>;
    destinationChainTxHashes?: Array<{ hash?: string; explorerUrl?: string; url?: string } | string>;
    refundReason?: string;
  };
}

/**
 * Upstream transaction references in a stable order: deposit first, withdrawal
 * second. The invoice receipt reuses `txLinks` from the converter's 1Click layer,
 * so the bare-hash linking lives in one place.
 */
export function txLinks(list: unknown): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const t of list) {
    if (typeof t === "string") out.push(t);
    else if (t && typeof t === "object") {
      const o = t as Record<string, unknown>;
      if (typeof o.explorerUrl === "string") out.push(o.explorerUrl);
      else if (typeof o.url === "string") out.push(o.url);
      else if (typeof o.hash === "string") out.push(o.hash);
      else if (typeof o.txHash === "string") out.push(o.txHash);
      else if (typeof o.transactionHash === "string") out.push(o.transactionHash);
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("invoiceId") ?? "";
  if (!id) return json({ error: "invoiceId is required." }, { status: 400 });

  try {
    const inv = await getInvoice(id);
    if (!inv) return json({ error: "Invoice not found." }, { status: 404 });

    // A paid invoice is immutable and terminal. Serve the stored settlement record
    // without re-exposing the deposit address or calling upstream again.
    if (inv.status === "PAID") {
      const payment = inv.payment ? { ...inv.payment } : null;
      if (payment) delete payment.depositAddress;
      const settled = inv.swapStatus === "SUCCESS" ? "SUCCESS" : inv.swapStatus;
      return json({
        invoiceStatus: "PAID",
        swapStatus: settled,
        plain: (settled && PLAIN[settled]) ?? PLAIN.SUCCESS,
        paid: true,
        payment,
      });
    }

    const deposit = inv.payment?.depositAddress ?? null;
    if (!deposit) {
      return json({
        invoiceStatus: inv.status,
        swapStatus: inv.swapStatus,
        plain: inv.swapStatus ? (PLAIN[inv.swapStatus] ?? inv.swapStatus) : null,
        dryRun: true,
        // A released payment has no address to follow any more, and saying "no live
        // payment started" would be a small lie about an invoice the payer acted on.
        note: inv.cancelledPayments?.length
          ? "The payment opened on this invoice was cancelled. Nothing was sent to it."
          : "No live payment started. Dry-run quotes move no funds.",
        payment: inv.payment,
      });
    }

    // The swap is over. Polling upstream again cannot change the record, and the
    // invoice stays UNPAID until the freelancer starts a new payment, which sets a
    // fresh deposit address and a fresh PENDING_DEPOSIT.
    if (inv.swapStatus && TERMINAL_SWAP.has(inv.swapStatus)) {
      return json({
        invoiceStatus: inv.status,
        swapStatus: inv.swapStatus,
        plain: PLAIN[inv.swapStatus] ?? inv.swapStatus,
        ...(inv.swapStatus === "REFUNDED" ? { refundReason: inv.payment?.refundReason } : {}),
        payment: inv.payment,
      });
    }

    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "Settleform/0.1 (NEAR-Hackathon; +https://nearhackathon.com)",
    };
    if (process.env.ONECLICK_JWT) headers.Authorization = "Bearer " + process.env.ONECLICK_JWT;

    const stored = {
      invoiceStatus: inv.status,
      swapStatus: inv.swapStatus,
      plain: inv.swapStatus ? (PLAIN[inv.swapStatus] ?? inv.swapStatus) : null,
    };

    let upstream: StatusUpstream;
    try {
      const res = await fetch(ONECLICK_STATUS + "?depositAddress=" + encodeURIComponent(deposit), {
        headers,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!res.ok) {
        return json({ ...stored, error: "Status unavailable, retrying...", payment: inv.payment });
      }
      upstream = (await res.json()) as StatusUpstream;
    } catch {
      return json({ ...stored, error: "Status unavailable, retrying...", payment: inv.payment });
    }

    const s = typeof upstream.status === "string" ? upstream.status : inv.swapStatus ?? "PROCESSING";
    const details = upstream.swapDetails ?? {};
    const refs = [...txLinks(details.originChainTxHashes), ...txLinks(details.destinationChainTxHashes)];

    if (s === "SUCCESS") {
      const settled =
        typeof details.amountOutFormatted === "string"
          ? details.amountOutFormatted
          : inv.payment?.expectedUsdc ?? inv.amount;
      const now = new Date().toISOString();
      // Merged against the record as it is now, inside the store lock: the read
      // above happened before a network call, and the payment object may have been
      // rewritten in between by another poll.
      const updated = await mutateInvoice(inv.id, (current) => ({
        status: "PAID",
        paidAt: current.paidAt ?? now,
        swapStatus: "SUCCESS",
        payment: current.payment
          ? { ...current.payment, settledUsdc: settled, txRefs: refs, paidAt: current.paidAt ?? now }
          : current.payment,
      }));
      const payment = updated?.payment ?? inv.payment;
      return json({
        invoiceStatus: "PAID",
        swapStatus: "SUCCESS",
        plain: PLAIN.SUCCESS,
        payment: payment ? { ...payment, depositAddress: undefined } : payment,
      });
    }

    if (s === "REFUNDED") {
      const reason = typeof details.refundReason === "string" ? details.refundReason : "Swap failed, funds returned.";
      const updated = await mutateInvoice(inv.id, (current) => ({
        // The invoice stays UNPAID: a refund is the swap failing, not the money arriving.
        status: "UNPAID",
        swapStatus: "REFUNDED",
        payment: current.payment
          ? { ...current.payment, refundReason: reason, txRefs: refs }
          : current.payment,
      }));
      return json({
        invoiceStatus: "UNPAID",
        swapStatus: "REFUNDED",
        plain: PLAIN.REFUNDED,
        refundReason: reason,
        payment: updated?.payment ?? inv.payment,
      });
    }

    if (s === "FAILED") {
      const updated = await mutateInvoice(inv.id, () => ({
        status: "UNPAID",
        swapStatus: "FAILED",
      }));
      return json({
        invoiceStatus: "UNPAID",
        swapStatus: "FAILED",
        plain: PLAIN.FAILED,
        payment: updated?.payment ?? inv.payment,
      });
    }

    const updated = await mutateInvoice(inv.id, (current) =>
      current.swapStatus === s ? null : { swapStatus: s }
    );
    return json({
      invoiceStatus: inv.status,
      swapStatus: s,
      plain: PLAIN[s] ?? s,
      payment: updated?.payment ?? inv.payment,
    });
  } catch (err) {
    return failure(err, "status");
  }
}
