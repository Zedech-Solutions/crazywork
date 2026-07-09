"use client";

import { UPLOAD_CACHE_CONTROL } from "@/lib/integrations/media";

// Thin client for /api/admin/* — throws on non-2xx with the server message.
export async function adminFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return body as T;
}

// Images are served unoptimized (Vercel optimizer quota — see next.config.ts),
// so compress in the browser before upload: downscale to ≤1600px WebP. Videos,
// GIFs (animation) and SVGs pass through untouched. Fails open — any error or
// a larger result falls back to uploading the original file unchanged.
const MAX_UPLOAD_DIMENSION = 1600;
const COMPRESS_SKIP_BYTES = 300 * 1024; // small-and-small images aren't worth re-encoding
const WEBP_QUALITY = 0.82;

async function compressImage(file: File): Promise<File> {
  const compressible = ["image/jpeg", "image/png", "image/webp", "image/avif"];
  if (!compressible.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    try {
      const largestSide = Math.max(bitmap.width, bitmap.height);
      if (largestSide <= MAX_UPLOAD_DIMENSION && file.size <= COMPRESS_SKIP_BYTES) {
        return file;
      }
      const scale = Math.min(1, MAX_UPLOAD_DIMENSION / largestSide);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/webp", WEBP_QUALITY),
      );
      if (!blob || blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
      return new File([blob], name, { type: "image/webp" });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

export async function uploadMedia(
  original: File,
): Promise<{ url: string; mediaType: "image" | "video" }> {
  const file = await compressImage(original);
  // 1) Ask our API for a short-lived signed URL (validates type + size).
  const res = await fetch("/api/admin/upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: file.name,
      contentType: file.type,
      size: file.size,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(body.message ?? `Upload failed (${res.status})`);
  }
  // 2) Upload the file straight to R2 — bypasses the function body-size limit.
  const put = await fetch(body.uploadUrl as string, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
      // Must exactly match the presigned CacheControl (part of the signature).
      "Cache-Control": UPLOAD_CACHE_CONTROL,
    },
    body: file,
  });
  if (!put.ok) {
    throw new Error(`Upload to storage failed (${put.status})`);
  }
  return { url: body.publicUrl as string, mediaType: body.mediaType ?? "image" };
}

export async function uploadFile(file: File): Promise<string> {
  return (await uploadMedia(file)).url;
}
