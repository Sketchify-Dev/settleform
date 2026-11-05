/**
 * Whether a stored live payment still holds an invoice.
 *
 * A quote is issued against a deadline, and past it the route will not settle a
 * deposit through that address. Treating such a payment as open wedges the
 * invoice forever: nobody ever sent funds, nothing is running, and every later
 * quote is refused because of a payment that can no longer happen. An expired
 * quote therefore stops holding the invoice, and the next quote replaces it.
 *
 * Funds already seen on the deposit always beat the clock, because a swap that
 * has moved past PENDING_DEPOSIT is real money in flight and must not be
 * replaced by a fresh address.
 *
 * A record written before deadlines were stored carries no deadline. It is
 * treated as still open rather than guessed at: the cost of guessing wrong in
 * that direction is a second address the payer could also pay into.
 */
export const IN_FLIGHT = ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "INCOMPLETE_DEPOSIT"];

/**
 * Whether a live payment may be released by hand, which is what the pay page's
 * cancel control does.
 *
 * Only a payment nobody has sent anything to is releasable. From KNOWN_DEPOSIT_TX
 * onwards the deposit holds the payer's money, and clearing the record would drop
 * the only pointer this app has to it: the address would no longer be polled, the
 * invoice would take a second live payment, and the payer would be paying twice
 * with no way to see the first one land. REFUNDED and FAILED are not releasable
 * either, because they are already over: they stop holding the invoice on their
 * own, so a new quote needs no permission from them.
 */
export function releasable(swapStatus: string | null): boolean {
  return swapStatus === null || swapStatus === "PENDING_DEPOSIT";
}

/**
 * What 1Click's answer for a deposit address says about the money.
 *
 * The stored status is a copy of what 1Click knew at the last poll, and a deposit
 * can arrive between polls, so the cancel route asks upstream before releasing
 * anything. Only PENDING_DEPOSIT means nothing has arrived; no answer at all means
 * nothing is known, which is not the same thing and is treated as seen.
 */
export function depositSeen(swapStatus: string | null | undefined): boolean {
  if (!swapStatus) return true;
  return swapStatus !== "PENDING_DEPOSIT";
}

export function holdsInvoice(
  payment: { depositAddress?: string; deadline?: string | null } | null | undefined,
  swapStatus: string | null,
  now: number = Date.now()
): boolean {
  if (!payment?.depositAddress) return false;
  if (swapStatus && !IN_FLIGHT.includes(swapStatus)) return false;
  // A deposit the route has already seen is money in flight, and the quote clock
  // has no say over it: replacing that address would be a second way to pay.
  if (swapStatus && swapStatus !== "PENDING_DEPOSIT") return true;
  if (!payment.deadline) return true;
  const at = Date.parse(payment.deadline);
  return Number.isNaN(at) ? true : now < at;
}
