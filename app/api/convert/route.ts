import { NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/request-guard";
import { clientKey, createRateLimit } from "@/lib/rate-limit";
import { failure, json } from "@/lib/http";
import { formatBaseUnits, normalizeInvoiceAmount, toMicroUsdc } from "@/lib/amount";
import { nearAccountError } from "@/lib/near-account";
import { loadAssets, refundAddressError, requestQuote } from "@/lib/oneclick";

/**
 * Quotes spend the 1Click quota behind this demo and there is no auth in front of
 * it. Sized for a person trying the converter a few times, not for a script.
 */
const convertLimit = createRateLimit({ limit: 30, windowMs: 5 * 60 * 1000 });

/**
 * Convert a token into USDC delivered to a NEAR account.
 *
 * This is the invoice flow with the invoice taken out: no payee, no amount owed, no
 * record. What stays is the part that matters for money - the destination account
 * and the refund address are both checked here, server-side, and the destination is
 * what goes upstream as the recipient. Nothing the browser sends can redirect the
 * settled funds to an account the payer did not name, because the account they name
 * *is* their own: this surface converts, it does not bill anyone.
 *
 * Stateless on purpose. The swap lives at 1Click; the deposit address it issues is
 * the only handle needed, and it is unguessable, which is what makes the status
 * route safe to read it by.
 */
export async function POST(req: NextRequest) {
  if (!isSameOrigin(req.headers.get("origin"), req.headers.get("host"))) {
    return json({ error: "This endpoint only accepts requests from the app itself." }, { status: 403 });
  }

  const who = clientKey(req.headers);
  if (!convertLimit.take(who)) {
    return json(
      { error: "Too many quotes in a short time. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(convertLimit.retryAfter(who)) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;

  const destinationNear = typeof b.destinationNear === "string" ? b.destinationNear.trim() : "";
  const originAsset = typeof b.originAsset === "string" ? b.originAsset : "";
  const refundAddress = typeof b.refundAddress === "string" ? b.refundAddress.trim() : "";
  const rawAmount = typeof b.amount === "string" ? b.amount : "";

  // Settlement arrives on NEAR mainnet, so a testnet account is well-formed and
  // unpayable. Same rule as the invoice create route, same message.
  const nearProblem = nearAccountError(destinationNear);
  if (nearProblem) return json({ error: nearProblem }, { status: 400 });

  const amount = normalizeInvoiceAmount(rawAmount);
  if (!amount) return json({ error: "Amount must be greater than 0, with at most two decimals." }, { status: 400 });

  let micro: string;
  try {
    micro = toMicroUsdc(amount);
  } catch {
    return json({ error: "Amount must be greater than 0, with at most two decimals." }, { status: 400 });
  }

  try {
    const { sources, destinationAsset } = await loadAssets();
    const src = sources.find((s) => s.assetId === originAsset);
    if (!src) return json({ error: "Unsupported asset. Choose a listed source asset." }, { status: 400 });

    const refundProblem = refundAddressError(src.refundFormat, refundAddress);
    if (refundProblem) return json({ error: refundProblem }, { status: 400 });

    const result = await requestQuote({
      originAsset: src.assetId,
      destinationAsset: destinationAsset.assetId,
      destinationNear,
      refundAddress,
      microUsdc: micro,
    });
    if (!result.ok) return json({ error: result.error }, { status: result.status });

    const quote = result.quote;
    return json({
      quote: {
        ...quote,
        sourceSymbol: src.symbol,
        sourceChain: src.blockchain,
        destinationNear,
        destinationSymbol: destinationAsset.symbol,
        requestedUsdc: amount,
        // Both fees arrive as raw base units of their own asset. Converted here so the
        // page never prints a five-thousandth of a dollar as "5078".
        withdrawFee: formatBaseUnits(quote.withdrawFee, destinationAsset.decimals) ?? quote.withdrawFee,
        refundFee: formatBaseUnits(quote.refundFee, src.decimals) ?? quote.refundFee,
      },
    });
  } catch (err) {
    return failure(err, "convert");
  }
}
