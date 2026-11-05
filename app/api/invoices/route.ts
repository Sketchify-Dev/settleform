import { NextRequest } from "next/server";
import { createInvoice, type LineItem } from "@/lib/invoices";
import { normalizeInvoiceAmount } from "@/lib/amount";
import { isSameOrigin } from "@/lib/request-guard";
import { clientKey, createRateLimit } from "@/lib/rate-limit";
import { failure, json } from "@/lib/http";
import { nearAccountError } from "@/lib/near-account";

/** The three currencies the instrument can write out in words. */
const CURRENCIES = new Set(["USD", "EUR", "GBP"]);

const LIMITS = {
  client: 120,
  description: 160,
  lineItems: 50,
  /** The quote API takes micro-USDC; anything past this is not an invoice. */
  amount: 999_999_999.99,
  /** No invoice needs more than this on the wire, and nothing else gets read. */
  bodyBytes: 64 * 1024,
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Issuing an invoice is a person clicking a button, not a loop. */
const createLimit = createRateLimit({ limit: 30, windowMs: 60 * 1000 });

function isValidDate(value: string): boolean {
  if (!DATE.test(value)) return false;
  const date = new Date(value + "T00:00:00Z");
  // Catches 2026-02-31 and friends, which Date rolls forward into March.
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return json({ error: "This endpoint only accepts requests from the app itself." }, { status: 403 });
  }

  const who = clientKey(req.headers);
  if (!createLimit.take(who)) {
    return json(
      { error: "Too many invoices in a short time. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(createLimit.retryAfter(who)) } }
    );
  }

  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > LIMITS.bodyBytes) {
    return json({ error: "That invoice is too large. Keep it under a few lines." }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const client = typeof b.client === "string" ? b.client.trim() : "";
  const freelancerNear = typeof b.freelancerNear === "string" ? b.freelancerNear.trim() : "";
  const rawAmount = typeof b.amount === "number" ? String(b.amount) : typeof b.amount === "string" ? b.amount : "";
  const currency = typeof b.currency === "string" ? b.currency.trim().toUpperCase() : "USD";
  const dueDate = typeof b.dueDate === "string" ? b.dueDate.trim() : "";
  const rawItems = Array.isArray(b.lineItems) ? b.lineItems : [];

  if (!client) return json({ error: "Client name is required." }, { status: 400 });
  if (client.length > LIMITS.client)
    return json({ error: `Client name is limited to ${LIMITS.client} characters.` }, { status: 400 });
  // Settlement and refunds both run on NEAR mainnet, so a testnet account is not a
  // quirky but harmless input here: it is an invoice that cannot be paid or refunded.
  const nearProblem = nearAccountError(freelancerNear);
  if (nearProblem) return json({ error: nearProblem }, { status: 400 });

  // The figure is normalised as a decimal string, never as a float: the amount is
  // stored and printed exactly as it will be quoted, and the words line reads the
  // same two decimals the figures do.
  const amount = normalizeInvoiceAmount(rawAmount);
  if (!amount) return json({ error: "Amount must be greater than 0, with at most two decimals." }, { status: 400 });
  if (Number(amount) > LIMITS.amount)
    return json({ error: "Amount is larger than this invoice format can carry." }, { status: 400 });

  if (!CURRENCIES.has(currency))
    return json({ error: "Currency must be USD, EUR or GBP." }, { status: 400 });

  if (!isValidDate(dueDate)) return json({ error: "Due date must be a real date, as YYYY-MM-DD." }, { status: 400 });
  if (rawItems.length > LIMITS.lineItems)
    return json({ error: `Invoices carry at most ${LIMITS.lineItems} line items.` }, { status: 400 });

  const lineItems: LineItem[] = rawItems
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const o = item as Record<string, unknown>;
      const qty = Number(o.qty);
      const price = Number(o.price);
      return {
        desc: (String(o.desc ?? "").trim() || "Service").slice(0, LIMITS.description),
        qty: Number.isFinite(qty) && qty > 0 ? Math.min(qty, 100_000) : 1,
        price: Number.isFinite(price) && price >= 0 ? Math.min(price, LIMITS.amount) : 0,
      };
    });
  if (lineItems.length === 0) lineItems.push({ desc: "Service", qty: 1, price: Number(amount) });

  try {
    const invoice = await createInvoice({ client, freelancerNear, amount, currency, dueDate, lineItems });
    return json({ invoice }, { status: 201 });
  } catch (err) {
    return failure(err, "invoices:create");
  }
}
