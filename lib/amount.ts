/**
 * Amounts cross three boundaries: the invoice form, the JSON store, and the
 * 1Click API, which wants an integer count of micro-USDC.
 *
 * Floats are not trusted at any of them. `0.1 + 0.2` drift becomes a cent that
 * does not exist on an invoice, `2500 * 1e6` rounds in ways that differ between
 * inputs, and a rounded micro amount is a different swap from the one quoted.
 * Everything here is string and BigInt arithmetic, so the figure printed on the
 * instrument, the figure stored, and the figure sent upstream are the same
 * figure.
 *
 * The scale is capped at two decimals because the instrument prints an amount
 * twice, in figures and in words, and the words say "and NN/100": an invoice
 * with a third decimal would disagree with its own second statement.
 */

/** Nine digits of dollars, two of cents. Matches the words line's ceiling. */
const INVOICE_AMOUNT = /^\d{1,9}(\.\d{1,2})?$/;

/** Six decimals is the finest the destination asset can represent. */
const MICRO_SCALE = 6;

/**
 * Normalises a submitted amount to a two-decimal string, or null when it is not
 * a usable invoice amount. "250" becomes "250.00" so the instrument prints the
 * cents it is going to state in words, and "0250.5" becomes "250.50" rather
 * than being stored as the number 250.5 and losing its written form.
 */
export function normalizeInvoiceAmount(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!INVOICE_AMOUNT.test(raw)) return null;

  const [wholeRaw, fraction = ""] = raw.split(".");
  const whole = wholeRaw.replace(/^0+(?=\d)/, "");
  const cents = (fraction + "00").slice(0, 2);
  // Zero is not an invoice, and neither is a figure the words line cannot print.
  if (Number(whole) === 0 && Number(cents) === 0) return null;
  return whole + "." + cents;
}

/**
 * An integer count of an asset's smallest units back to a decimal string.
 *
 * This exists because of the fee fields. 1Click reports `withdrawFee` and
 * `refundFee` as raw base units, so a five-thousandth of a dollar arrives as
 * "5078". Printed at face value it reads as a whole number four orders of
 * magnitude larger than the money it describes, on the quote panel and in the
 * accountant CSV both. Returns null rather than guessing when the value is not
 * a clean integer, so a caller keeps whatever it had instead of printing a
 * figure it invented.
 */
export function formatBaseUnits(raw: unknown, decimals: number): string | null {
  const text = typeof raw === "number" ? String(raw) : typeof raw === "string" ? raw.trim() : "";
  if (!/^\d+$/.test(text) || !Number.isInteger(decimals) || decimals < 0) return null;
  const scale = BigInt(10) ** BigInt(decimals);
  const value = BigInt(text);
  const fraction = (value % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  const whole = (value / scale).toString();
  return fraction ? whole + "." + fraction : whole;
}

/**
 * A stored invoice figure converted to integer micro-USDC.
 *
 * Throws "bad-amount" rather than rounding, because a caller that cannot supply
 * a clean amount must not be handed a different number that happens to be close.
 */
export function toMicroUsdc(amountDecimal: string): string {
  const match = new RegExp(`^(\\d+)(?:\\.(\\d{1,${MICRO_SCALE}}))?$`).exec(amountDecimal.trim());
  if (!match) throw new Error("bad-amount");
  const fraction = (match[2] ?? "").padEnd(MICRO_SCALE, "0");
  const micro = BigInt(match[1]) * BigInt(1_000_000) + BigInt(fraction);
  if (micro <= BigInt(0)) throw new Error("bad-amount");
  return micro.toString();
}
