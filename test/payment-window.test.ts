import { test } from "node:test";
import assert from "node:assert/strict";
import { depositSeen, holdsInvoice, releasable } from "../lib/payment-window.ts";

const NOW = Date.parse("2026-11-03T12:00:00.000Z");
const soon = new Date(NOW + 5 * 60 * 1000).toISOString();
const past = new Date(NOW - 5 * 60 * 1000).toISOString();
const address = { depositAddress: "0xabc", deadline: soon };

test("an invoice with no live payment is free to quote", () => {
  assert.equal(holdsInvoice(null, null, NOW), false);
  assert.equal(holdsInvoice({ deadline: soon }, null, NOW), false);
});

test("a live quote inside its deadline holds the invoice", () => {
  assert.equal(holdsInvoice(address, "PENDING_DEPOSIT", NOW), true);
});

test("a quote past its deadline releases the invoice: nothing was sent", () => {
  assert.equal(holdsInvoice({ ...address, deadline: past }, "PENDING_DEPOSIT", NOW), false);
});

test("funds already seen beat the clock: a deposit in flight is never replaced", () => {
  assert.equal(holdsInvoice({ ...address, deadline: past }, "KNOWN_DEPOSIT_TX", NOW), true);
  assert.equal(holdsInvoice({ ...address, deadline: past }, "PROCESSING", NOW), true);
  assert.equal(holdsInvoice({ ...address, deadline: past }, "INCOMPLETE_DEPOSIT", NOW), true);
});

test("a swap that already ended does not hold the invoice", () => {
  assert.equal(holdsInvoice(address, "REFUNDED", NOW), false);
  assert.equal(holdsInvoice(address, "FAILED", NOW), false);
  assert.equal(holdsInvoice(address, "SUCCESS", NOW), false);
});

test("a record written before deadlines were stored is left open rather than guessed at", () => {
  assert.equal(holdsInvoice({ depositAddress: "0xabc" }, "PENDING_DEPOSIT", NOW), true);
  assert.equal(holdsInvoice({ depositAddress: "0xabc" }, null, NOW), true);
});

test("an unparseable deadline is treated as no deadline", () => {
  assert.equal(holdsInvoice({ ...address, deadline: "not a date" }, "PENDING_DEPOSIT", NOW), true);
});

test("a payment nothing was sent to may be released", () => {
  assert.equal(releasable(null), true);
  assert.equal(releasable("PENDING_DEPOSIT"), true);
});

test("money on the deposit is never released by hand", () => {
  assert.equal(releasable("KNOWN_DEPOSIT_TX"), false);
  assert.equal(releasable("PROCESSING"), false);
  assert.equal(releasable("INCOMPLETE_DEPOSIT"), false);
});

test("a swap that is already over is not released either: it holds nothing", () => {
  assert.equal(releasable("REFUNDED"), false);
  assert.equal(releasable("FAILED"), false);
});

test("only 1Click's PENDING_DEPOSIT means nothing has arrived", () => {
  assert.equal(depositSeen("PENDING_DEPOSIT"), false);
  assert.equal(depositSeen("KNOWN_DEPOSIT_TX"), true);
  assert.equal(depositSeen("PROCESSING"), true);
  assert.equal(depositSeen("SUCCESS"), true);
  assert.equal(depositSeen("INCOMPLETE_DEPOSIT"), true);
  assert.equal(depositSeen("REFUNDED"), true);
  assert.equal(depositSeen("FAILED"), true);
});

test("no answer at all is not an answer of nothing deposited", () => {
  assert.equal(depositSeen(null), true);
  assert.equal(depositSeen(undefined), true);
});
