import type { MetadataRoute } from "next";
import { INDEXABLE_ROUTES, SITE_URL } from "@/lib/site";

/**
 * One entry, because one route is indexable. SITE_URL is the only place the
 * public origin is decided, so this follows whatever NEXT_PUBLIC_SITE_URL says.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_ROUTES.map((path) => ({
    url: SITE_URL + path,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 1,
  }));
}
