"use client";

import { useEffect, useRef, useState } from "react";
import supportedAssets from "@/data/supported-assets.json";

/**
 * The hero instrument advances through the payment's real states as the page
 * scrolls. It is deliberately scroll-linked rather than a one-shot entrance
 * animation: a load animation plays once and is forgotten, but an instrument
 * that steps through UNPAID, quoted, deposit issued and settled keeps making
 * the product's argument for as long as the visitor is looking at it.
 *
 * Only the field that actually changed moves between frames. The three state
 * fields at the foot are separate for the same reason they are separate in the
 * product: an invoice state and a swap state are not the same fact.
 */

type Frame = {
  id: string;
  route: string | null;
  receive: string | null;
  deposit: string | null;
  stamp: { label: string; tone: "due" | "settled" };
  /** Invoice state, swap state, refund state. Three facts, three fields, and
   *  between frames only the ones that actually changed move. */
  micr: [string, string, string];
  foot: string;
  caption: string;
};

const FRAMES: Frame[] = [
  {
    id: "unpaid",
    route: null,
    receive: null,
    deposit: null,
    stamp: { label: "UNPAID", tone: "due" },
    micr: ["UNPAID", "NOT STARTED", "NONE"],
    foot: "No quote requested yet.",
    caption: "The invoice exists, and no network has been asked for anything.",
  },
  {
    id: "quoted",
    route: "ETH on Ethereum",
    receive: "249.31",
    deposit: null,
    stamp: { label: "UNPAID", tone: "due" },
    micr: ["UNPAID", "QUOTED", "NONE"],
    foot: "Quote is a dry run. Nothing moved.",
    caption:
      "The client picks a token they already hold and a quote comes back. On the live pay page that quote is the 1Click API's; nothing has moved yet on either.",
  },
  {
    id: "deposit",
    route: "ETH on Ethereum",
    receive: "249.31",
    deposit: "0x7a3f9c2144b8e0d56f18",
    stamp: { label: "UNPAID", tone: "due" },
    micr: ["UNPAID", "PENDING_DEPOSIT", "NONE"],
    foot: "Deposit address issued for this route only.",
    caption:
      "A deposit address is issued for that one route. The swap is pending, and the invoice still reads unpaid.",
  },
  {
    id: "settled",
    route: "ETH on Ethereum",
    receive: "249.31",
    deposit: null,
    stamp: { label: "PAID", tone: "settled" },
    micr: ["PAID", "SUCCESS", "NONE"],
    foot: "Swap success. USDC landed in you.near.",
    caption: "The swap succeeded. Now, and only now, does the invoice say PAID.",
  },
  {
    id: "refunded",
    route: "ETH on Ethereum",
    receive: null,
    deposit: null,
    stamp: { label: "UNPAID", tone: "due" },
    micr: ["UNPAID", "REFUNDED", "REFUNDED"],
    foot: "Deposit returned to the sender.",
    caption:
      "The swap was refunded and the deposit went back to the sender. Nothing settled, so the invoice still reads UNPAID. It never borrows the word PAID.",
  },
];

/**
 * Every route the 1Click API verified, not a chosen three. The flow diagram below
 * is drawn from this list, so a fifth verified route would add its own line
 * instead of needing a redraw.
 */
const SOURCES: string[] = supportedAssets.sources.map((source) => source.label);

