import { promises as fs } from "node:fs";
import * as path from "node:path";
import { randomBytes } from "node:crypto";

export type InvoiceStatus = "UNPAID" | "PAID";

export interface LineItem {
  desc: string;
  qty: number;
  price: number;
}

export interface InvoicePayment {
  originAsset: string;
  sourceSymbol: string;
  sourceChain: string;
  quotedRate: string;
  expectedUsdc: string;
  settledUsdc?: string;
  fee?: string;
  depositAddress?: string;
  /** When the route's quote stops being payable. Absent on records written before it was stored. */
  deadline?: string | null;
  txRefs?: string[];
  paidAt?: string;
  refundReason?: string;
}

/**
 * A live payment the payer released before sending anything to it.
 *
 * The deposit address is kept, because releasing the payment does not close the
 * address: 1Click issued it and only it can stop accepting funds, which it does at
 * the quote's deadline. Keeping the address is what lets someone check by hand
 * whether a payment the payer made anyway arrived after they cancelled here.
 */
export interface CancelledPayment extends InvoicePayment {
  cancelledAt: string;
}

export interface Invoice {
  id: string;
  number: string;
  client: string;
  freelancerNear: string;
  amount: string;
  currency: string;
  dueDate: string;
  lineItems: LineItem[];
  status: InvoiceStatus;
  swapStatus: string | null;
  payment: InvoicePayment | null;
  /** Released live payments, newest last. Capped, so the record cannot grow without bound. */
  cancelledPayments?: CancelledPayment[];
  createdAt: string;
  paidAt: string | null;
}

/** Thrown when the store exists but cannot be trusted. Never rewritten over. */
export class StoreError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "StoreError";
  }
}

// The register is one file on this machine. `INVOICES_STORE` exists so a test can
// point at a scratch file instead of the invoices a running demo is using.
const STORE = process.env.INVOICES_STORE
  ? path.resolve(process.env.INVOICES_STORE)
  : path.join(process.cwd(), "data", "invoices.json");
const TEMP = STORE + ".tmp";

/**
 * One lock for the whole store.
 *
 * Every operation is read-modify-write against a single JSON file, so two
 * requests that overlap (a status poll finishing while an invoice is being
 * created) would each write back the copy of the array they read, and the
 * slower one would silently delete the other's work. That is not hypothetical:
 * the status route holds a read across a network call to 1Click that can take
 * seconds, which is exactly long enough for an invoice to be created underneath
 * it. Reads and mutations queue here; the file is a few kilobytes, so the cost
 * of serialising is microseconds against a multi-second upstream call.
 */
let queue: Promise<unknown> = Promise.resolve();

function locked<T>(work: () => Promise<T>): Promise<T> {
  const run = queue.then(work, work);
  // Keep the chain alive after a failure: one bad request must not wedge the queue.
  queue = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

async function readAll(): Promise<Invoice[]> {
  let raw: string;
  try {
    raw = await fs.readFile(STORE, "utf8");
  } catch (err) {
    // A store that is not there yet is an empty register. Any other read failure
    // is not: pretending it is empty would let the next write persist an empty
    // array over every invoice in the file.
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw new StoreError("Invoice store could not be read: " + (err as Error).message, { cause: err });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    // Same reasoning, and this is the one that loses money: a torn or hand-edited
    // file must fail loudly while the data is still on disk, not be replaced.
    throw new StoreError("Invoice store is not valid JSON; refusing to touch it.", { cause: err });
  }
  if (!Array.isArray(parsed)) {
    throw new StoreError("Invoice store is not a JSON array; refusing to touch it.");
  }
  return parsed as Invoice[];
}

/**
 * Writes through a temporary file and a rename, so a reader (or a crash) sees the
 * previous file or the next one, never a half-written one. `writeFile` on the
 * store directly truncates it in place, which is how a store gets corrupted in
 * the first place.
 */
async function writeAll(rows: Invoice[]): Promise<void> {
  await fs.mkdir(path.dirname(STORE), { recursive: true });
  const body = JSON.stringify(rows, null, 2) + "\n";
  try {
    await fs.writeFile(TEMP, body, "utf8");
    await fs.rename(TEMP, STORE);
  } catch (err) {
    await fs.rm(TEMP, { force: true }).catch(() => undefined);
    throw new StoreError("Invoice store could not be written: " + (err as Error).message, { cause: err });
  }
}

/** The next number in the register, derived from what is filed rather than counted. */
function nextNumber(rows: Invoice[]): string {
  const highest = rows.reduce((max, row) => {
    const match = /^SF-(\d+)$/.exec(row.number ?? "");
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return "SF-" + String(highest + 1).padStart(4, "0");
}

/** Fields that a paid invoice never gives back (PRODUCT.md: immutable once paid). */
const LOCKED_ONCE_PAID: Array<keyof Invoice> = [
  "id",
  "number",
  "client",
  "freelancerNear",
  "amount",
  "currency",
  "dueDate",
  "lineItems",
  "createdAt",
];

function applyPatch(current: Invoice, patch: Partial<Invoice>): Invoice {
  const next: Invoice = { ...current, ...patch };
  if (current.status === "PAID") {
    for (const key of LOCKED_ONCE_PAID) {
      Object.assign(next, { [key]: current[key] });
    }
    // A settled invoice is never silently un-paid; only the refund record moves.
    next.status = "PAID";
    next.paidAt = current.paidAt;
  }
  return next;
}

export async function listInvoices(): Promise<Invoice[]> {
  return locked(async () => {
    const rows = await readAll();
    return rows.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  });
}

export async function getInvoice(id: string): Promise<Invoice | null> {
  return locked(async () => {
    const rows = await readAll();
    return rows.find((r) => r.id === id) ?? null;
  });
}

export function newId(): string {
  return randomBytes(12).toString("hex");
}

export async function createInvoice(input: {
  client: string;
  freelancerNear: string;
  amount: string;
  currency: string;
  dueDate: string;
  lineItems: LineItem[];
}): Promise<Invoice> {
  return locked(async () => {
    const rows = await readAll();
    const invoice: Invoice = {
      id: newId(),
      number: nextNumber(rows),
      client: input.client.trim(),
      freelancerNear: input.freelancerNear.trim(),
      amount: input.amount,
      currency: (input.currency || "USD").toUpperCase(),
      dueDate: input.dueDate,
      lineItems: input.lineItems,
      status: "UNPAID",
      swapStatus: null,
      payment: null,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    rows.push(invoice);
    await writeAll(rows);
    return invoice;
  });
}

export async function updateInvoice(id: string, patch: Partial<Invoice>): Promise<Invoice | null> {
  return mutateInvoice(id, () => patch);
}

/**
 * Read-modify-write inside the lock, so the patch is applied to the record as it
 * is now. Callers that build a patch from a snapshot taken before a network call
 * must use this form, or they will write their stale copy back over newer facts.
 */
export async function mutateInvoice(
  id: string,
  change: (current: Invoice) => Partial<Invoice> | null
): Promise<Invoice | null> {
  return locked(async () => {
    const rows = await readAll();
    const index = rows.findIndex((r) => r.id === id);
    if (index < 0) return null;
    const patch = change(rows[index]);
    if (!patch) return rows[index];
    const next = applyPatch(rows[index], patch);
    rows[index] = next;
    await writeAll(rows);
    return next;
  });
}

export function isPaid(inv: Invoice): boolean {
  return inv.status === "PAID";
}
