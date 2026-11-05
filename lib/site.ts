/**
 * Single source of truth for the public origin.
 *
 * There is no custom domain yet. Set NEXT_PUBLIC_SITE_URL (or edit the fallback
 * below) and metadataBase, canonical URLs and absolute asset URLs all move
 * together.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const SITE_NAME = "Settleform";

export const SITE_DESCRIPTION =
  "Create a shareable invoice, let clients pay with supported tokens from supported chains, and receive USDC on NEAR through NEAR Intents.";

/**
 * Routes safe to index. Deliberately only the landing page: this build has no
 * auth, so /invoices lists client names and amounts, and /pay/[id] links are
 * unguessable capability URLs. Neither belongs in a search index.
 */
export const INDEXABLE_ROUTES = ["/"] as const;

/**
 * Routes kept out of search results. Mirrors the disallow list in
 * `app/robots.ts`, and each page under these prefixes also sets
 * `robots: { index: false }` in its own metadata, so a crawler that reaches one
 * anyway is told twice.
 */
export const PRIVATE_PREFIXES = ["/api/", "/invoices", "/pay/"] as const;
