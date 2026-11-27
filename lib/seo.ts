// Canonical origin for metadata, robots and the sitemap. Production falls back to
// the live www host so a missing env var can never publish localhost URLs.
export const SITE_URL =
  process.env.BETTER_AUTH_URL ||
  (process.env.NODE_ENV === "production"
    ? "https://www.crazywork.store"
    : "http://localhost:3000");
