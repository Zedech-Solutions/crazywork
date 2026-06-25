"use client";

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

export async function uploadMedia(
  file: File,
): Promise<{ url: string; mediaType: "image" | "video" }> {
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
    headers: { "Content-Type": file.type },
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
