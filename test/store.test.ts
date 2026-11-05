import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * The store's two failure modes are the ones that cost invoices: a lost update,
 * and a write over data it could not parse. Both are exercised against a scratch
 * file so the demo's own register is never touched.
 */
const dir = await fs.mkdtemp(path.join(os.tmpdir(), "settleform-store-"));
const store = path.join(dir, "invoices.json");
process.env.INVOICES_STORE = store;

const { createInvoice, getInvoice, listInvoices, mutateInvoice, updateInvoice, StoreError } = await import(
  "../lib/invoices.ts"
);

function input(client: string) {
  return {
    client,
    freelancerNear: "you.near",
    amount: "250.00",
    currency: "USD",
    dueDate: "2026-11-30",
    lineItems: [{ desc: "Design services", qty: 1, price: 250 }],
  };
}

async function reset(rows: unknown = []) {
  await fs.writeFile(store, JSON.stringify(rows, null, 2) + "\n", "utf8");
}

beforeEach(async () => {
  await reset([]);
});

test("concurrent creates all survive with unique numbers", async () => {
  const created = await Promise.all(Array.from({ length: 25 }, (_, i) => createInvoice(input("Client " + i))));
  const stored = await listInvoices();

  assert.equal(stored.length, 25);
  assert.equal(new Set(created.map((i) => i.id)).size, 25);
  assert.equal(new Set(stored.map((i) => i.number)).size, 25, "numbers must not collide");
  assert.deepEqual(
    stored.map((i) => i.number).sort(),
    Array.from({ length: 25 }, (_, i) => "SF-" + String(i + 1).padStart(4, "0"))
  );
});

test("a mutation made from a stale read does not erase work done meanwhile", async () => {
  // The status route's shape: read the invoice, spend seconds calling 1Click,
  // then write. Anything created in that window must still be there afterwards.
  const first = await createInvoice(input("Acme"));
  const stale = await getInvoice(first.id);
  assert.ok(stale);

  const during = await createInvoice(input("Created while 1Click was thinking"));
  await mutateInvoice(first.id, () => ({ swapStatus: "PROCESSING" }));

  const rows = await listInvoices();
  assert.equal(rows.length, 2, "the invoice created mid-flight is not overwritten");
  assert.ok(rows.some((r) => r.id === during.id));
  assert.equal((await getInvoice(first.id))?.swapStatus, "PROCESSING");
});

test("the register is never left half-written", async () => {
  await createInvoice(input("Acme"));
  const leftovers = (await fs.readdir(dir)).filter((f) => f.endsWith(".tmp"));
  assert.deepEqual(leftovers, [], "the temporary file is renamed into place, not left behind");
  const parsed = JSON.parse(await fs.readFile(store, "utf8"));
  assert.equal(Array.isArray(parsed), true);
});

test("a store that cannot be parsed is refused, never replaced", async () => {
  const corrupt = '{ "this is": not json';
  await fs.writeFile(store, corrupt, "utf8");

  await assert.rejects(() => listInvoices(), StoreError);
  await assert.rejects(() => createInvoice(input("Acme")), StoreError);
  await assert.rejects(() => getInvoice("anything"), StoreError);

  assert.equal(await fs.readFile(store, "utf8"), corrupt, "the unreadable file is still on disk");
});

test("a missing store is an empty register, not an error", async () => {
  await fs.rm(store, { force: true });
  assert.deepEqual(await listInvoices(), []);
  const created = await createInvoice(input("First"));
  assert.equal(created.number, "SF-0001");
});

test("a paid invoice keeps its money facts", async () => {
  const inv = await createInvoice(input("Acme"));
  await updateInvoice(inv.id, { status: "PAID", paidAt: new Date().toISOString(), swapStatus: "SUCCESS" });

  const after = await updateInvoice(inv.id, {
    amount: "1.00",
    client: "Someone else",
    status: "UNPAID",
    paidAt: null,
  });

  assert.equal(after?.amount, "250.00");
  assert.equal(after?.client, "Acme");
  assert.equal(after?.status, "PAID");
  assert.ok(after?.paidAt);
});
