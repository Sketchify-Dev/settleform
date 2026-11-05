import { NextRequest } from "next/server";
import { clientKey, createRateLimit } from "@/lib/rate-limit";
import { failure, json } from "@/lib/http";
import { fetchStatus, isDepositAddress, loadAssets } from "@/lib/oneclick";

/**
 * The converter polls every five seconds for as long as a swap runs, which is
 * minutes, not seconds. This is sized to let a few people watch their own payment
 * finish and to stop one caller turning the route into a free status proxy.
 */
const statusLimit = createRateLimit({ limit: 240, windowMs: 5 * 60 * 1000 });

/**
 * The swap behind a deposit address.
 *
 * A conversion has no record on this server, so the deposit address is the whole
 * handle: 1Click issued it, it is unguessable, and knowing it is proof enough that
 * the caller was the payer. That is the same capability-URL property the pay links
 * rely on, and it is why this route can be read without auth while still revealing
 * nothing about anyone else's swap.
 *
 * The address shape is checked before any upstream call, so this cannot be used to
 * make 1Click answer for arbitrary paths or to spend the quota on malformed input.
 */
export async function GET(req: NextRequest) {
  const who = clientKey(req.headers);
  if (!statusLimit.take(who)) {
    return json(
      { error: "Too many status checks in a short time. Wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(statusLimit.retryAfter(who)) } }
    );
  }

  const depositAddress = req.nextUrl.searchParams.get("depositAddress") ?? "";
  if (!depositAddress) return json({ error: "depositAddress is required." }, { status: 400 });
  if (!isDepositAddress(depositAddress))
    return json({ error: "That is not a deposit address this service issued." }, { status: 400 });

  // The page reuses this route after a reload, where it knows the source chain it
  // paid from. Carrying it as a parameter lets the route label and link each proof
  // leg against the right scanner, instead of guessing from the address shape.
  const sourceChain = req.nextUrl.searchParams.get("sourceChain") ?? "";

  try {
    let source: string | undefined;
    try {
      const { sources } = await loadAssets();
      if (sourceChain && sources.some((s) => s.blockchain === sourceChain)) source = sourceChain;
    } catch {
      // No asset table, no chain labels: the hashes are still returned as text.
    }
    const status = await fetchStatus(depositAddress, source ? { source } : undefined);
    if (!status) {
      // Nothing is known, which is not the same as "nothing happened". The page
      // keeps the last status it had and asks again.
      return json({ error: "Status unavailable, retrying..." }, { status: 503 });
    }
    return json(status);
  } catch (err) {
    return failure(err, "convert:status");
  }
}
