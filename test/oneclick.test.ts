import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAIN_STATUS,
  TERMINAL_STATUS,
  isDepositAddress,
  refundAddressError,
  splitProofLegs,
  txLinks,
} from "../lib/oneclick.ts";

test("an EVM refund address is 40 hex characters behind 0x", () => {
  assert.equal(refundAddressError("0x address", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"), null);
  for (const bad of ["0x", "833589fCD6eDb6E08f4c7C32D4f71b54bdA029133", "0xzz3589fCD6eDb6E08f4c7C32D4f71b54bdA02913"]) {
    assert.equal(refundAddressError("0x address", bad), "Refund address must be a 0x address, 40 hex characters.", bad);
  }
  // Missing is its own message, so a blank field does not read as a format mistake.
  assert.match(refundAddressError("0x address", "") ?? "", /required/);
});

test("a NEAR refund address is checked for shape and for mainnet", () => {
  assert.equal(refundAddressError("NEAR account", "you.near"), null);
  assert.match(refundAddressError("NEAR account", "you near") ?? "", /NEAR account/);
  // The one that matters: well formed, unpayable, and refused before a quote.
  assert.match(refundAddressError("NEAR account", "you.testnet") ?? "", /mainnet/);
});

test("an empty refund address is refused whatever the route", () => {
  assert.match(refundAddressError("0x address", "") ?? "", /required/);
  assert.match(refundAddressError("NEAR account", "   ".trim()) ?? "", /required/);
});

test("a deposit address is an EVM address or a NEAR implicit account, and nothing else", () => {
  assert.equal(isDepositAddress("21e7aedc6cfd5469826b8e705739a1407a94e031407a6cb3fb63f061c6c6ef04"), true);
  assert.equal(isDepositAddress("0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"), true);
  for (const bad of ["", "near", "21e7aedc", "21e7aedc6cfd5469826b8e705739a1407a94e031407a6cb3fb63f061c6c6ef0", "0x1234", "../../etc/passwd"]) {
    assert.equal(isDepositAddress(bad), false, bad);
  }
});

test("transaction links are read from every upstream shape", () => {
  assert.deepEqual(txLinks(undefined), []);
  assert.deepEqual(txLinks("not-an-array"), []);
  // A NEAR hash this demo accepts as proof: 44 base58 characters, the form a
  // transaction hash takes on Nearblocks.
  const nearHash = "9xQeWvG8168BqZpXVkHmydRaUfTcEe4Ys5Nn3wAbCdEf";
  assert.equal(nearHash.length, 44);
  assert.deepEqual(
    txLinks([
      "https://nearblocks.io/txns/abc",
      { explorerUrl: "https://basescan.org/tx/0xdef" },
      { url: "https://etherscan.io/tx/0x123" },
      { hash: "0x" + "ab".repeat(32) },
      { txHash: "0x" + "cd".repeat(32) },
      { transactionHash: nearHash },
      { nothing: true },
      "",
      42,
      { hash: "" },
    ]),
    [
      "https://nearblocks.io/txns/abc",
      "https://basescan.org/tx/0xdef",
      "https://etherscan.io/tx/0x123",
      "0x" + "ab".repeat(32),
      "0x" + "cd".repeat(32),
      nearHash,
    ]
  );
});

test("a bare hash becomes an explorer link only against its own chain", () => {
  const evm = "0x" + "ab".repeat(32);
  const near = "9xQeWvG8168BqZpXVkHmydRaUfTcEe4Ys5Nn3wAbCdEf";
  assert.deepEqual(txLinks([evm], "base"), ["https://basescan.org/tx/" + evm]);
  assert.deepEqual(txLinks([evm], "eth"), ["https://etherscan.io/tx/" + evm]);
  assert.deepEqual(txLinks([near], "near"), ["https://nearblocks.io/txns/" + near]);
  // A hash-like string that is no transaction hash is kept as text, not linked.
  assert.deepEqual(txLinks(["0x456"], "base"), ["0x456"]);
  assert.deepEqual(txLinks([near]), [near]);
});

test("proof legs are labeled by what each one proves", () => {
  assert.deepEqual(splitProofLegs([], []), []);
  const legs = splitProofLegs(["https://basescan.org/tx/0xdef"], ["https://nearblocks.io/txns/abc"]);
  assert.equal(legs.length, 2);
  assert.equal(legs[0].label, "Deposit");
  assert.equal(legs[1].label, "Withdrawal to your account");
  assert.deepEqual(splitProofLegs([], ["https://nearblocks.io/txns/abc"]).map((l) => l.label), [
    "Withdrawal to your account",
  ]);
});

test("only a settled or failed swap is terminal, so the page keeps polling the rest", () => {
  for (const s of ["SUCCESS", "REFUNDED", "FAILED"]) assert.equal(TERMINAL_STATUS.has(s), true, s);
  for (const s of ["PENDING_DEPOSIT", "KNOWN_DEPOSIT_TX", "PROCESSING", "INCOMPLETE_DEPOSIT"]) {
    assert.equal(TERMINAL_STATUS.has(s), false, s);
  }
});

test("every state the page can show has plain words", () => {
  for (const s of [
    "PENDING_DEPOSIT",
    "KNOWN_DEPOSIT_TX",
    "PROCESSING",
    "SUCCESS",
    "INCOMPLETE_DEPOSIT",
    "REFUNDED",
    "FAILED",
  ]) {
    assert.equal(typeof PLAIN_STATUS[s], "string", s);
    assert.ok(PLAIN_STATUS[s].length > 0, s);
  }
});
