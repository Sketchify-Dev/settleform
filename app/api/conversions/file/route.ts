import { NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/request-guard";
import { clientKey, createRateLimit } from "@/lib/rate-limit";
import { failure, json } from "@/lib/http";
import { formatBaseUnits } from "@/lib/amount";
import { nearAccountError } from "@/lib/near-account";
import { fetchStatus, isDepositAddress, type Quote } from "@/lib/oneclick";
import { recordConversion, type StoredConversion } from "@/lib/conversions";

/**
 * Filing a record reads 1Click live and writes one row. Sized for a person
 * filing their own finished swap, not for a script enumerating addresses.
 */
const fileLimit = createRateLimit({ limit: 30, windowMs: 5 * 60 * 1000 });

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/** The chain a deposit leg belongs to, read off the scanner it points at. */
function chainFromLegs(legs: { links: string[] }[]): string {
  const blob = (legs[0]?.links ?? []).join(" ");
  if (/basescan\.org/.test(blob)) return "base";
  if (/etherscan\.io/.test(blob)) return "eth";
  if (/nearblocks\.io/.test(blob)) return "near";
  return "";
}

/**
 * File a finished conversion into the public history.
 *
 * The deposit address is the whole handle: it is read live from 1Click, and
 * only what the route publishes goes on the record. An address whose swap is
 * still running is refused - it belongs to the live view, not to history.
 * Anything the quote knew but the status does not (amount in, fee, source
 * symbol) arrives in the optional `quote` field and is used only to fill those
 * blanks; the settled figures always come from the live read.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return json({ error: "This endpoint only accepts requests from the app itself." }, { status: 403 });
  }

  const who = clientKey(req.headers);
  if (!fileLimit.take(who)) {
    return json(
      { error: "Too many filings in a short time. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(fileLimit.retryAfter(who)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const depositAddress = typeof b.depositAddress === "string" ? b.depositAddress.trim() : "";
  // The recipient comes from the filer, not from 1Click: the status read does
  // not echo the recipient, so there is nothing to cross-check it against. The
  // self-filing client sends the account from its own quote, and the deposit
  // address is unguessable, which bounds the mischief to mislabeling a row.
  const destinationNear = typeof b.destinationNear === "string" ? b.destinationNear.trim() : "";
  if (!depositAddress || !isDepositAddress(depositAddress)) {
    return json({ error: "That is not a deposit address this service issued." }, { status: 400 });
  }

  const nearProblem = nearAccountError(destinationNear);
  if (nearProblem) return json({ error: nearProblem }, { status: 400 });

  const q = (b.quote && typeof b.quote === "object" ? b.quote : {}) as Partial<Quote>;

  try {
    const live = await fetchStatus(depositAddress);
    if (!live) {
      return json({ error: "That swap could not be read right now. Try again in a moment." }, { status: 503 });
    }
    if (!live.terminal) {
      return json(
        { error: "That swap is still " + live.status + ". History keeps finished swaps." },
        { status: 409 }
      );
    }

    const evm = EVM_ADDRESS.test(depositAddress);
    const record: StoredConversion = {
      depositAddress,
      sourceSymbol: typeof q.sourceSymbol === "string" ? q.sourceSymbol : "",
      sourceChain: chainFromLegs(live.legs) || (evm ? "eth" : ""),
      amountInFormatted: typeof q.amountInFormatted === "string" ? q.amountInFormatted : "",
      amountOutFormatted: live.settledUsdc ?? (typeof q.amountOutFormatted === "string" ? q.amountOutFormatted : ""),
      settledUsdc: live.settledUsdc,
      withdrawFee: formatBaseUnits(q.withdrawFee, 6) ?? "",
      refundFee: "",
      destinationNear,
      destinationSymbol: "USDC",
      status: live.status,
      plain: live.plain,
      // The swap's own end time when the route says so; filing time only when
      // it does not. A receipt dated by the route settles when it settled.
      finishedAt: live.updatedAt ?? new Date().toISOString(),
      txRefs: live.txRefs,
      legs: live.legs,
      refundReason: live.refundReason,
      recordedAt: new Date().toISOString(),
    };

    const conversions = await recordConversion(record);
    return json({ conversions, filed: depositAddress });
  } catch (err) {
    return failure(err, "conversions:file");
  }
}
