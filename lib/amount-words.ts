/**
 * The second statement of the amount.
 *
 * A cheque writes the amount twice, in figures and in words, because a single
 * statement of a number is not trusted: a missing zero is invisible in figures
 * and obvious in words. The invoice form prints both for the same reason.
 */

const ONES = [
  "ZERO", "ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE",
  "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN",
  "SEVENTEEN", "EIGHTEEN", "NINETEEN",
];

const TENS = [
  "", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY",
];

function under100(n: number): string {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const r = n % 10;
  return r === 0 ? TENS[t] : TENS[t] + "-" + ONES[r];
}

function under1000(n: number): string {
  if (n < 100) return under100(n);
  const h = Math.floor(n / 100);
  const r = n % 100;
  return r === 0 ? ONES[h] + " HUNDRED" : ONES[h] + " HUNDRED AND " + under100(r);
}

function wholeInWords(n: number): string {
  const parts: string[] = [];
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  if (millions > 0) parts.push(under1000(millions) + " MILLION");
  if (thousands > 0) parts.push(under1000(thousands) + " THOUSAND");
  if (rest > 0) parts.push(under1000(rest));
  return parts.join(" ") || "ZERO";
}

const UNITS: Record<string, string> = {
  USD: "US DOLLARS",
  EUR: "EUROS",
  GBP: "POUNDS STERLING",
};

/** Returns null when there is no printable amount yet. */
export function amountInWords(value: string, currency: string): string | null {
  const n = Number(value);
  if (!value.trim() || !Number.isFinite(n) || n <= 0) return null;

  let whole = Math.floor(n);
  let cents = Math.round((n - whole) * 100);
  if (cents === 100) {
    whole += 1;
    cents = 0;
  }
  if (whole > 999_999_999) return null;

  const unit = UNITS[currency] ?? currency.toUpperCase();
  const centsLabel = String(cents).padStart(2, "0");
  const head = unit.endsWith("S") ? unit : unit + "S";
  return wholeInWords(whole) + " " + head + " AND " + centsLabel + "/100";
}
