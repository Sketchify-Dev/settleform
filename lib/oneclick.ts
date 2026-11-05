/**
 * Everything needed to talk to 1Click about converting a token.
 *
 * The converter (`/convert`) is a second surface onto the same swap service the
 * invoices use, but it is deliberately not wired into the invoice store: a
 * conversion has no invoice to write, no payee to bill and no record that must
 * survive a restart. What it does have is the same two hazards - a refund address
 * that a typo can send funds to nowhere, and a destination account that can be
 * well-formed and unpayable - so those checks live here, next to the asset table
 * that decides which format applies.
 *
 * This module is additive on purpose. The invoice routes keep their own copy of
 * the upstream shapes; folding them in would mean editing the money path this
 * feature does not need to touch.
 */
import fs from "node:fs";
import path from "node:path";
// Extensioned so `node --test` can load this module directly: the test runner is
// plain ESM and does not resolve extensionless specifiers the way the bundler does.
import { isNearAccount, isTestnetAccount } from "./near-account.ts";

export const ONECLICK_QUOTE = "https://1click.chaindefuser.com/v0/quote";
export const ONECLICK_STATUS = "https://1click.chaindefuser.com/v0/status";

/** Past these the upstream is not answering, it is hanging. */
const QUOTE_TIMEOUT_MS = 15000;
const STATUS_TIMEOUT_MS = 8000;

export const USER_AGENT = "Settleform/0.1 (+https://settleform.vercel.app)";

export function oneclickHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": USER_AGENT,
  };
  if (process.env.ONECLICK_JWT) headers.Authorization = "Bearer " + process.env.ONECLICK_JWT;
  return headers;
}

export interface SourceAsset {
  assetId: string;
  blockchain: string;
  symbol: string;
  decimals: number;
  label: string;
  refundFormat: string;
}

export interface AssetTable {
  sources: SourceAsset[];
  destinationAsset: { assetId: string; symbol: string; decimals: number };
  demoRefundAddresses: Record<string, string>;
}

let assets: Promise<AssetTable> | null = null;

/** The asset table is read once per process and retried on failure rather than cached. */
export function loadAssets(): Promise<AssetTable> {
  assets ??= fs.promises
    .readFile(path.join(process.cwd(), "data", "supported-assets.json"), "utf8")
    .then((raw) => JSON.parse(raw) as AssetTable)
    .catch((err: unknown) => {
      assets = null;
      throw err;
    });
  return assets;
}

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

/**
 * Where the funds go if the swap cannot complete.
 *
 * A refund address is not a formality: it is the only route back. The format comes
 * from the asset table, so this follows the chain the payer actually chose instead
 * of guessing at one.
 */
export function refundAddressError(format: string, value: string): string | null {
  if (!value) return "A refund address on the source chain is required.";
  if (format === "0x address")
    return EVM_ADDRESS.test(value) ? null : "Refund address must be a 0x address, 40 hex characters.";
  if (format === "NEAR account") {
    if (!isNearAccount(value)) return "Refund address must be a NEAR account, for example you.near.";
    // The refund leg lands on NEAR mainnet. A testnet address is well-formed and
    // unpayable, which is the worst combination to accept.
    if (isTestnetAccount(value))
      return "Refunds arrive on NEAR mainnet, so a testnet refund address cannot receive them.";
    return null;
  }
  return null;
}

/** A deposit address is either a 0x address or a NEAR implicit account (64 hex). */
export function isDepositAddress(value: string): boolean {
  return EVM_ADDRESS.test(value) || /^[0-9a-f]{64}$/i.test(value);
}

export interface Quote {
  depositAddress: string;
  originAsset: string;
  sourceSymbol: string;
  sourceChain: string;
  amountInFormatted: string;
  amountOutFormatted: string;
  amountOutUsd: string;
  withdrawFee: string;
  refundFee: string;
  timeEstimate: number | null;
  deadline: string;
  correlationId: string | null;
}

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; status: number; error: string };

/**
 * Ask for an exact amount out, delivered on NEAR to `destinationNear`.
 *
 * EXACT_OUTPUT mirrors the invoice flow: the payer is told the exact figure to
 * send, and the figure they receive is the one they asked for. `destinationNear`
 * is resolved server-side by the route before this is called - it is never taken
 * from the browser, because that would let a payer redirect their own payment.
 */
