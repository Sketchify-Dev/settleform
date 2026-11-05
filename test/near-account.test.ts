import { test } from "node:test";
import assert from "node:assert/strict";
import { isNearAccount, isTestnetAccount, nearAccountError } from "../lib/near-account.ts";

test("mainnet account ids in every shape the product sees", () => {
  for (const id of ["intents.near", "sketchify_dev.tg", "you.near", "acme-studio.near", "a1b2c3", "intents"]) {
    assert.equal(isNearAccount(id), true, id);
    assert.equal(isTestnetAccount(id), false, id);
    assert.equal(nearAccountError(id), null, id);
  }
});

test("a testnet account is well formed and still refused", () => {
  for (const id of ["you.testnet", "you.betanet", "sub.you.testnet", "testnet"]) {
    assert.equal(isNearAccount(id), true, id);
    assert.equal(isTestnetAccount(id), true, id);
    assert.match(nearAccountError(id) ?? "", /mainnet/, id);
  }
  // Uppercase is malformed, so it is refused on shape, and the testnet check reads
  // it as testnet anyway. Either way it cannot reach a live quote.
  assert.equal(isNearAccount("YOU.TESTNET"), false);
  assert.equal(isTestnetAccount("YOU.TESTNET"), true);
});

test("malformed account ids are refused before the network is", () => {
  for (const id of ["", "  ", "You.Near", "TESTNET", "you near", "you.near!", "a".repeat(65)]) {
    assert.equal(isNearAccount(id), false, id);
    assert.match(nearAccountError(id) ?? "", /valid NEAR account/, id);
  }
});
