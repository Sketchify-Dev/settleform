import { test } from "node:test";
import assert from "node:assert/strict";
import { clientKey, createRateLimit } from "../lib/rate-limit.ts";

test("a caller gets its allowance, then nothing until the window turns", () => {
  const limit = createRateLimit({ limit: 3, windowMs: 1000 });
  const t0 = 1_000_000;

  assert.equal(limit.take("a", t0), true);
  assert.equal(limit.take("a", t0 + 1), true);
  assert.equal(limit.take("a", t0 + 2), true);
  assert.equal(limit.take("a", t0 + 3), false, "the fourth call in the window is refused");
  assert.equal(limit.take("a", t0 + 999), false);

  assert.equal(limit.take("a", t0 + 1000), true, "a new window starts over");
});

test("one caller's burst does not spend another's allowance", () => {
  const limit = createRateLimit({ limit: 1, windowMs: 1000 });
  assert.equal(limit.take("a", 0), true);
  assert.equal(limit.take("a", 1), false);
  assert.equal(limit.take("b", 1), true);
});

test("retry-after points at the end of the window", () => {
  const limit = createRateLimit({ limit: 1, windowMs: 30_000 });
  limit.take("a", 0);
  assert.equal(limit.retryAfter("a", 0), 30);
  assert.equal(limit.retryAfter("a", 25_000), 5);
  assert.equal(limit.retryAfter("nobody", 0), 0);
});

test("a caller cannot mint a fresh allowance by sending its own proxy header", () => {
  const forwarded = new Headers({ "x-forwarded-for": "203.0.113.9, 10.0.0.1" });

  // The header is caller-controlled, so by default it is not believed: every
  // caller shares one bucket, and rotating the header buys nothing.
  assert.equal(clientKey(forwarded), "local");
  assert.equal(clientKey(new Headers({ "x-real-ip": "203.0.113.7" })), "local");

  // Behind a proxy known to set it, the first hop is the client.
  assert.equal(clientKey(forwarded, true), "203.0.113.9");
  assert.equal(clientKey(new Headers({ "x-real-ip": "203.0.113.7" }), true), "203.0.113.7");
  assert.equal(clientKey(new Headers(), true), "local");
});