export async function requestQuote(input: {
  originAsset: string;
  destinationAsset: string;
  destinationNear: string;
  refundAddress: string;
  microUsdc: string;
}): Promise<QuoteResult> {
  const body = {
    dry: false,
    swapType: "EXACT_OUTPUT",
    slippageTolerance: 100,
    originAsset: input.originAsset,
    depositType: "ORIGIN_CHAIN",
    destinationAsset: input.destinationAsset,
    amount: input.microUsdc,
    recipient: input.destinationNear,
    recipientType: "DESTINATION_CHAIN",
    refundTo: input.refundAddress,
    refundType: "ORIGIN_CHAIN",
    deadline: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };

  let res: Response;
  try {
    res = await fetch(ONECLICK_QUOTE, {
      method: "POST",
      headers: oneclickHeaders(),
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(QUOTE_TIMEOUT_MS),
    });
  } catch (err) {
    console.error("[convert] quote network failure:", err);
    return { ok: false, status: 502, error: "Quote failed, no payment made." };
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[convert] quote upstream " + res.status + ": " + detail.slice(0, 400));
    return { ok: false, status: 502, error: "Quote failed, no payment made." };
  }

  let data: { quote?: Record<string, unknown>; correlationId?: string };
  try {
    data = (await res.json()) as { quote?: Record<string, unknown>; correlationId?: string };
  } catch {
    return { ok: false, status: 502, error: "Quote failed, no payment made." };
  }

  const q = data.quote ?? {};
  const str = (key: string, fallback = "") =>
    typeof q[key] === "string" || typeof q[key] === "number" ? String(q[key]) : fallback;

  const depositAddress = str("depositAddress");
  // Without an address there is nowhere to send funds, so this is a failure and not
  // a quote the page can show.
  if (!depositAddress) {
    return {
      ok: false,
      status: 502,
      error: "The quote service did not issue a deposit address. No payment was made.",
    };
  }

  return {
    ok: true,
    quote: {
      depositAddress,
      originAsset: input.originAsset,
      sourceSymbol: "",
      sourceChain: "",
      amountInFormatted: str("amountInFormatted"),
      amountOutFormatted: str("amountOutFormatted"),
      amountOutUsd: str("amountOutUsd"),
      withdrawFee: str("withdrawFee", "0"),
      refundFee: str("refundFee", "0"),
      timeEstimate: typeof q.timeEstimate === "number" ? q.timeEstimate : null,
      deadline: str("deadline", body.deadline),
      correlationId: data.correlationId ?? null,
    },
  };
}

export const PLAIN_STATUS: Record<string, string> = {
  PENDING_DEPOSIT: "Waiting for your deposit to arrive.",
  KNOWN_DEPOSIT_TX: "Deposit seen, waiting for confirmations.",
  PROCESSING: "Swap is executing.",
  SUCCESS: "Settled. The USDC is in your NEAR account.",
  INCOMPLETE_DEPOSIT: "Deposit was below the required amount.",
  REFUNDED: "Swap refunded to your source address.",
  FAILED: "Swap failed, no funds moved.",
};

/** Swap states that will not move again, so the page can stop polling. */
export const TERMINAL_STATUS = new Set(["SUCCESS", "REFUNDED", "FAILED"]);

/** Explorer roots for the chains this demo can pay from or settle to. */
const EXPLORERS: Record<string, string> = {
  eth: "https://etherscan.io/tx/",
  base: "https://basescan.org/tx/",
  near: "https://nearblocks.io/txns/",
};

/**
 * One upstream transaction reference, as a string.
 *
 * Upstream items arrive in several shapes: a bare URL, a bare hash, or an object
 * carrying `explorerUrl`, `url`, `hash`, `txHash` or `transactionHash`. Your settled
 * conversion is why the object keys are plural: its proof lived in a field this
 * reader never opened, so the SUCCESS screen showed no links at all. Anything that
 * is not a URL and not an object with one of these keys is skipped, because a row
 * the reader cannot identify is not proof of anything.
 */
