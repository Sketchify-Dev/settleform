import type { NextConfig } from "next";

/**
 * A pay link is a capability URL: whoever holds it can read the invoice and pay it.
 * So none of it should be able to talk to anywhere but here.
 *
 * Everything this app loads is now same-origin, including the type, which is why
 * `default-src 'self'` costs nothing. Inline script and style are still required:
 * Next ships its hydration data inline, and the app sets a few inline styles.
 */
const isDev = process.env.NODE_ENV !== "production";

const CSP = [
  "default-src 'self'",
  "base-uri 'none'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  ["script-src 'self' 'unsafe-inline'", isDev ? "'unsafe-eval'" : ""].join(" ").trim(),
  ["connect-src 'self'", isDev ? "ws: wss:" : ""].join(" ").trim(),
  // Turbopack dev runs a worker from a blob URL; nothing in the product does.
  isDev ? "worker-src 'self' blob:" : "worker-src 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // Keep source maps out of the shipped browser bundle.
  productionBrowserSourceMaps: false,

  /**
   * Headers, not middleware: these are the same on a page, an API response and a
   * static asset, and none of them needs to read the request.
   *
   * `Referrer-Policy: no-referrer` matters more here than on an ordinary site. The
   * invoice id is in the path, so the default policy would hand it to whatever site
   * a reader clicked through to next.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
      // Belt and braces with the per-route `robots` metadata: an invoice is not for
      // an index, whichever crawler is asking.
      {
        source: "/pay/:id",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
      {
        source: "/api/:path*",
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },

  turbopack: {
    // Pin the workspace root. Without this, Turbopack walks up to the home
    // directory and warns that it ignored the lockfile it found there.
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
