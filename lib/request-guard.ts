/**
 * Request guards for the write endpoints.
 *
 * The API has no auth by design (a pay link is a capability URL), which makes the
 * browser the only thing standing between a stranger's page and this process.
 * Without a same-origin check, any site could POST to a locally running instance
 * (or to a deployed one), create invoices, and spend the 1Click quote quota
 * behind it. Starting a live payment from another origin is the same shape of
 * problem one step further along.
 *
 * The check is deliberately conditional: browsers send `Origin` on cross-origin
 * writes, and server-to-server callers (the README's curl path, judges' scripts)
 * send none. Rejecting only a *mismatched* Origin keeps the documented curl flow
 * working while closing the browser-driven hole.
 */
export function isSameOrigin(origin: string | null, host: string | null): boolean {
  if (!origin) return true;
  if (!host) return false;
  // "null" is what a sandboxed or file:// frame sends. That is a cross-site caller
  // with the header stripped of meaning, so it is treated as untrusted.
  if (origin === "null") return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
