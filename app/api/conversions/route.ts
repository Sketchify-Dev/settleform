import { listConversions } from "@/lib/conversions";
import { failure, json } from "@/lib/http";

/**
 * The converter's public settlement record, newest first.
 *
 * No address, no login, no secret: everything listed here is already public on
 * the chains it links to. A fresh machine with no live store file still opens
 * on the seed - the builder's own settled swap - so history proves rather
 * than promises from the first visit.
 */
export async function GET() {
  try {
    const conversions = await listConversions();
    return json({ conversions });
  } catch (err) {
    return failure(err, "conversions");
  }
}
