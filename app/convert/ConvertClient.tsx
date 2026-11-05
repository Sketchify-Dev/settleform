"use client";

import { useEffect, useRef, useState } from "react";
import { csvRow } from "@/lib/csv";

export interface SourceOption {
  assetId: string;
  symbol: string;
  chain: string;
  label: string;
  refundFormat: string;
}

interface Quote {
  depositAddress: string;
  sourceSymbol: string;
  sourceChain: string;
  amountInFormatted: string;
  amountOutFormatted: string;
  withdrawFee: string;
  deadline: string;
  timeEstimate: number | null;
  destinationNear: string;
  destinationSymbol: string;
  requestedUsdc: string;
}

interface SwapLeg {
  label: string;
  links: string[];
}

interface StatusPayload {
  status: string;
  plain: string;
  settledUsdc: string | null;
  txRefs: string[];
  legs?: SwapLeg[];
  refundReason: string | null;
  terminal: boolean;
}

/**
 * One finished conversion, kept for the receipt and the history.
 *
 * This is the converter's answer to the invoice record: the same figures the
 * invoice receipt prints, plus proof and export. History is global now: every
 * finished swap is filed into the server record, so the proof is visible on any
 * machine, including the builder's own settled conversion, which ships as the
 * seed. Nothing here is typed from memory ,  every row is what the swap route
 * published.
 */
interface ConversionRecord {
  depositAddress: string;
  sourceSymbol: string;
  sourceChain: string;
  amountInFormatted: string;
  amountOutFormatted: string;
  settledUsdc: string | null;
  withdrawFee: string;
  destinationNear: string;
  destinationSymbol: string;
  status: string;
  plain: string;
  finishedAt: string;
  txRefs: string[];
  legs: SwapLeg[];
  refundReason: string | null;
  refundFee?: string;
  recordedAt?: string;
}

/** One row a spreadsheet can open, mirroring the invoice CSV column for column. */
function conversionCsvRow(r: ConversionRecord): string {
  return csvRow([
    r.depositAddress,
    r.sourceSymbol,
    r.sourceChain,
    r.amountInFormatted,
    r.settledUsdc ?? r.amountOutFormatted,
    r.withdrawFee ? r.withdrawFee + " " + r.destinationSymbol : "",
    r.destinationNear,
    r.status,
    r.finishedAt,
    r.txRefs.join(" | "),
  ]);
}

const CONVERSION_CSV_HEADER =
  "deposit_address,source_token,source_chain,amount_in,settled_usdc,fee,destination_near,status,finished_at,tx_refs";

