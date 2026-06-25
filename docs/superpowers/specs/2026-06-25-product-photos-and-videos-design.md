# Product Photos + Videos — Design

**Date:** 2026-06-25
**Status:** Approved (design)

## Goal

Let products carry **videos alongside photos**. Videos are ordered media items
in the same gallery as photos (one unified list), uploaded as files to
Cloudflare R2 like images. Videos play on the PDP gallery (click-to-play with
controls + sound) and appear on grid/listing cards (muted autoplay on hover).

## Decisions (from brainstorming)

- **Gallery model:** Mixed — videos are ordered gallery items, interleaved with
  photos via the existing `sortOrder`. Index 0 = cover, index 1 = hover.
- **Where shown:** PDP gallery **and** grid cards.
- **PDP playback:** Click-to-play with full controls and sound.
- **Card playback:** Muted autoplay + loop on hover; click navigates to PDP.
- **Source:** Uploaded files to R2 (no external embeds).

## Data Model (`prisma/schema.prisma`)

- Add enum:
  ```prisma
  enum MediaType {
    image
    video
  }
  ```
- Add field to `ProductImage`:
  ```prisma
  mediaType MediaType @default(image)
  ```
- Keep `imageUrl` as the generic media URL for both images and videos (rename
  avoided to keep churn low; the column is just "the media URL").
- Migration: additive column with `@default(image)` backfills all existing rows
  as `image`. No data loss.

## Upload Endpoint (`server/routes/admin.ts`, `POST /api/admin/upload`)

Currently accepts any file with no validation. Add:

- **MIME allowlist:**
  - Images: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `image/avif`
  - Videos: `video/mp4`, `video/webm`, `video/quicktime`
- **Size caps:** images ≤ 10 MB, videos ≤ 50 MB. Reject oversize/disallowed with
  HTTP 400 and a clear message.
- **Response:** `{ ok: true, url, mediaType }` where `mediaType` is derived from
  the content-type prefix (`video/*` → `video`, else `image`).

## Admin Product Editor (`app/admin/(panel)/products/page.tsx`)

- File input: `accept="image/*,video/*"`.
- `ProductForm` media items carry `mediaType` (`{ imageUrl, alt, mediaType }`).
- `addImages` records `mediaType` from the upload response per file.
- Media tiles: render a muted `<video preload="metadata">` first frame with a
  small play badge for video items; `<img>`/`<Image>` for photos. Drag-reorder
  and Cover/Hover labels unchanged.
- Save payload includes `mediaType` per item.

## Server Read/Write

- **Product create/update** handlers accept and persist `mediaType` on each
  `ProductImage` (default `image` when absent, for safety).
- **Serializers** (PDP product builder + card product builder) include
  `mediaType` so the frontend can branch.

## PDP Gallery (`components/product/pdp-client.tsx`)

- `PdpProduct.images` items gain `type: "image" | "video"`.
- **Main stage:** if current item is video → `<video controls preload="metadata"
  className="object-cover">` (click-to-play, with sound). Else existing
  `<Image>`. Carousel prev/next arrows operate on index, unchanged.
- **Thumbnail strip:** video thumbnails show the first frame (muted
  `<video preload="metadata">`) with a small play-icon badge overlay. Selecting
  a thumb works the same as for photos.
- `addToCart` line image: fall back to the first **image**-type item's URL (a
  video URL is a poor cart thumbnail). If none, use first item.

## Product Card Grid (`components/site/product-card.tsx`)

- `CardProduct` gains `imageType` and `hoverImageType` (`"image" | "video"`).
- **Video cover:** render `<video muted loop playsInline preload="metadata">`
  showing the first frame; autoplay (muted, loop) on group hover, matching the
  existing hover-reveal motion. Click navigates to PDP (existing `<Link>`).
- **Photo cover:** unchanged.
- Hover image: if the hover item is a video, same muted-loop treatment; if a
  photo, unchanged.

## Out of Scope (YAGNI)

- Separate poster-image upload (use the video's first frame).
- External/YouTube embeds.
- Video transcoding / multiple resolutions / thumbnails generation.
- Per-variant video.

## Testing

- Upload endpoint: rejects disallowed MIME and oversize files (400); accepts
  allowed image and video types; returns correct `mediaType`.
- Migration applies cleanly and backfills existing `ProductImage` rows as
  `image`.
- Manual: admin uploads a video, reorders it to cover, saves; PDP plays it with
  controls; grid card shows first frame and autoplays muted on hover; cart line
  uses a photo thumbnail.
