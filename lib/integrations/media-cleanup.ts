// Pure helpers for working out which uploaded media is no longer referenced
// and should be removed from storage. No I/O — callers feed these into
// deleteObjects().

export function removedUrls(
  oldUrls: (string | null | undefined)[],
  newUrls: (string | null | undefined)[],
): string[] {
  const kept = new Set(newUrls.filter(Boolean) as string[]);
  return (oldUrls.filter(Boolean) as string[]).filter((u) => !kept.has(u));
}

interface ContentBlock {
  type: string;
  data: Record<string, unknown>;
}

// Collects every uploaded image URL referenced by a content post: its cover
// plus `image` (data.url) and `image_grid` (data.images[].url) blocks.
export function contentMediaUrls(
  coverImageUrl: string | null | undefined,
  blocks: ContentBlock[],
): string[] {
  const urls: string[] = [];
  if (coverImageUrl) urls.push(coverImageUrl);
  for (const block of blocks) {
    if (block.type === "image") {
      const url = block.data?.url;
      if (typeof url === "string" && url) urls.push(url);
    } else if (block.type === "image_grid") {
      const images = block.data?.images;
      if (Array.isArray(images)) {
        for (const img of images) {
          const url = (img as { url?: unknown })?.url;
          if (typeof url === "string" && url) urls.push(url);
        }
      }
    }
  }
  return urls;
}