export default function HeroInstrument() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const rect = track.getBoundingClientRect();
      const distance = rect.height - window.innerHeight;
      if (distance <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / distance));
      setIndex(Math.min(FRAMES.length - 1, Math.floor(progress * FRAMES.length)));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const current = FRAMES[index];
  const settled = current.id === "settled";
  const activeSource = current.route ? SOURCES.indexOf(current.route) : -1;
  const line = (i: number) => (i === activeSource ? "var(--ink)" : "var(--rule)");
  const weight = (i: number) => (i === activeSource ? 1.6 : 1);

  return (
    <div ref={trackRef} className="relative h-[380vh] md:h-[400vh]">
      <div className="sticky top-6">
        <div className="instrument hero-instrument">
          <div className="inst-head">
            <span>SETTLEFORM INSTRUMENT</span>
            {/* Five printed marks, filled up to the frame on screen: the
                instrument is its own scroll indicator. */}
            <span className="flex items-center gap-4">
              <span className="inst-progress" aria-hidden="true">
                {FRAMES.map((frame, i) => (
                  <span key={frame.id} data-on={i <= index ? "true" : "false"} />
                ))}
              </span>
              <span className="inst-date">2026-11-02</span>
            </span>
          </div>

          <div className="inst-body">
            <div className="inst-row">
              <div>
                <div className="field-label">PAY TO</div>
                <div className="inst-payto">you.near</div>
              </div>
              <div className="inst-amount">
                <div className="field-label">AMOUNT</div>
                <div className="inst-fig">250.00</div>
                <div className="inst-cur">USD</div>
              </div>
            </div>

            <p className="inst-words">
              TWO HUNDRED AND FIFTY US DOLLARS AND 00/100
            </p>

            <p className="inst-memo">
              <b>MEMO</b> &nbsp; Invoice 0042 &nbsp;/&nbsp; Acme Studio &nbsp;/&nbsp; due 14 Nov
            </p>

            <div className="inst-routing">
              <div className="inst-srcs">
                {SOURCES.map((source) => (
                  <div
                    key={source}
                    className="inst-src"
                    data-on={current.route === source ? "true" : "false"}
                  >
                    <i aria-hidden="true" />
                    {source}
                  </div>
                ))}
              </div>

              <div className="inst-flow hidden md:block">
                <svg
                  width="100%"
                  height="96"
                  viewBox="0 0 320 96"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  {SOURCES.map((source, i) => {
                    const count = SOURCES.length;
                    const y = count === 1 ? 48 : 8 + (i * 80) / (count - 1);
                    const fixed = y.toFixed(1);
                    return (
                      <path
                        key={source}
                        d={`M0 ${fixed} H150 C196 ${fixed} 196 48 232 48`}
                        fill="none"
                        stroke={line(i)}
                        strokeWidth={weight(i)}
                        vectorEffect="non-scaling-stroke"
                      />
                    );
                  })}
                  <path
                    d="M232 48 H320"
                    fill="none"
                    stroke={activeSource >= 0 ? "var(--ink)" : "var(--rule)"}
                    strokeWidth="1.6"
                    vectorEffect="non-scaling-stroke"
                  />
                </svg>
                <span className="inst-node" data-on={settled ? "true" : "false"} aria-hidden="true" />
              </div>

              <div className="inst-dest">
                {current.receive ? (
                  <div className="inst-fig">{current.receive}</div>
                ) : (
                  <div className="inst-blank" aria-hidden="true" />
                )}
                <div className="inst-unit">
                  USDC
                  <br />
                  ON NEAR
                </div>
              </div>
            </div>

            {current.deposit ? (
              <div className="inst-deposit">
                <span className="field-label">DEPOSIT ADDRESS</span>
                <span className="mono">{current.deposit}</span>
              </div>
            ) : null}

            <div className="inst-micr">
              <span key={"inv" + current.micr[0]} className="inst-mf inst-mf-strike">
                <span className="inst-tick" aria-hidden="true"><b /></span>
                <span>INVOICE {current.micr[0]}</span>
                <span className="inst-tick" aria-hidden="true"><b /></span>
              </span>
              <span key={"swap" + current.micr[1]} className="inst-mf inst-mf-strike">
                SWAP {current.micr[1]}
              </span>
              <span key={"refund" + current.micr[2]} className="inst-mf inst-mf-strike">
                REFUND {current.micr[2]}
              </span>
              <span className="inst-stamp" data-tone={current.stamp.tone}>
                <s aria-hidden="true" />
                {current.stamp.label}
              </span>
            </div>
          </div>

          <div className="inst-foot">
            <span>Sample invoice. No funds move on this page.</span>
            <span className="mono">{current.foot}</span>
          </div>
        </div>

        <div className="mt-4 grid gap-2 border-t border-rule pt-3 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-baseline sm:gap-6">
          <span className="field-label">Note</span>
          <p className="max-w-[68ch] text-[13px] leading-6 text-ink-soft" aria-live="polite">
            {current.caption}
          </p>
        </div>
      </div>
    </div>
  );
}
