import { test } from "node:test";
import assert from "node:assert/strict";
import { formatBaseUnits, normalizeInvoiceAmount, toMicroUsdc } from "../lib/amount.ts";

test("invoice amounts are normalised to the two decimals the words line prints", () => {
  assert.equal(normalizeInvoiceAmount("250"), "250.00");
  assert.equal(normalizeInvoiceAmount("250.5"), "250.50");
  assert.equal(normalizeInvoiceAmount("250.00"), "250.00");
  assert.equal(normalizeInvoiceAmount(" 250.55 "), "250.55");
  assert.equal(normalizeInvoiceAmount("0250.55"), "250.55");
  assert.equal(normalizeInvoiceAmount(250.55), null, "a float is not an amount string");
});

test("an amount the instrument cannot state twice is refused, not rounded", () => {
  assert.equal(normalizeInvoiceAmount("250.555"), null, "three decimals has no 00/100 form");
  assert.equal(normalizeInvoiceAmount("0"), null);
  assert.equal(normalizeInvoiceAmount("0.00"), null);
  assert.equal(normalizeInvoiceAmount("-5"), null);
  assert.equal(normalizeInvoiceAmount("1e3"), null);
  assert.equal(normalizeInvoiceAmount("250,00"), null);
  assert.equal(normalizeInvoiceAmount(""), null);
  assert.equal(normalizeInvoiceAmount("1000000000"), null, "ten digits is past the words ceiling");
});

test("micro-USDC is exact, so the swap asked for is the invoice printed", () => {
  assert.equal(toMicroUsdc("250.00"), "250000000");
  assert.equal(toMicroUsdc("250"), "250000000");
  assert.equal(toMicroUsdc("0.01"), "10000");
  assert.equal(toMicroUsdc("0.000001"), "1");
  assert.equal(toMicroUsdc("999999999.99"), "999999999990000");
});

test("micro-USDC refuses what it cannot represent instead of rounding it", () => {
  assert.throws(() => toMicroUsdc("0.0000001"), /bad-amount/);
  assert.throws(() => toMicroUsdc("0"), /bad-amount/);
  assert.throws(() => toMicroUsdc("-1"), /bad-amount/);
  assert.throws(() => toMicroUsdc("abc"), /bad-amount/);
});

test("a fee reported in base units comes back as the money it represents", () => {
  // The value that prompted this: 1Click's withdrawFee for a half-dollar swap, which
  // the page printed as "5078" beside a 0.5 USDC total.
  assert.equal(formatBaseUnits("5078", 6), "0.005078");
  assert.equal(formatBaseUnits(5078, 6), "0.005078");
  assert.equal(formatBaseUnits("500000", 6), "0.5");
  assert.equal(formatBaseUnits("1000000", 6), "1");
  assert.equal(formatBaseUnits("0", 6), "0");
  assert.equal(formatBaseUnits("1000000000000000000", 18), "1");
  assert.equal(formatBaseUnits("35000000000000", 18), "0.000035");
  assert.equal(formatBaseUnits("1", 0), "1");
});

test("a fee that is not a clean integer is refused rather than invented", () => {
  assert.equal(formatBaseUnits("0.005", 6), null);
  assert.equal(formatBaseUnits("", 6), null);
  assert.equal(formatBaseUnits(-1, 6), null);
  assert.equal(formatBaseUnits(null, 6), null);
  assert.equal(formatBaseUnits(undefined, 6), null);
});

test("float arithmetic is not in the path", () => {
  // 0.1 + 0.2 style drift would send 0.30000000000000004 to the quote API.
  assert.equal(toMicroUsdc("0.30"), "300000");
  assert.equal(toMicroUsdc("0.07"), "70000");
  assert.equal(toMicroUsdc("1.15"), "1150000");
});
