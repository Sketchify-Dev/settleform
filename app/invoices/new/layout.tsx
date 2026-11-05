import type { Metadata } from "next";

// The page itself is a client component, so metadata lives in this layout.
export const metadata: Metadata = {
  title: "New invoice",
  description:
    "Create an invoice, choose the NEAR account that receives USDC, and get a shareable pay link your client can open without an account.",
  // No canonical: this route is noindex, and a self-canonical would
  // contradict that. Only the indexable landing page names one.
  robots: { index: false, follow: false },
};

export default function NewInvoiceLayout({ children }: { children: React.ReactNode }) {
  return children;
}
