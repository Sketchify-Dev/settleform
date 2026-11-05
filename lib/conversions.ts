import { promises as fs } from "node:fs";
import * as path from "node:path";

/**
 * The converter's public settlement record.
 *
 * A conversion has no invoice, but a finished swap is still proof, and proof
 * filed in one browser is proof nowhere else. So unlike the live quote path,
 * finished conversions are kept here, on the server, where every browser - and
 * every judge - can read them. What goes in is verified, never remembered: a
 * record is only stored after the status route has read the swap live from
 * 1Click and found it finished, and the figures stored are the route's own.
 * An address whose swap is still running is refused, because a running swap
 * belongs to the live view, not to history.
 *
 * Everything in a record is already public on the chains it links to: deposit
 * address, amounts, fees, recipient account and transaction references. No
 * secret ever lands here. The one record that ships with the build - the
 * builder's own settled conversion - is there by their explicit request, in
 * `data/conversions.example.json`, the same seed pattern the invoice register
 * uses. The live file is git-ignored beside it.
 */

export interface ConversionLeg {
  label: string;
  links: string[];
}

export interface StoredConversion {
  depositAddress: string;
  sourceSymbol: string;
  sourceChain: string;
  amountInFormatted: string;
  amountOutFormatted: string;
  settledUsdc: string | null;
  withdrawFee: string;
  refundFee: string;
  destinationNear: string;
  destinationSymbol: string;
  status: string;
  plain: string;
  finishedAt: string;
  txRefs: string[];
  legs: ConversionLeg[];
  refundReason: string | null;
  recordedAt: string;
}

/** Thrown when the store exists but cannot be trusted. Never rewritten over. */
export class ConversionStoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConversionStoreError";
  }
}

// `CONVERSIONS_STORE` exists so a test can point at a scratch file instead of
// the history the running demo is serving.
const STORE = process.env.CONVERSIONS_STORE
  ? path.resolve(process.env.CONVERSIONS_STORE)
  : path.join(process.cwd(), "data", "conversions.json");
const SEED = path.join(process.cwd(), "data", "conversions.example.json");
const TEMP = STORE + ".tmp";

/** History is a short public list, not an archive. Enough to prove, not to bloat. */
const KEPT = 50;

/**
 * One lock for the whole file, for the same reason the invoice store has one:
 * two records finishing at once must not each write back the copy they read.
 */
let queue: Promise<unknown> = Promise.resolve();

function locked<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readAll(): Promise<StoredConversion[]> {
  let raw: string;
  try {
    raw = await fs.readFile(STORE, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new ConversionStoreError("Conversion store could not be read: " + (err as Error).message, {
        cause: err,
      });
    }
    // No live file yet: the seed ships the builder's own settled swap, so a
    // fresh machine still opens on proof rather than on an empty list. A
    // missing seed is an empty history, not an error.
    try {
      raw = await fs.readFile(SEED, "utf8");
    } catch {
      return [];
    }
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConversionStoreError("Conversion store is not valid JSON; refusing to touch it.", {
      cause: err,
    });
  }
  if (!Array.isArray(parsed)) {
    throw new ConversionStoreError("Conversion store is not a JSON array; refusing to touch it.");
  }
  return parsed.filter(
    (r): r is StoredConversion =>
      !!r && typeof r === "object" && typeof (r as StoredConversion).depositAddress === "string"
  );
}

async function writeAll(rows: StoredConversion[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  const body = JSON.stringify(rows, null, 2) + "\n";
  try {
    await fs.writeFile(TEMP, body, "utf8");
    await fs.rename(TEMP, STORE);
  } catch (err) {
    await fs.rm(TEMP, { force: true }).catch(() => undefined);
    throw new ConversionStoreError("Conversion store could not be written: " + (err as Error).message, {
      cause: err,
    });
  }
}

export async function listConversions(): Promise<StoredConversion[]> {
  return locked(async () => {
    const rows = await readAll();
    return rows.sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1));
  });
}

/**
 * File a verified finished swap. Upsert by deposit address: re-reading an old
 * address refreshes its record rather than doubling it.
 */
export async function recordConversion(record: StoredConversion): Promise<StoredConversion[]> {
  return locked(async () => {
    const rows = await readAll();
    const at = rows.findIndex((r) => r.depositAddress === record.depositAddress);
    if (at >= 0) rows[at] = record;
    else rows.push(record);
    const sorted = rows.sort((a, b) => (a.finishedAt < b.finishedAt ? 1 : -1)).slice(0, KEPT);
    await writeAll(sorted);
    return sorted;
  });
}
