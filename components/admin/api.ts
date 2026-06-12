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

export async function uploadFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/admin/upload", { method: "POST", body: form });
  const body = await res.json();
  if (!res.ok || !body.ok) throw new Error(body.message ?? "Upload failed");
  return body.url as string;
}
