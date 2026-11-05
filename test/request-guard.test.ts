import { test } from "node:test";
import assert from "node:assert/strict";
import { isSameOrigin } from "../lib/request-guard.ts";

test("the app may call itself", () => {
  assert.equal(isSameOrigin("http://localhost:3000", "localhost:3000"), true);
  assert.equal(isSameOrigin("https://settleform.example", "settleform.example"), true);
});

test("another site may not post invoices or start payments", () => {
  assert.equal(isSameOrigin("https://evil.example", "localhost:3000"), false);
  assert.equal(isSameOrigin("http://localhost:3000.evil.example", "localhost:3000"), false);
  assert.equal(isSameOrigin("null", "localhost:3000"), false, "a stripped Origin is not trust");
  assert.equal(isSameOrigin("not a url", "localhost:3000"), false);
  assert.equal(isSameOrigin("http://localhost:3000", null), false);
});

test("a caller with no Origin at all is a script, not a stranger's page", () => {
  // The README's judge path is curl, which sends no Origin. Browsers always do on
  // a cross-origin write, so the header's absence is not the hole this closes.
  assert.equal(isSameOrigin(null, "localhost:3000"), true);
  assert.equal(isSameOrigin(null, null), true);
});
