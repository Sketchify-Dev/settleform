import Link from "next/link";
import Logo from "@/components/Logo";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 sm:px-8">
      <a href="#main" className="skip-link">Skip to content</a>
      <header className="border-b border-rule py-5">
        <Logo />
      </header>
      <main id="main">
        <div className="instrument mt-8">
          <div className="inst-head">
            <span>INSTRUMENT NOT FOUND</span>
            <span className="inst-date">-</span>
          </div>
          <div className="inst-body">
            <h1 className="display text-[30px] sm:text-[36px]">This page is not here.</h1>
            <p className="measure mt-3 text-[14px] leading-6 text-ink-soft">
              The invoice link may be wrong or expired. Nothing was charged and nothing
              moved; the record you want is on the register.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/" className="btn-primary">Home</Link>
              <Link href="/invoices" className="btn-ghost">Dashboard</Link>
            </div>
          </div>
          <div className="inst-foot">
            <span>No funds move on a missing page.</span>
            <span className="mono">404</span>
          </div>
        </div>
      </main>
    </div>
  );
}
