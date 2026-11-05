import type { MetadataRoute } from "next";
import { PRIVATE_PREFIXES, SITE_URL } from "@/lib/site";

/**
 * The build has no auth. The register lists client names and amounts, and every
 * pay link is a capability URL, so neither is offered to a crawler, and neither
 * is the API, which answers questions about invoices to anyone holding an id.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [...PRIVATE_PREFIXES],
      },
    ],
    sitemap: SITE_URL + "/sitemap.xml",
    host: SITE_URL,
  };
}
