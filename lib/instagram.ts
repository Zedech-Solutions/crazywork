// Best-effort: pull the preview thumbnail from a public Instagram post URL by
// reading its og:image meta tag. We only trust URLs served from Instagram/FB
// CDNs — otherwise (login wall, generic logo) we return null and the item
// renders as a branded link tile. No API key required; not guaranteed.

const TRUSTED_HOSTS = ["cdninstagram.com", "fbcdn.net"];

export function isInstagramUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "instagram.com" || host.endsWith(".instagram.com");
  } catch {
    return false;
  }
}

export async function fetchInstagramThumbnail(
  postUrl: string,
): Promise<string | null> {
  if (!isInstagramUrl(postUrl)) return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(postUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; CrazyworkBot/1.0; +https://crazywork.my)",
        Accept: "text/html",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const html = await res.text();
    const match =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const candidate = match?.[1];
    if (!candidate) return null;
    const decoded = candidate.replace(/&amp;/g, "&");
    const host = new URL(decoded).hostname;
    return TRUSTED_HOSTS.some((h) => host.endsWith(h)) ? decoded : null;
  } catch {
    return null;
  }
}
