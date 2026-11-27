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
    // Without this, twitter:image stays the site-wide app/twitter-image.png.
    ...(image ? { twitter: { card: "summary_large_image", images: [image] } } : {}),
  };
}

const TITLE_MAX = 60;
const BRAND_SUFFIX = " | CRAZYWORK Malaysia";

// Appends the brand when it fits in ~60 chars; a title that already names the
// brand only gets the location, so the brand isn't said twice.
export function brandTitle(title: string): string {
  const t = title.trim();
  const suffixes = /crazywork/i.test(t) ? [" | Malaysia"] : [BRAND_SUFFIX, " | CRAZYWORK"];
  return suffixes.map((s) => t + s).find((full) => full.length <= TITLE_MAX) ?? t;
}

const words = (s: string) =>
  s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map((w) => w.replace(/s$/, ""));

// "<name> · <category> | CRAZYWORK Malaysia". The category is left out when the
// name already says it ("Muscle Tee · Muscle Tee") or the title would run long.
export function productTitle(name: string, category: string | null): string {
  const base = name.trim().replace(/^crazywork\s+/i, "") || name.trim();
  const nameWords = new Set(words(base));
  const full = `${base} · ${category}${BRAND_SUFFIX}`;
  return category &&
    !words(category).every((w) => nameWords.has(w)) &&
    full.length <= TITLE_MAX
    ? full
    : brandTitle(base);
}

// Admin metaTitles under 30 chars are placeholders ("Crazywork shirt"); they
// lose to a title built from the page's own name.
export function seoTitle(admin: string | null | undefined, built: string): string {
  return admin && admin.trim().length >= 30 ? admin.trim() : built;
}

// Cuts at a word boundary so a snippet never ends mid-word.
export function trimAtWord(text: string, max = 155): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const end = cut.lastIndexOf(" ");
  return `${(end > 0 ? cut.slice(0, end) : cut).replace(/[\s,;:.—–-]+$/, "")}…`;
}

// Admin metaDescriptions under 70 chars are placeholders ("pants"); they lose
// to the page's own text, trimmed to snippet length.
export function metaDescription(
  admin: string | null | undefined,
  text: string | null | undefined,
  fallback: string,
): string {
  if (admin && admin.trim().length >= 70) return admin.trim();
  return text?.trim() ? trimAtWord(text) : fallback;
}
