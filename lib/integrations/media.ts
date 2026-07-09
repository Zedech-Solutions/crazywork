export type MediaType = "image" | "video";

// Upload keys are content-unique (timestamp + random), so aggressive immutable
// caching is safe. Presigned PUTs sign this header — the browser upload must
// send the identical value (see components/admin/api.ts).
export const UPLOAD_CACHE_CONTROL = "public, max-age=31536000, immutable";

export type ValidateUploadResult =
  | { ok: true; mediaType: MediaType }
  | { ok: false; error: string };

const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

export function validateUpload(file: {
  contentType: string;
  size: number;
}): ValidateUploadResult {
  const mediaType: MediaType | null = IMAGE_TYPES.has(file.contentType)
    ? "image"
    : VIDEO_TYPES.has(file.contentType)
      ? "video"
      : null;

  if (!mediaType) {
    return { ok: false, error: `Unsupported file type: ${file.contentType}` };
  }

  const cap = mediaType === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
  if (file.size > cap) {
    const mb = Math.round(cap / (1024 * 1024));
    return { ok: false, error: `${mediaType} exceeds ${mb} MB limit` };
  }

  return { ok: true, mediaType };
}