function txRef(item: unknown): string | null {
  if (typeof item === "string") return item || null;
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    for (const key of ["explorerUrl", "url", "hash", "txHash", "transactionHash"]) {
      if (typeof o[key] === "string" && o[key]) return o[key] as string;
    }
  }
  return null;
}

/**
 * Transaction references as clickable links, labeled by leg by the caller.
 *
 * With a chain, a bare hash becomes a full explorer link: an EVM `0x` hash points
 * at its chain's scanner and a NEAR hash at Nearblocks. Without one, or when the
 * value is not shaped like a transaction hash at all, it is kept as raw text rather
 * than turned into a confident link to nowhere.
 */
export function txLinks(list: unknown, chain?: string): string[] {
  if (!Array.isArray(list)) return [];
  const out: string[] = [];
  for (const t of list) {
    const ref = txRef(t);
    if (!ref) continue;
    if (/^https?:\/\//.test(ref)) {
      out.push(ref);
      continue;
    }
    const base = chain ? EXPLORERS[chain] : undefined;
    const hashLike = /^(0x[0-9a-fA-F]{64}|[1-9A-HJ-NP-Za-km-z]{43,44})$/.test(ref);
    out.push(base && hashLike ? base + ref : ref);
  }
  return out;
}

export interface SwapLeg {
  label: string;
  links: string[];
}

/**
 * References split by leg, so the page can label what each one proves.
 *
 * A deposit reference proves the payer's money reached the swap; a withdrawal
 * reference proves the USDC reached the named account. One flat list of URLs
 * cannot say which is which, so the split happens here, once, for both the
 * converter and any invoice surface that reads it later.
 */
export function splitProofLegs(deposit: string[], withdraw: string[]): SwapLeg[] {
  const legs: SwapLeg[] = [];
  if (deposit.length) legs.push({ label: "Deposit", links: deposit });
  if (withdraw.length) legs.push({ label: "Withdrawal to your account", links: withdraw });
  return legs;
}

export interface SwapStatus {
  status: string;
  plain: string;
  settledUsdc: string | null;
  txRefs: string[];
  /** References split by leg, so the page can label what each one proves. */
  legs: SwapLeg[];
  refundReason: string | null;
  terminal: boolean;
  /** When the route last had news of this swap. Filing time is not finish time. */
  updatedAt: string | null;
}

/**
 * Read the swap behind a deposit address. Returns null when upstream will not say.
 *
 * Each leg gets its own chain for hash linking: deposit references point at the
 * source chain's scanner and withdrawal references at the destination's. The old
 * flat `txRefs` array stays alongside, so a caller that only lists links keeps
 * working.
 */
export async function fetchStatus(
  depositAddress: string,
  chains?: { source?: string; destination?: string }
): Promise<SwapStatus | null> {
  let res: Response;
  try {
    res = await fetch(ONECLICK_STATUS + "?depositAddress=" + encodeURIComponent(depositAddress), {
      headers: oneclickHeaders(),
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
    });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let upstream: {
    status?: string;
    updatedAt?: unknown;
    swapDetails?: {
      amountOutFormatted?: string;
      originChainTxHashes?: unknown;
      destinationChainTxHashes?: unknown;
      refundReason?: string;
    };
  };
  try {
    upstream = (await res.json()) as typeof upstream;
  } catch {
    return null;
  }

  const status = typeof upstream.status === "string" ? upstream.status : "PROCESSING";
  const details = upstream.swapDetails ?? {};
  const deposit = txLinks(details.originChainTxHashes, chains?.source);
  const withdraw = txLinks(details.destinationChainTxHashes, chains?.destination ?? "near");
  const refs = [...deposit, ...withdraw];
  const legs = splitProofLegs(deposit, withdraw);

  return {
    status,
    plain: PLAIN_STATUS[status] ?? status,
    settledUsdc: details.amountOutFormatted ?? null,
    txRefs: refs,
    legs,
    refundReason: details.refundReason ?? null,
    terminal: TERMINAL_STATUS.has(status),
    updatedAt: typeof upstream.updatedAt === "string" ? upstream.updatedAt : null,
  };
}
