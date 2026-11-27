import type { Metadata } from "next";

// Canonical origin for metadata, robots and the sitemap. Production falls back to
// the live www host so a missing env var can never publish localhost URLs.
export const SITE_URL =
  process.env.BETTER_AUTH_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://www.crazywork.store"
    : "http://localhost:3000");

export const SITE_NAME = "CRAZYWORK";
const DEFAULT_SHARE_IMAGE = "/opengraph-image.png";

// Self canonical + og:url for an indexable page (paths resolve against
// metadataBase). Next replaces a parent's openGraph object instead of merging
// it, so the site-wide og fields and the default share image are repeated here.
export function pageMeta(
  path: string,
  image?: string | null,
  type: "website" | "article" = "website",
): Metadata {
  return {
    alternates: { canonical: path },
    openGraph: {
      siteName: SITE_NAME,
      locale: "en_MY",
      type,
      url: path,
      images: [image || DEFAULT_SHARE_IMAGE],
    },
  };
}
