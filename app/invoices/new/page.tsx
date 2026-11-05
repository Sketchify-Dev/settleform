"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { amountInWords } from "@/lib/amount-words";
import { nearAccountError } from "@/lib/near-account";

type Field = "client" | "freelancerNear" | "amount" | "dueDate";

const MESSAGES: Record<Field, string> = {
  client: "Client name is required.",
  freelancerNear: "Enter a valid NEAR account, for example you.near.",
  amount: "Amount must be greater than 0.",
  dueDate: "Choose a due date.",
};

export default function NewInvoicePage() {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [freelancerNear, setFreelancerNear] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [dueDate, setDueDate] = useState("");
  const [desc, setDesc] = useState("Design services");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const clientRef = useRef<HTMLInputElement>(null);
  const nearRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const dueRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const refs: Record<Field, React.RefObject<HTMLInputElement | null>> = {
    client: clientRef,
    freelancerNear: nearRef,
    amount: amountRef,
    dueDate: dueRef,
  };

  function validate(): Partial<Record<Field, string>> {
    const next: Partial<Record<Field, string>> = {};
    if (!client.trim()) next.client = MESSAGES.client;
    const nearProblem = nearAccountError(freelancerNear);
    if (nearProblem) next.freelancerNear = nearProblem;
    const n = Number(amount);
    if (!amount.trim() || !Number.isFinite(n) || n <= 0) next.amount = MESSAGES.amount;
    if (!dueDate) next.dueDate = MESSAGES.dueDate;
    return next;
  }

  function focusFirstInvalid(next: Partial<Record<Field, string>>) {
    const order: Field[] = ["client", "freelancerNear", "amount", "dueDate"];
    const first = order.find((f) => next[f]);
    if (first) refs[first].current?.focus();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      focusFirstInvalid(next);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client,
          freelancerNear,
          amount,
          currency,
          dueDate,
          lineItems: [{ desc: desc.trim() || "Service", qty: 1, price: Number(amount) || 0 }],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setFormError(typeof data.error === "string" ? data.error : "Could not create the invoice.");
        setBusy(false);
        summaryRef.current?.focus();
        return;
      }
      router.push("/pay/" + data.invoice.id);
    } catch {
      setFormError("Network error. Check your connection and try again.");
      setBusy(false);
      summaryRef.current?.focus();
    }
  }

  const errorList = Object.entries(errors).filter(([, v]) => v) as [Field, string][];
  const words = amountInWords(amount, currency);

  return (
    <div className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="flex items-center justify-between gap-4 border-b border-rule py-5">
        <Logo />
        <Link href="/invoices" className="btn-ghost">Dashboard</Link>
      </header>

      <main id="main">
      <div className="pt-10">
        <h1 className="display text-[32px] sm:text-[40px]">New invoice</h1>
        <p className="mt-2 text-[14.5px] leading-7 text-ink-soft">
          The client gets a shareable pay link. USDC lands in your NEAR account.
        </p>
      </div>

      <form onSubmit={submit} noValidate className="instrument mt-8">
        <div className="inst-head">
          <span>SETTLEFORM INSTRUMENT</span>
          <span className="inst-date">DRAFT</span>
        </div>

        <div className="inst-body">
          {errorList.length > 0 ? (
            <div ref={summaryRef} tabIndex={-1} role="alert" className="notice mb-7">
              <p className="notice-title">
                Check {errorList.length === 1 ? "one field" : errorList.length + " fields"} before creating this invoice.
              </p>
              <ul className="mt-2 space-y-1">
                {errorList.map(([field, msg]) => (
                  <li key={field} className="text-[13px]">
                    <a href={"#" + field} className="underline underline-offset-4">{msg}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {formError ? (
            <div role="alert" tabIndex={-1} className="notice mb-7">
              <p className="notice-title">{formError}</p>
            </div>
          ) : null}

          <div className="space-y-6">
            <div>
              <label className="field-label" htmlFor="client">
                Client name <span aria-hidden="true">*</span>
              </label>
              <input
                id="client"
                ref={clientRef}
                className="field mt-2"
                value={client}
                onChange={(e) => { setClient(e.target.value); if (errors.client) setErrors((p) => ({ ...p, client: undefined })); }}
                placeholder="Acme Studio"
                autoComplete="organization"
                aria-required="true"
                aria-invalid={!!errors.client}
                aria-describedby={errors.client ? "client-error" : undefined}
              />
              {errors.client ? <p id="client-error" className="helper text-stamp-ink">{errors.client}</p> : null}
            </div>

            <div>
              <label className="field-label" htmlFor="freelancerNear">
                Your NEAR account <span aria-hidden="true">*</span>
              </label>
              <input
                id="freelancerNear"
                ref={nearRef}
                className="field mono mt-2"
                value={freelancerNear}
                onChange={(e) => { setFreelancerNear(e.target.value); if (errors.freelancerNear) setErrors((p) => ({ ...p, freelancerNear: undefined })); }}
                placeholder="you.near"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-required="true"
                aria-invalid={!!errors.freelancerNear}
                aria-describedby={errors.freelancerNear ? "near-error" : "near-help"}
              />
              {errors.freelancerNear ? (
                <p id="near-error" className="helper text-stamp-ink">{errors.freelancerNear}</p>
              ) : (
                <p id="near-help" className="helper">Mainnet account that receives the USDC settlement.</p>
              )}
            </div>
          </div>

          <div className="perforation" />

          <div className="grid gap-6 sm:grid-cols-[1.4fr_0.8fr_1fr]">
            <div>
              <label className="field-label" htmlFor="amount">
                Amount <span aria-hidden="true">*</span>
              </label>
              <input
                id="amount"
                ref={amountRef}
                className="field mono mt-2 text-[18px]"
                inputMode="decimal"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); if (errors.amount) setErrors((p) => ({ ...p, amount: undefined })); }}
                placeholder="250.00"
                aria-required="true"
                aria-invalid={!!errors.amount}
                aria-describedby={errors.amount ? "amount-error" : "amount-words"}
              />
              {errors.amount ? <p id="amount-error" className="helper text-stamp-ink">{errors.amount}</p> : null}
            </div>
            <div>
              <label className="field-label" htmlFor="currency">Currency</label>
              <select id="currency" className="field mt-2" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="dueDate">
                Due date <span aria-hidden="true">*</span>
              </label>
              <input
                id="dueDate"
                ref={dueRef}
                type="date"
                className="field mono mt-2"
                value={dueDate}
                onChange={(e) => { setDueDate(e.target.value); if (errors.dueDate) setErrors((p) => ({ ...p, dueDate: undefined })); }}
                aria-required="true"
                aria-invalid={!!errors.dueDate}
                aria-describedby={errors.dueDate ? "due-error" : undefined}
              />
              {errors.dueDate ? <p id="due-error" className="helper text-stamp-ink">{errors.dueDate}</p> : null}
            </div>
          </div>

          <p
            id="amount-words"
            className="mt-3 text-[11.5px] uppercase leading-5 tracking-[0.08em] text-ink-soft"
          >
            {words ?? "The amount prints here in words as you type it."}
          </p>
          <p className="mt-1 text-[12.5px] leading-6 text-ink-soft">
            The amount is stated twice on the instrument, in figures and in words, so a missing zero
            is visible before the invoice is sent. Currency is display only.
          </p>

          <div className="mt-6">
            <label className="field-label" htmlFor="desc">Line item</label>
            <input
              id="desc"
              className="field mt-2"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Design services"
            />
            <p className="helper">Shown on the invoice and in the receipt record.</p>
          </div>
        </div>

        <div className="border-t border-rule bg-field px-6 py-5 sm:px-7">
          <div className="flex flex-wrap gap-3">
            <button type="submit" className="btn-primary" disabled={busy}>
              {busy ? (<><span className="spinner" aria-hidden="true" /> Creating...</>) : "Create invoice"}
            </button>
            <Link href="/invoices" className="btn-ghost">Cancel</Link>
          </div>
        </div>

        <div className="inst-foot">
          <span>Nothing is issued until you create it.</span>
          <span className="mono">draft</span>
        </div>
      </form>
      </main>
    </div>
  );
}