function downloadCsv(filename: string, body: string) {
  const blob = new Blob([body], { type: "text/csv; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fontSizeOf(font: string): number {
  const match = /(\d+(?:\.\d+)?)px/.exec(font);
  return match ? Number(match[1]) : 24;
}

/** Split one overlong word character by character so a long URL still wraps. */
function splitWord(ctx: CanvasRenderingContext2D, word: string, width: number): string[] {
  const parts: string[] = [];
  let chunk = "";
  for (const ch of word) {
    if (ctx.measureText(chunk + ch).width <= width || !chunk) chunk += ch;
    else {
      parts.push(chunk);
      chunk = ch;
    }
  }
  if (chunk) parts.push(chunk);
  return parts;
}

/**
 * The Settleform S, shared with public/brand/settleform-mark.svg. The
 * receipt watermark draws this path on canvas, so the printed receipt
 * carries the same mark as every header.
 */
const SETTLEFORM_S = "M308.94 339.98C308.7 339.84 308.5 339.61 308.5 339.48C308.5 339.15 311.89 335.15 315.26 331.5C316.72 329.92 318.69 327.72 319.64 326.61C335.64 308.01 340.53 303.74 351.5 298.79C355.25 297.1 362.24 295.57 367.25 295.34C378.22 294.85 381.28 294.42 387.88 292.45C390.79 291.58 396.97 288.83 399 287.49C399.34 287.26 400.13 286.75 400.75 286.36C405.49 283.31 409.9 279.25 414.84 273.38C417.06 270.74 422.56 264.15 424.12 262.27C425.03 261.17 429.2 256.32 429.84 255.63C430.23 255.2 432.48 252.47 436 248.14C437.27 246.58 443.55 239.28 445.78 236.77C451.65 230.18 457.64 226.13 465.07 223.75C466.34 223.34 467.89 222.84 468.51 222.64C469.14 222.43 471.28 222.04 473.27 221.76C476.8 221.26 477.86 221.25 515.01 221.31L553.12 221.38L553.06 221.95C553.03 222.26 552.3 223.33 551.44 224.33C550.58 225.33 548.13 228.22 546 230.75C543.87 233.28 541.67 235.86 541.11 236.49C540.56 237.11 539.32 238.58 538.37 239.75C537.41 240.92 536.56 241.93 536.48 242C536.39 242.07 534.81 243.93 532.97 246.14C527.06 253.22 525.92 254.57 523.38 257.52C522 259.12 520.03 261.43 518.99 262.65C517.95 263.87 515.81 266.39 514.23 268.25C512.65 270.11 510.68 272.42 509.86 273.39C509.05 274.37 506.35 277.51 503.88 280.37C501.4 283.23 498.02 287.17 496.38 289.13C494.73 291.08 491.86 294.46 490 296.63C488.14 298.8 485.05 302.45 483.12 304.75C478.84 309.86 476.03 313.19 474.47 315C473.82 315.76 472.19 317.67 470.83 319.25C466.26 324.59 463.03 327.49 457.75 330.99C451.33 335.24 446.34 337.28 437.62 339.21L433.62 340.1L371.5 340.17C329.11 340.22 309.24 340.16 308.94 339.98ZM273.11 279.25C272 279.05 272.1 278.47 273.56 276.72C277.41 272.11 278.71 270.52 279.5 269.5C279.97 268.88 280.99 267.64 281.77 266.75C282.55 265.86 283.73 264.44 284.4 263.61C285.07 262.77 287.22 260.18 289.16 257.86C291.1 255.53 294.53 251.42 296.78 248.72C315.44 226.37 314.93 226.87 320.41 225.74C322.73 225.27 323.99 225.25 359.34 225.24C395.91 225.22 408.7 225.07 423.57 224.48C429.03 224.26 431.59 224.24 431.77 224.42C432.07 224.72 428.89 229.05 425.09 233.52C423.73 235.11 421.2 238.15 419.46 240.27C416.24 244.19 415.32 245.31 408.51 253.65C397.25 267.42 394.52 269.89 385.86 274.22C382.62 275.83 381.84 276.15 378.38 277.23C374.96 278.31 372.71 278.73 369 279.01C365.56 279.26 274.51 279.49 273.11 279.25ZM333.05 197.7C332.88 197.54 332.75 197.33 332.75 197.25C332.75 197.06 335.84 193.09 339.89 188.1C341.55 186.05 343.88 183.08 345.07 181.5C346.26 179.92 348.1 177.5 349.16 176.12C350.22 174.75 352.66 171.54 354.59 169C364.29 156.19 367.47 152.94 374.56 148.55C378.05 146.4 379.94 145.53 384.38 144.06C389.06 142.51 389.93 142.29 392.99 141.87C394.56 141.65 395.92 141.42 396 141.37C396.08 141.32 431.24 141.25 474.12 141.2C537.05 141.14 552.1 141.19 552.19 141.44C552.32 141.82 529.26 164.88 524.62 169.01C513.57 178.86 502.29 184.64 485.47 189.09C471.27 192.84 460.46 194.26 442.38 194.75C437.56 194.88 429.57 195.11 424.62 195.25C419.68 195.39 409.94 195.62 403 195.76C396.06 195.89 388.8 196.11 386.88 196.25C384.95 196.38 379.32 196.6 374.38 196.75C369.43 196.89 363.07 197.13 360.25 197.27C355.26 197.52 340.16 197.96 335.61 197.99C334.17 198 333.24 197.89 333.05 197.7Z";

/**
 * The receipt as a downloadable image: the instrument's own document grammar,
 * drawn on canvas, with the figures exactly as filed and the proof legs as
 * printed fields. What downloads is the record, not a screenshot, so it reads
 * the same filed from history on any machine.
 */
async function downloadReceiptPng(r: ConversionRecord) {
  try {
    await document.fonts.ready;
  } catch {
    // System faces carry it instead; the figures matter more than the face.
  }
  const W = 1200;
  const pad = 72;
  const max = W - pad * 2;
  const ink = "#151A17";
  const soft = "#4A524C";
  const settled = "#06614A";
  const stamp = "#8E1413";

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const mono = (size: number, weight = 500) => weight + " " + size + 'px "Martian Mono", ui-monospace, monospace';
  const sans = (size: number, weight = 600) => weight + " " + size + 'px Archivo, Arial, sans-serif';

  function wrap(text: string, font: string, width: number): string[] {
    ctx!.font = font;
    const out: string[] = [];
    for (const paragraph of text.split("\n")) {
      const words = paragraph.split(/(\s+)/);
      let line = "";
      for (const word of words) {
        if (/^\s*$/.test(word)) {
          line += word;
          continue;
        }
        const trial = line + word;
        if (ctx!.measureText(trial).width <= width || !line.trim()) {
          if (ctx!.measureText(word).width > width && !line.trim()) {
            for (const part of splitWord(ctx!, word, width)) out.push(part);
            line = "";
          } else line = trial;
        } else {
          out.push(line.trimEnd());
          line = word.trimStart();
          if (ctx!.measureText(line).width > width) {
            const parts = splitWord(ctx!, line, width);
            for (let i = 0; i < parts.length - 1; i++) out.push(parts[i]);
            line = parts[parts.length - 1];
          }
        }
      }
      out.push(line.trimEnd());
    }
    return out.filter((l, i) => l !== "" || i === out.length - 1);
  }

  type Line = { text: string; font: string; color: string; gap: number; wrap?: boolean };
  const lines: Line[] = [];
  const tone = r.status === "SUCCESS" ? settled : stamp;
  const received = r.settledUsdc ?? r.amountOutFormatted;
  const receivedLine =
    r.status === "SUCCESS" && received
      ? received + " " + r.destinationSymbol + " in " + r.destinationNear
      : r.plain;

  lines.push({ text: "SETTLEFORM CONVERSION RECEIPT", font: sans(26, 600), color: soft, gap: 18 });
  lines.push({ text: r.status, font: sans(64, 700), color: tone, gap: 30 });
  lines.push({ text: receivedLine, font: mono(34), color: ink, gap: 40, wrap: true });
  const rows: Array<[string, string]> = [
    [
      "Paid",
      r.amountInFormatted ? r.amountInFormatted + " " + r.sourceSymbol + " on " + (r.sourceChain || "the source chain") : "not recorded",
    ],
    ["1Click fee", r.withdrawFee ? r.withdrawFee + " " + r.destinationSymbol : "not recorded"],
    ["Deposit address", r.depositAddress],
    ["Paid to", r.destinationNear],
    ["Finished", r.finishedAt],
  ];
  for (const [k, v] of rows) {
    lines.push({ text: k.toUpperCase(), font: sans(22, 600), color: soft, gap: 26 });
    lines.push({ text: v, font: mono(28), color: ink, gap: 8, wrap: true });
  }
  lines.push({ text: "PROOF ON THE CHAINS", font: sans(22, 600), color: soft, gap: 30 });
  if (r.legs.length) {
    for (const leg of r.legs) {
      lines.push({ text: leg.label, font: sans(26, 700), color: ink, gap: 14 });
      for (const link of leg.links) lines.push({ text: txHashOnly(link), font: mono(24), color: ink, gap: 6, wrap: true });
    }
  } else if (r.txRefs.length) {
    for (const ref of r.txRefs) lines.push({ text: txHashOnly(ref), font: mono(24), color: ink, gap: 6, wrap: true });
  } else {
    lines.push({ text: "no references published", font: mono(24), color: soft, gap: 6 });
  }
  lines.push({
    // No origin, no route path: on a deployed build the origin is the
    // deploy URL and on this machine it is localhost, neither of which
    // belongs printed on the receipt. The product name is the pointer.
    text: "Verify at Settleform",
    font: mono(22),
    color: soft,
    gap: 34,
    wrap: true,
  });

  // Header mark: the tile logo sits centred above the title, so the PNG
  // reads as a receipt with a masthead rather than a text dump.
  const logoSize = 116;
  const logoGap = 34;
  let height = pad * 2 + logoSize + logoGap;
  const laid: Array<{ line: Line; rows: string[]; top: number }> = [];
  for (const line of lines) {
    const size = fontSizeOf(line.font);
    const rowHeight = Math.round(size * 1.4);
    const wrapped = line.wrap ? wrap(line.text, line.font, max) : [line.text];
    laid.push({ line, rows: wrapped, top: height + line.gap });
    height += line.gap + wrapped.length * rowHeight;
  }

  const scale = 2;
  canvas.width = W * scale;
  canvas.height = Math.max(height, 400) * scale;
  ctx.scale(scale, scale);
  const pageH = Math.max(height, 400);
  ctx.fillStyle = "#FCFDFA";
  ctx.fillRect(0, 0, W, pageH);
  // The mark as a watermark: the Settleform S in brand mint, centred on
  // the page behind the text. Clearly visible rather than barely-there, but
  // still a background: the text prints over it at full ink.
  ctx.save();
  // Bolder than a whisper: visible at a glance behind the figures, still
  // a background - the text prints over it at full ink.
  ctx.globalAlpha = 0.22;
  {
    // The S lives on its own grid; centre that grid on the page and scale it
    // up so it fills the sheet behind the text block.
    const s = 2.4;
    ctx.translate(W / 2, pageH / 2);
    ctx.scale(s, s);
    ctx.translate(-412.5, -240);
    const wm = ctx.createLinearGradient(0, 141, 0, 339);
    wm.addColorStop(0, "#00F3BC");
    wm.addColorStop(1, "#00E3A9");
    ctx.fillStyle = wm;
    ctx.fill(new Path2D(SETTLEFORM_S));
  }
  ctx.restore();
  ctx.strokeStyle = "#BEC7BD";
  ctx.lineWidth = 2;
  ctx.strokeRect(14, 14, W - 28, pageH - 28);

  // Masthead: the tile logo, centred above the title. Same artwork as every
  // header, drawn at full strength so the receipt carries the brand.
  {
    const lx = (W - logoSize) / 2;
    const ly = pad;
    const r = (112.64 / 512) * logoSize;
    ctx.save();
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") ctx.roundRect(lx, ly, logoSize, logoSize, r);
    else {
      ctx.moveTo(lx + r, ly);
      ctx.arcTo(lx + logoSize, ly, lx + logoSize, ly + logoSize, r);
      ctx.arcTo(lx + logoSize, ly + logoSize, lx, ly + logoSize, r);
      ctx.arcTo(lx, ly + logoSize, lx, ly, r);
      ctx.arcTo(lx, ly, lx + logoSize, ly, r);
      ctx.closePath();
    }
    ctx.fillStyle = "#030D12";
    ctx.fill();
    ctx.translate(lx + logoSize / 2, ly + logoSize / 2);
    const k = logoSize / 512;
    ctx.scale(k, k);
    ctx.scale(1.2845878136200717, 1.2845878136200717);
    ctx.translate(-412.5, -240);
    const mg = ctx.createLinearGradient(0, 141, 0, 339);
    mg.addColorStop(0, "#00F3BC");
    mg.addColorStop(1, "#00E3A9");
    ctx.fillStyle = mg;
    ctx.fill(new Path2D(SETTLEFORM_S));
    ctx.restore();
  }

  for (const { line, rows: wrapped, top } of laid) {
    const size = fontSizeOf(line.font);
    const rowHeight = Math.round(size * 1.4);
    ctx.font = line.font;
    ctx.fillStyle = line.color;
    ctx.textBaseline = "top";
    wrapped.forEach((rowText, i) => {
      ctx.fillText(rowText, pad, top + i * rowHeight, max);
    });
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "settleform-conversion-" + r.depositAddress.slice(0, 8) + ".png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A transaction reference prints as its hash, never as a full URL. */
function txHashOnly(ref: string): string {
  const trimmed = ref.trim();
  const m = trimmed.match(/^https?:\/\/[^\/]+\/(?:.*\/)?([^\/\?#]+)(?:[\?#].*)?$/);
  return m ? m[1] : trimmed;
}

/**
 * A link reads as where it points, not as a raw URL. The scanner is detected
 * from the URL itself, so a new chain (Arbiscan, Polygonscan, Snowtrace, any
 * future route) labels itself with no code change: the hostname's first label
 * is the scanner's name. A bare hash names its own scanner (NEAR hashes are
 * Nearblocks whatever the record says; EVM hashes take the record's chain);
 * anything else stays a plain link.
 */
function columnLabel(ref: string, fallbackChain?: string): string {
  try {
    const host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase();
    if (host.includes("nearblocks")) return "Nearblocks";
    const first = host.split(".")[0];
    return first.charAt(0).toUpperCase() + first.slice(1);
  } catch {
    const hash = ref.trim();
    // A bare hash names its own scanner: a NEAR hash is Nearblocks whatever
    // the record's chain says, and an EVM hash takes the record's scanner.
    // Text that is neither a URL nor a hash prints as it arrived, unlabeled.
    if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(hash)) return "Nearblocks";
    if (/^0x[0-9a-fA-F]{64}$/.test(hash)) {
      if (fallbackChain === "eth") return "Etherscan";
      if (fallbackChain === "base") return "Basescan";
      return "link";
    }
    if (fallbackChain === "eth") return "Etherscan";
    if (fallbackChain === "base") return "Basescan";
    if (fallbackChain === "near") return "Nearblocks";
    return "link";
  }
}

/**
 * One proof reference as printed: the scanner plus the hash, linked when it
 * points at one. The scanner comes from the URL itself; a bare hash falls
 * back to its own leg's chain, so a withdrawal hash never wears the deposit
 * chain's scanner. Text that is neither prints as it arrived.
 */
function proofRef(ref: string, fallbackChain?: string) {
  const label = columnLabel(ref, fallbackChain);
  const hash = txHashOnly(ref);
  if (/^https?:\/\//.test(ref)) {
    return (
      <a className="underline underline-offset-4 text-ink" href={ref} target="_blank" rel="noreferrer noopener">
        {label === "link" ? hash : label + ": " + hash}
      </a>
    );
  }
  if (label === "link") return ref;
  return label + ": " + hash;
}

/** A finished conversion as CSV plus receipt, so the live view exports the same row history keeps. */
function liveRecord(quote: Quote, status: StatusPayload): ConversionRecord {
  return {
    depositAddress: quote.depositAddress,
    sourceSymbol: quote.sourceSymbol,
    sourceChain: quote.sourceChain,
    amountInFormatted: quote.amountInFormatted,
    amountOutFormatted: quote.amountOutFormatted,
    settledUsdc: status.settledUsdc,
    withdrawFee: quote.withdrawFee,
    destinationNear: quote.destinationNear,
    destinationSymbol: quote.destinationSymbol,
    status: status.status,
    plain: status.plain,
    finishedAt: new Date().toISOString(),
    txRefs: status.txRefs ?? [],
    legs: status.legs ?? [],
    refundReason: status.refundReason,
  };
}

const STORAGE_KEY = "settleform.convert.quote";
const POLL_MS = 5000;

/** The quote survives a reload, so a payment already made is still watchable. */
function readStored(): Quote | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    const q = parsed as Quote;
    return q && typeof q.depositAddress === "string" ? q : null;
  } catch {
    return null;
  }
}

function storeQuote(q: Quote | null) {
  try {
    if (q) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(q));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // A private window or blocked storage must not stop the payment working.
  }
}

function isConversionRow(value: unknown): value is ConversionRecord {
  return !!value && typeof value === "object" && typeof (value as ConversionRecord).depositAddress === "string";
}

export default function ConvertClient({ sources }: { sources: SourceOption[] }) {
  const [destinationNear, setDestinationNear] = useState("");
  const [originAsset, setOriginAsset] = useState(sources[0]?.assetId ?? "");
  const [refundAddress, setRefundAddress] = useState("");
  const [amount, setAmount] = useState("1.00");

  const [quote, setQuote] = useState<Quote | null>(null);
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversionRecord[]>([]);
  const [historyPage, setHistoryPage] = useState(0);
  const HISTORY_PAGE_SIZE = 10;

  const errorRef = useRef<HTMLDivElement | null>(null);
  const filedRef = useRef<Set<string>>(new Set());
  const chosen = sources.find((s) => s.assetId === originAsset) ?? sources[0];
  const evm = chosen?.refundFormat === "0x address";

  // Resume a quote left open by a reload, and load the shared history. Read
  // through an async body so the first paint still matches what the server
  // rendered, and so a browser that forbids storage leaves the form as it was.
  useEffect(() => {
    async function resume() {
      const stored = readStored();
      if (stored) setQuote(stored);
      try {
        const res = await fetch("/api/conversions");
        const data = (await res.json()) as { conversions?: unknown };
        if (res.ok && Array.isArray(data.conversions)) {
          setHistory(data.conversions.filter(isConversionRow));
        }
      } catch {
        // History is proof of convenience: the converter works without it.
      }
    }
    void resume();
  }, []);

  // When a swap stops moving, file it into the shared record. Each address is
  // filed once: a reload resumes the same quote and must not file a second
  // copy. The server re-reads the swap live before writing, so what lands in
  // history is what the route published, not what the browser remembers.
  useEffect(() => {
    if (!quote || !status?.terminal) return;
    const current = quote;
    const address = current.depositAddress;
    if (filedRef.current.has(address)) return;
    filedRef.current.add(address);
    async function file() {
      try {
        const res = await fetch("/api/conversions/file", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            depositAddress: address,
            destinationNear: current.destinationNear,
            quote: {
              sourceSymbol: current.sourceSymbol,
              amountInFormatted: current.amountInFormatted,
              amountOutFormatted: current.amountOutFormatted,
              withdrawFee: current.withdrawFee,
            },
          }),
        });
        const data = (await res.json()) as { conversions?: unknown };
        if (res.ok && Array.isArray(data.conversions)) {
          setHistory(data.conversions.filter(isConversionRow));
          // A fresh filing lands newest-first on page one; jump there so the
          // row just filed is the row shown.
          setHistoryPage(0);
        }
      } catch {
        // Filing failed; the live view below still carries the proof.
      }
    }
    void file();
  }, [quote, status]);

  // Poll while the swap is live, and stop the moment it reaches a state that will
  // not move again. Defined inside the effect for the same reason the pay page does
  // it: the first read runs immediately, and the interval is torn down only when the
  // quote or its terminal state changes, not on every status the poll writes back.
  // The source chain travels with the request so each proof leg links against the
  // right scanner.
  useEffect(() => {
    if (!quote || status?.terminal) return;
    const address = quote.depositAddress;
    const url =
      "/api/convert/status?depositAddress=" +
      encodeURIComponent(address) +
      (quote.sourceChain ? "&sourceChain=" + encodeURIComponent(quote.sourceChain) : "");
    async function poll() {
      try {
        const res = await fetch(url);
        const data = (await res.json()) as StatusPayload & { error?: string };
        if (!res.ok) {
          setStatusNote(typeof data.error === "string" ? data.error : "Status unavailable, retrying...");
          return;
        }
        setStatusNote(null);
        setStatus(data);
      } catch {
        setStatusNote("Status unavailable, retrying...");
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [quote, status?.terminal]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinationNear, originAsset, refundAddress, amount }),
      });
      const data = (await res.json()) as { quote?: Quote; error?: string };
      if (!res.ok || !data.quote) {
        setError(typeof data.error === "string" ? data.error : "Could not get a quote. Nothing was charged.");
        setBusy(false);
        errorRef.current?.focus();
        return;
      }
      setQuote(data.quote);
      setStatus(null);
      storeQuote(data.quote);
      setBusy(false);
    } catch {
      setError("Network error. Nothing was charged.");
      setBusy(false);
      errorRef.current?.focus();
    }
  }

  async function copy(text: string, which: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied((current) => (current === which ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  }

  function startOver() {
    setQuote(null);
    setStatus(null);
    setStatusNote(null);
    setError(null);
    storeQuote(null);
  }

  if (quote) {
    const settled = status?.status === "SUCCESS";
    const terminal = status?.terminal ?? false;
    const ended = terminal || settled;
    const proofLegs: SwapLeg[] =
      status?.legs?.length
        ? status.legs
        : status?.txRefs?.length
          ? [{ label: "Transaction references", links: status.txRefs }]
          : [];
    return (
      <div className="instrument mt-8">
        <div className="inst-head">
          <span>SETTLEFORM CONVERSION</span>
          <span className="inst-date">{status?.status ?? "AWAITING DEPOSIT"}</span>
        </div>

        <div className="inst-body">
          <p className="text-[14.5px] leading-7">
            {settled ? (
              <>
                Settled. <span className="mono">{status?.settledUsdc ?? quote.amountOutFormatted}</span>{" "}
                {quote.destinationSymbol} is in <span className="mono">{quote.destinationNear}</span>.
              </>
            ) : ended ? (
              <>{status?.plain ?? "This swap has ended."}</>
            ) : (
              <>
                Send exactly <span className="mono font-medium">{quote.amountInFormatted}</span>{" "}
                {quote.sourceSymbol} on {quote.sourceChain} to the address below.
              </>
            )}
          </p>

          {!ended && status?.status !== "SUCCESS" ? (
            <div className="mt-6">
              <p className="field-label">Deposit address</p>
              <p className="mono mt-1 break-all text-[15px] font-medium leading-6">{quote.depositAddress}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" className="btn-ghost min-h-0 px-3 py-1.5 text-[12px]" onClick={() => void copy(quote.depositAddress, "address")}>
                  {copied === "address" ? "Address copied" : "Copy address"}
                </button>
              </div>
              <p className="mt-3 text-[12px] leading-5 text-ink-soft">
                Send only {quote.sourceSymbol} on {quote.sourceChain} to this address. Anything else, or
                any other chain, is not seen by the swap.
              </p>
              {quote.sourceChain === "near" ? (
                <p className="mt-2 text-[12px] leading-5 text-ink-soft">
                  {quote.sourceSymbol} is a token on NEAR, not the NEAR coin itself. Send it as a token
                  transfer from a wallet that holds {quote.sourceSymbol}: a plain NEAR transfer to this
                  address is a different thing and is not swapped.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-6 grid gap-4 border-t border-rule pt-5 text-[13px] sm:grid-cols-3">
            <div>
              <p className="field-label">You receive</p>
              <p className="mono mt-1">{quote.amountOutFormatted} {quote.destinationSymbol}</p>
            </div>
            <div>
              <p className="field-label">Paid to</p>
              <p className="mono mt-1 break-all">{quote.destinationNear}</p>
            </div>
            <div>
              <p className="field-label">1Click fee</p>
              <p className="mono mt-1">{quote.withdrawFee || "0"} {quote.destinationSymbol}</p>
            </div>
          </div>

          <p className="mt-3 text-[12.5px] leading-5 text-ink-soft">
            What you send is what lands: no conversion fee is taken, so the figure above arrives in full.
          </p>

          <p aria-live="polite" className="mt-5 text-[12.5px] leading-6 text-ink-soft">
            {statusNote ? statusNote : status?.plain ? status.plain : "Waiting for your deposit to arrive."}
            {quote.timeEstimate ? " Estimated swap time about " + quote.timeEstimate + "s after the deposit confirms." : ""}
          </p>

          {status?.status === "REFUNDED" && status.refundReason ? (
            <p className="mt-2 text-[12.5px] leading-6 text-stamp-ink">Refund reason: {status.refundReason}</p>
          ) : null}

          {proofLegs.length ? (
            <div className="mt-5 border-t border-rule pt-5">
              <p className="field-label">Proof on the chains</p>
              {proofLegs.map((leg) => {
                // The withdrawal always settles on NEAR; the deposit belongs to
                // the chain paid from. Each leg's bare hashes fall back to the
                // scanner they actually prove.
                const legChain = leg.label.startsWith("Withdrawal") ? "near" : quote.sourceChain;
                return (
                  <div key={leg.label} className="mt-3">
                    <p className="text-[12px] font-medium text-ink">{leg.label}</p>
                    <ul className="mt-1.5 space-y-1">
                      {leg.links.map((ref) => (
                        <li key={ref} className="mono break-all text-[12px]">
                          {proofRef(ref, legChain)}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {status?.status === "SUCCESS" ? (
                <p className="mt-3 text-[12px] leading-5 text-ink-soft">
                  The withdrawal leg is the one that matters: it is the transaction that put
                  the {quote.destinationSymbol} in <span className="mono">{quote.destinationNear}</span>.
                  The deposit leg is your payment reaching the swap.
                </p>
              ) : null}
            </div>
          ) : terminal ? (
            <p className="mt-5 border-t border-rule pt-5 text-[12px] leading-5 text-ink-soft">
              The swap ended before the route published any transaction references. Your wallet&rsquo;s
              own history of what it sent to the deposit address is the remaining proof.
            </p>
          ) : null}

          {(ended || settled) && quote && status ? (
            <div className="no-print mt-6 flex flex-wrap gap-3 border-t border-rule pt-5">
              <button
                type="button"
                className="btn-ghost min-h-0 px-3 py-2 text-[12px]"
                onClick={() =>
                  downloadCsv(
                    "settleform-conversion-" + quote.depositAddress.slice(0, 8) + ".csv",
                    CONVERSION_CSV_HEADER + "\n" + conversionCsvRow(liveRecord(quote, status)) + "\n"
                  )
                }
              >
                Download CSV
              </button>
              <button
                type="button"
                className="btn-ghost min-h-0 px-3 py-2 text-[12px]"
                onClick={() => void downloadReceiptPng(liveRecord(quote, status))}
              >
                Receipt PNG
              </button>
              <button type="button" className="btn-ghost min-h-0 px-3 py-2 text-[12px]" onClick={() => window.print()}>
                Print receipt
              </button>
            </div>
          ) : null}

          {ended || settled ? (
            <button type="button" className="btn-primary mt-6" onClick={startOver}>
              Convert something else
            </button>
          ) : (
            <button type="button" className="btn-ghost mt-6" onClick={startOver}>
              Start over
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
    <form onSubmit={submit} noValidate className="instrument mt-8">
      <div className="inst-head">
        <span>SETTLEFORM CONVERSION</span>
        <span className="inst-date">DRAFT</span>
      </div>

      <div className="inst-body">
        {error ? (
          <div ref={errorRef} tabIndex={-1} role="alert" className="notice mb-7">
            <p className="notice-title">{error}</p>
          </div>
        ) : null}

        <div className="space-y-6">
          <div>
            <label className="field-label" htmlFor="destinationNear">
              Your NEAR account <span aria-hidden="true">*</span>
            </label>
            <input
              id="destinationNear"
              className="field mono mt-2"
              value={destinationNear}
              onChange={(e) => setDestinationNear(e.target.value)}
              placeholder="you.near"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-required="true"
              aria-describedby="destination-help"
            />
            <p id="destination-help" className="helper">Mainnet account that receives the USDC.</p>
          </div>

          <div>
            <label className="field-label" htmlFor="originAsset">
              Pay with <span aria-hidden="true">*</span>
            </label>
            <select
              id="originAsset"
              className="field mt-2"
              value={originAsset}
              onChange={(e) => setOriginAsset(e.target.value)}
              aria-required="true"
            >
              {sources.map((s) => (
                <option key={s.assetId} value={s.assetId}>{s.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="refundAddress">
              Your {evm ? "0x" : "NEAR"} refund address <span aria-hidden="true">*</span>
            </label>
            <input
              id="refundAddress"
              className="field mono mt-2"
              value={refundAddress}
              onChange={(e) => setRefundAddress(e.target.value)}
              placeholder={evm ? "0x…" : "you.near"}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              aria-required="true"
              aria-describedby="refund-help"
            />
            <p id="refund-help" className="helper">
              Where funds return if the swap cannot complete. Check it: this is the only way back.
            </p>
          </div>
        </div>

        <div className="perforation" />

        <div className="grid gap-6 sm:grid-cols-[1fr_1.3fr] sm:items-start">
          <div>
            <label className="field-label" htmlFor="amount">
              You receive <span aria-hidden="true">*</span>
            </label>
            <input
              id="amount"
              className="field mono mt-2 text-[18px]"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="1.00"
              aria-required="true"
            />
            <p className="helper">USDC on NEAR. Two decimals at most.</p>
          </div>
          <div>
            {/* Spacer mirrors the label row opposite, so the button's top
                edge lands exactly on the input's top edge. Hidden from
                screen readers: it carries no meaning. */}
            <span aria-hidden="true" className="field-label hidden sm:block">&nbsp;</span>
            <button type="submit" className="btn-primary mt-2 w-full" disabled={busy}>
              {busy ? "Getting a quote…" : "Get a deposit address"}
            </button>
          </div>
        </div>

        <p className="mt-5 text-[12px] leading-5 text-ink-soft">
          A quote moves no money. You are shown the exact figure to send before anything leaves your wallet.
        </p>
      </div>
    </form>

    {history.length ? (
      <section aria-label="Past conversions" className="instrument no-print mt-8">
        <h2 className="sr-only">Past conversions</h2>
        <div className="inst-head">
          <span>CONVERSION HISTORY</span>
          <span className="inst-date">{history.length} KEPT</span>
        </div>
        <div className="inst-body">
          <p className="text-[12.5px] leading-6 text-ink-soft">
            Filed on the server, so the proof reads the same on any machine. Each row carries
            the same figures the invoice receipt prints, with proof and export.
          </p>
          <ul className="mt-5 space-y-0 border-t border-rule">
            {history.slice(historyPage * HISTORY_PAGE_SIZE, (historyPage + 1) * HISTORY_PAGE_SIZE).map((r) => (
              <li key={r.depositAddress} className="border-b border-rule py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <span className="mono text-[13px] font-medium">
                    {r.settledUsdc ?? r.amountOutFormatted} {r.destinationSymbol}
                  </span>
                  <span className="mono text-[11.5px] text-ink-soft">{r.status}</span>
                </div>
                <p className="mono mt-1 break-all text-[12px] text-ink-soft">
                  {r.amountInFormatted} {r.sourceSymbol} on {r.sourceChain} to {r.destinationNear}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(r.legs.length
                    ? r.legs.flatMap((leg) =>
                        leg.links.map((ref) => ({
                          ref,
                          chain: leg.label.startsWith("Withdrawal") ? "near" : r.sourceChain,
                        }))
                      )
                    : r.txRefs.map((ref) => ({ ref, chain: r.sourceChain }))).map(({ ref, chain }) => (
                    <span key={ref} className="mono text-[11.5px] text-ink-soft">
                      {proofRef(ref, chain)}
                    </span>
                  ))}
                  {!r.legs.length && !r.txRefs.length ? (
                    <span className="mono text-[11.5px] text-ink-soft">no references published</span>
                  ) : null}
                  <button
                    type="button"
                    className="mono text-[11.5px] underline underline-offset-4"
                    onClick={() => void downloadReceiptPng(r)}
                  >
                    receipt PNG
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-ghost min-h-0 px-3 py-1.5 text-[12px]"
              onClick={() =>
                downloadCsv(
                  "settleform-conversions.csv",
                  CONVERSION_CSV_HEADER + "\n" + history.map(conversionCsvRow).join("\n") + "\n"
                )
              }
            >
              Download all as CSV
            </button>
            {history.length > HISTORY_PAGE_SIZE ? (
              <nav aria-label="Conversion history pages" className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-ghost min-h-0 px-3 py-1.5 text-[12px]"
                  disabled={historyPage === 0}
                  onClick={() => setHistoryPage((p) => Math.max(0, p - 1))}
                >
                  Newer
                </button>
                <span className="mono text-[12px] text-ink-soft">
                  Page {historyPage + 1} of {Math.ceil(history.length / HISTORY_PAGE_SIZE)}
                </span>
                <button
                  type="button"
                  className="btn-ghost min-h-0 px-3 py-1.5 text-[12px]"
                  disabled={(historyPage + 1) * HISTORY_PAGE_SIZE >= history.length}
                  onClick={() => setHistoryPage((p) => p + 1)}
                >
                  Older
                </button>
              </nav>
            ) : null}
          </div>
        </div>
      </section>
    ) : null}
    </>
  );
}
