import { promises as fs } from "node:fs";
import * as path from "node:path";
import { NextRequest } from "next/server";
import { getInvoice, mutateInvoice } from "@/lib/invoices";
import { formatBaseUnits, toMicroUsdc } from "@/lib/amount";
import { isSameOrigin } from "@/lib/request-guard";
import { clientKey, createRateLimit } from "@/lib/rate-limit";
import { failure, json } from "@/lib/http";
import { holdsInvoice } from "@/lib/payment-window";
import { isNearAccount, isTestnetAccount } from "@/lib/near-account";

const ONECLICK = "https://1click.chaindefuser.com/v0/quote";

/** A quote is a live network call. Past this it is not a quote, it is a hang. */
const UPSTREAM_TIMEOUT_MS = 15000;

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

interface SourceAsset {
  assetId: string;
  blockchain: string;
  symbol: string;
  decimals: number;
  label: string;
  refundFormat: string;
}

interface AssetTable {
  sources: SourceAsset[];
  // The decimals are here for the fee fields: the router reports them as raw base
  // units of the destination asset, and this is what turns those back into dollars.
  destinationAsset: { assetId: string; symbol: string; decimals: number };
  demoRefundAddresses: Record<string, string>;
}

let assets: Promise<AssetTable> | null = null;

/**
 * Every call here spends 1Click quota that belongs to whoever runs the demo, and
 * there is no auth in front of it. Sixty quotes in five minutes covers a judge
 * opening several pay links in a row with room to spare.
 */
const quoteLimit = createRateLimit({ limit: 60, windowMs: 5 * 60 * 1000 });

function loadAssets(): Promise<AssetTable> {
  assets ??= fs
    .readFile(path.join(process.cwd(), "data", "supported-assets.json"), "utf8")
    .then((raw) => JSON.parse(raw) as AssetTable)
    .catch((err: unknown) => {
      assets = null; // let the next request try again rather than caching the failure
      throw err;
    });
  return assets;
}

/**
 * A refund address is where the money goes if the swap fails, so a typo does not
 * fail loudly later; it sends funds to an address nobody controls. The format
 * comes from the asset table, so the check follows the route rather than a guess.
 */
function refundError(format: string, value: string): string | null {
  if (!value) return "A refund address on the source chain is required for a live payment.";
  if (format === "0x address")
    return EVM_ADDRESS.test(value) ? null : "Refund address must be a 0x address, 40 hex characters.";
  if (format === "NEAR account") {
    if (!isNearAccount(value)) return "Refund address must be a NEAR account, for example you.near.";
    // The refund leg lands on NEAR mainnet. A testnet address is well-formed and
    // unpayable, which is the worst combination to accept.
    if (isTestnetAccount(value))
      return "Refunds arrive on NEAR mainnet, so a testnet refund address cannot receive them.";
    return null;
  }
  return null;
}

