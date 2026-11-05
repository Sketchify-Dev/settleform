import { NextRequest } from "next/server";
import { getInvoice, mutateInvoice } from "@/lib/invoices";
import { isSameOrigin } from "@/lib/request-guard";
import { clientKey, createRateLimit } from "@/lib/rate-limit";
import { failure, json } from "@/lib/http";
import { depositSeen, releasable } from "@/lib/payment-window";

const ONECLICK_STATUS = "https://1click.chaindefuser.com/v0/status";

/** Releasing a payment waits on one upstream read. Past this it is a hang. */
const UPSTREAM_TIMEOUT_MS = 8000;

/** How many released payments one invoice keeps. Enough to show what was abandoned. */
const KEPT = 5;

/**
 * Releasing a payment spends one 1Click status call, and there is no auth in front
 * of this route. A payer cancels one address a few times at most; a script sees a
 * wall.
 */
const cancelLimit = createRateLimit({ limit: 30, windowMs: 5 * 60 * 1000 });

const CANNOT_RELEASE =
  "Funds have been seen on this deposit, so it cannot be cancelled. Watch its status instead: the money is already moving to the invoice.";

/**
 * Release the live payment an invoice has open.
 *
 * A live quote holds its invoice: while it is open, a second live quote is refused,
 * because two deposit addresses are two ways to pay the same invoice. That is the
 * right rule for a payer who is about to send funds and the wrong one for a payer
 * who never will, which is the common case after someone opens a live quote to see
 * what it does and then closes the tab. Without this route such an invoice is stuck
 * until the quote dies of old age, first at 1Click's deadline and, on records
 * written before deadlines were stored, never.
 *
 * Cancelling here cannot recall the deposit address: 1Click issued it and only it
 * can stop accepting funds. So this releases the invoice, keeps the address on the
 * record for the audit, and refuses to release anything that has money on it.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return json({ error: "This endpoint only accepts requests from the app itself." }, { status: 403 });
  }

  const who = clientKey(req.headers);
  if (!cancelLimit.take(who)) {
    return json(
      { error: "Too many cancellations in a short time. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(cancelLimit.retryAfter(who)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const invoiceId = typeof b.invoiceId === "string" ? b.invoiceId : "";
  if (!invoiceId) return json({ error: "invoiceId is required." }, { status: 400 });

  try {
    const inv = await getInvoice(invoiceId);
    if (!inv) return json({ error: "Invoice not found." }, { status: 404 });
    if (inv.status === "PAID") return json({ error: "This invoice is paid.", paid: true }, { status: 409 });

    const deposit = inv.payment?.depositAddress ?? null;
    if (!deposit) {
      // Nothing open. The caller's intent is already true, so this answers like the
      // success it asked for rather than with an error that invites a retry.
      return json({ invoiceStatus: inv.status, swapStatus: inv.swapStatus, cancelled: false, payment: null });
    }

    if (!releasable(inv.swapStatus)) {
      return json({ error: CANNOT_RELEASE, swapStatus: inv.swapStatus }, { status: 409 });
    }

    /**
     * The stored status says nothing has arrived, but it is a copy of what 1Click
     * knew at the last poll, and a deposit can land between two polls. Ask before
     * releasing: an answer of anything but PENDING_DEPOSIT means money is on the
     * address, and dropping the record then would stop the invoice from ever
     * learning that it was paid.
     *
     * No answer at all is not an answer of "nothing". Without confirmation this
     * refuses, because the failure it prevents is a payment nobody can trace.
     */
    let upstream: string | null = null;
    try {
      const headers: Record<string, string> = {
        Accept: "application/json",
        "User-Agent": "Settleform/0.1 (NEAR-Hackathon; +https://nearhackathon.com)",
      };
      if (process.env.ONECLICK_JWT) headers.Authorization = "Bearer " + process.env.ONECLICK_JWT;
      const res = await fetch(ONECLICK_STATUS + "?depositAddress=" + encodeURIComponent(deposit), {
        headers,
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (res.ok) {
        const status = (await res.json()) as { status?: unknown };
        upstream = typeof status.status === "string" ? status.status : null;
      }
    } catch {
      upstream = null;
    }

    if (upstream === null) {
      return json(
        {
          error:
            "The swap service could not confirm that nothing has been deposited yet, so nothing was cancelled. Try again in a moment.",
        },
        { status: 503 }
      );
    }
    if (depositSeen(upstream)) {
      return json({ error: CANNOT_RELEASE, swapStatus: upstream }, { status: 409 });
    }

    /**
     * The checks above ran against a snapshot taken before an upstream call that can
     * take seconds. This one runs inside the store lock, on the record as it is now:
     * it is the only one a second live quote, or a poll that just saw a deposit,
     * cannot race.
     */
    try {
      const updated = await mutateInvoice(inv.id, (current) => {
        if (current.status === "PAID") throw new Paid();
        if (current.payment?.depositAddress !== deposit) throw new Replaced();
        if (!releasable(current.swapStatus)) throw new FundsSeen();
        const released = current.payment;
        const cancelled = [
          ...(current.cancelledPayments ?? []),
          { ...released, cancelledAt: new Date().toISOString() },
        ].slice(-KEPT);
        return { swapStatus: null, payment: null, cancelledPayments: cancelled };
      });
      if (!updated) return json({ error: "Invoice not found." }, { status: 404 });
      return json({ invoiceStatus: updated.status, swapStatus: null, cancelled: true, depositAddress: deposit });
    } catch (err) {
      if (err instanceof Paid) return json({ error: "This invoice is paid.", paid: true }, { status: 409 });
      if (err instanceof FundsSeen) {
        const fresh = await getInvoice(inv.id);
        return json({ error: CANNOT_RELEASE, swapStatus: fresh?.swapStatus ?? null }, { status: 409 });
      }
      if (err instanceof Replaced) {
        // Another payment opened while this one was being released. Hand back the
        // record that won so the page shows it instead of retrying into the same
        // refusal.
        const fresh = await getInvoice(inv.id);
        return json(
          {
            error: "A different payment was opened for this invoice a moment ago. Cancel that one instead.",
            payment: fresh?.payment ?? null,
            swapStatus: fresh?.swapStatus ?? null,
          },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err) {
    return failure(err, "cancel");
  }
}

class Paid extends Error {}
class FundsSeen extends Error {}
class Replaced extends Error {}
