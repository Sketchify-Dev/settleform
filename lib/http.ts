import { NextResponse } from "next/server";
import { StoreError } from "./invoices";

/**
 * Every response from this API carries personal financial records behind an
 * unguessable URL, so nothing in it is cacheable: not by a proxy, not by the
 * browser's back button, not by a CDN someone puts in front of the demo later.
 */
export function json(body: unknown, init?: ResponseInit): NextResponse {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store, max-age=0");
  return res;
}

/**
 * The one place a thrown error becomes a response.
 *
 * A store failure is not a 500 to be retried blindly: the file on disk is intact
 * and untouched, which is the whole reason the store refuses to write over what
 * it cannot parse. Saying that plainly is more useful to whoever is running this
 * than a stack trace, and it avoids the failure mode where a confusing error
 * invites someone to "reset" a store that still holds every invoice.
 */
export function failure(err: unknown, where: string): NextResponse {
  if (err instanceof StoreError) {
    console.error("[" + where + "] " + err.message);
    return json(
      { error: "The invoice store could not be read or written. The file on disk was left unchanged." },
      { status: 503 }
    );
  }
  console.error("[" + where + "]", err);
  return json({ error: "Unexpected server error." }, { status: 500 });
}
