import type { Metadata } from "next";
import localFont from "next/font/local";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import "./globals.css";

// Archivo carries the whole interface. Its width axis is what makes the display
// type read as printed institution rather than as a screen headline.
//
// Both families are self-hosted from `app/fonts` rather than fetched from Google
// Fonts at build time. `next/font/google` downloads on compile, and a dev server
// that started without a working connection compiled this file with the download
// failed: Next emitted only an Arial fallback face under the same family name, so
// the whole instrument silently set in Arial and nothing anywhere said so. A font
// on the critical path of a demo is a font that will fail in the room. The files
// are the latin subset of each variable font, which is the same subset and the
// same axes the Google loader was asked for, with the licences beside them.
const archivo = localFont({
  src: "./fonts/Archivo-Variable-latin.woff2",
  variable: "--font-archivo",
  display: "swap",
  weight: "100 900",
  style: "normal",
  adjustFontFallback: "Arial",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

// Martian Mono is for money and machine-readable values only. Wide by
// construction, so every figure sits on the same grid as every other.
const martian = localFont({
  src: "./fonts/MartianMono-Variable-latin.woff2",
  variable: "--font-martian",
  display: "swap",
  weight: "100 800",
  style: "normal",
  adjustFontFallback: "Arial",
  declarations: [{ prop: "font-stretch", value: "75% 112.5%" }],
});

const TITLE = "Settleform, cross-chain invoicing settled in USDC on NEAR";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s | " + SITE_NAME },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  category: "finance",
  // No site-wide canonical here: it would be inherited by every route, making
  // each page claim to be whichever URL the layout named. Routes declare their own.
  robots: { index: true, follow: true, googleBot: { index: true, follow: true } },
  // The share card is generated from app/opengraph-image.tsx (1200x630, static at
  // build). twitter-image falls back to the same file per route-segment rules.
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Settleform: invoice a client, or convert it yourself. Either way, USDC lands on NEAR." }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${martian.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
