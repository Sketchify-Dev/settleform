"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The stamp is the only ornament in this design, and it lands once. It appears
 * where a real state exists, here the case the whole product is built around:
 * a refunded swap, and an invoice that still reads UNPAID because the money
 * never settled.
 *
 * It strikes when it is scrolled into view, overshoots slightly, and leaves a
 * second, lighter impression 2px off register, the way a hand stamp does. Under
 * `prefers-reduced-motion` it is already there: the global rule collapses the
 * timings, so the stamp is never the thing that is missing.
 */
export default function Stamp() {
  const ref = useRef<HTMLDivElement>(null);
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLanded(true);
          io.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure ref={ref} className="stamp-plate" data-landed={landed ? "true" : "false"}>
      <div className="flex flex-col gap-2">
        <span className="stamp-field">
          SWAP
          <b>REFUNDED</b>
        </span>
        <span className="stamp-field">
          REFUND
          <b>REFUNDED</b>
        </span>
        <span className="stamp-field">
          INVOICE
          <b>UNPAID</b>
        </span>
      </div>
      <div className="stamp-mark-wrap">
        <span className="stamp-mark stamp-mark-ghost" aria-hidden="true">
          UNPAID
        </span>
        <span className="stamp-mark" aria-hidden="true">
          UNPAID
        </span>
      </div>
      <figcaption className="sr-only">
        After a refunded swap the swap reads REFUNDED and the invoice still reads UNPAID.
      </figcaption>
    </figure>
  );
}