export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return json({ error: "This endpoint only accepts requests from the app itself." }, { status: 403 });
  }

  const who = clientKey(req.headers);
  if (!quoteLimit.take(who)) {
    return json(
      { error: "Too many quotes in a short time. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(quoteLimit.retryAfter(who)) } }
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
  const originAsset = typeof b.originAsset === "string" ? b.originAsset : "";
  const dry = b.dry !== false; // anything but an explicit false stays a dry run
  const refundTo = typeof b.refundTo === "string" ? b.refundTo.trim() : "";

  if (!invoiceId) return json({ error: "invoiceId is required." }, { status: 400 });

  try {
    const inv = await getInvoice(invoiceId);
    if (!inv) return json({ error: "Invoice not found." }, { status: 404 });
    if (inv.status === "PAID") return json({ error: "This invoice is paid.", paid: true }, { status: 409 });

    const { sources, destinationAsset: DEST, demoRefundAddresses: DEMO } = await loadAssets();
    const src = sources.find((s) => s.assetId === originAsset);
    if (!src) return json({ error: "Unsupported asset. Choose a listed source asset." }, { status: 400 });

    if (!dry && holdsInvoice(inv.payment, inv.swapStatus)) {
      return json(
        {
          error: "A payment is already in progress for this invoice.",
          depositAddress: inv.payment!.depositAddress,
          deadline: inv.payment!.deadline ?? null,
        },
        { status: 409 }
      );
    }

    let micro: string;
    try {
      micro = toMicroUsdc(inv.amount);
    } catch {
      return json({ error: "Invoice amount is invalid." }, { status: 400 });
    }

    const refund = dry ? DEMO[src.blockchain] ?? refundTo : refundTo;
    if (dry) {
      if (!refund) return json({ error: "No demo refund address is configured for this chain." }, { status: 400 });
    } else {
      const problem = refundError(src.refundFormat, refund);
      if (problem) return json({ error: problem }, { status: 400 });
      // An invoice written before the create route knew about testnet accounts can
      // still be sitting here. Its destination cannot receive a mainnet delivery,
      // so a live quote for it is refused instead of a swap that fails at the end.
      if (isTestnetAccount(inv.freelancerNear)) {
        return json(
          { error: "This invoice settles to a testnet account, which cannot receive a mainnet delivery." },
          { status: 400 }
        );
      }
    }

    const deadline = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const quoteReq = {
      dry,
      swapType: "EXACT_OUTPUT",
      slippageTolerance: 100,
      originAsset: src.assetId,
      depositType: "ORIGIN_CHAIN",
      destinationAsset: DEST.assetId,
      amount: micro,
      recipient: inv.freelancerNear,
      recipientType: "DESTINATION_CHAIN",
      refundTo: refund,
      refundType: "ORIGIN_CHAIN",
      deadline,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "Settleform/0.1 (NEAR-Hackathon; +https://nearhackathon.com)",
    };
    if (process.env.ONECLICK_JWT) headers.Authorization = "Bearer " + process.env.ONECLICK_JWT;

    /**
     * One attempt, no retry. A transport failure here is almost always a connect
     * that never completed, and asking again just spends the same wait twice
     * before telling the reader the same thing. A quote that cannot be fetched is
     * not a payment, and the page offers the retry itself.
     */
    let res: Response;
    try {
      res = await fetch(ONECLICK, {
        method: "POST",
        headers,
        body: JSON.stringify(quoteReq),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (err) {
      // The client gets one plain sentence; whoever runs this gets the reason.
      console.error("[quote] network failure:", err);
      return json({ error: "Quote failed, no payment made." }, { status: 502 });
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[quote] upstream " + res.status + ": " + detail.slice(0, 400));
      return json({ error: "Quote failed, no payment made." }, { status: 502 });
    }

    let data: { quote?: Record<string, unknown>; correlationId?: string };
    try {
      data = (await res.json()) as { quote?: Record<string, unknown>; correlationId?: string };
    } catch {
      return json({ error: "Quote failed, no payment made." }, { status: 502 });
    }
    const q = data.quote ?? {};
    const qString = (key: string, fallback = "") =>
      typeof q[key] === "string" || typeof q[key] === "number" ? String(q[key]) : fallback;

    // A dry run never surfaces a deposit address, whatever upstream returns for it:
    // a dry run that shows a real address is a payment the client thinks they can make.
    const depositAddress = dry ? null : qString("depositAddress") || null;

    const out = {
      dry,
      dryRun: dry,
      correlationId: data.correlationId ?? null,
      deadline: qString("deadline", deadline),
      originAsset: src.assetId,
      sourceSymbol: src.symbol,
      sourceChain: src.blockchain,
      amountIn: qString("amountIn"),
      amountInFormatted: qString("amountInFormatted"),
      amountOut: qString("amountOut", micro),
      amountOutFormatted: qString("amountOutFormatted", inv.amount),
      minAmountOut: qString("minAmountOut", micro),
      amountOutUsd: qString("amountOutUsd"),
      timeEstimate: q["timeEstimate"] ?? null,
      // Upstream reports both fees in the smallest unit of their own asset, so they
      // are converted here, once, for every reader of this response: the panel, the
      // receipt and the CSV. A withdraw fee arrives as "5078" and is five thousandths
      // of a dollar; shown raw it is a figure four orders of magnitude too large.
      withdrawFee: formatBaseUnits(qString("withdrawFee", "0"), DEST.decimals) ?? qString("withdrawFee", "0"),
      refundFee: formatBaseUnits(qString("refundFee", "0"), src.decimals) ?? qString("refundFee", "0"),
      depositAddress,
    };

    if (dry) return json(out);

    // A live quote without a deposit address would leave the invoice marked as in
    // flight with nowhere to send funds, so it is refused rather than stored.
    if (!depositAddress) {
      return json(
        { error: "The quote service did not issue a deposit address. No payment was made." },
        { status: 502 }
      );
    }

    /**
     * The in-flight check above ran before a call that can take seconds, so it is
     * repeated here against the record as it is now, inside the store lock. This is
     * the check that counts: it is the only one that cannot be raced by a second
     * live quote arriving at the same moment. Its failure throws out of the
     * mutation, so nothing is written and no state is half-changed.
     */
    try {
      const updated = await mutateInvoice(inv.id, (current) => {
        if (current.status === "PAID") throw new Paid();
        const held = current.payment?.depositAddress;
        if (held && held !== depositAddress && holdsInvoice(current.payment, current.swapStatus)) {
          throw new InFlight();
        }
        return {
          swapStatus: "PENDING_DEPOSIT",
          payment: {
            originAsset: src.assetId,
            sourceSymbol: src.symbol,
            sourceChain: src.blockchain,
            quotedRate: out.amountInFormatted + " " + src.symbol,
            expectedUsdc: out.amountOutFormatted,
            // Carries its unit: this is the value the CSV hands an accountant, and a
            // bare "0.005078" in a fee column is a number nobody can reconcile.
            fee: out.withdrawFee + " " + DEST.symbol,
            depositAddress,
            deadline: out.deadline,
          },
        };
      });
      if (!updated) return json({ error: "Invoice not found." }, { status: 404 });
      return json(out);
    } catch (err) {
      if (err instanceof Paid) return json({ error: "This invoice is paid.", paid: true }, { status: 409 });
      if (err instanceof InFlight) {
        // Hand back the address that won, for the same reason the cheaper check
        // above does: the payer's next move is to send funds to it, not to guess
        // which of two conflicts they are looking at.
        const fresh = await getInvoice(inv.id);
        return json(
          {
            error: "A payment is already in progress for this invoice.",
            depositAddress: fresh?.payment?.depositAddress ?? null,
            deadline: fresh?.payment?.deadline ?? null,
          },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err) {
    return failure(err, "quote");
  }
}

class InFlight extends Error {}
class Paid extends Error {}
