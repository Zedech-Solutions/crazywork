"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Instagram, Trash2, Upload } from "lucide-react";
import { adminFetch, uploadFile } from "@/components/admin/api";
import { useConfirm } from "@/components/admin/confirm";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input, Label } from "@/components/ui/field";

interface ApiPhoto {
  id: string;
  imageUrl: string | null;
  caption: string | null;
  postUrl: string | null;
  sortOrder: number;
  published: boolean;
}

export default function AdminCommunityPage() {
  const [photos, setPhotos] = useState<ApiPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkCaption, setLinkCaption] = useState("");
  const confirm = useConfirm();

  const reload = useCallback(() => {
    adminFetch<{ photos: ApiPhoto[] }>("/community")
      .then((r) => setPhotos(r.photos))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      for (const file of [...files]) {
        const url = await uploadFile(file);
        await adminFetch("/community", {
          method: "POST",
          body: JSON.stringify({ imageUrl: url, sortOrder: photos.length }),
        });
      }
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await adminFetch("/community", {
        method: "POST",
        body: JSON.stringify({
          postUrl: linkUrl.trim(),
          caption: linkCaption.trim() || undefined,
          sortOrder: photos.length,
        }),
      });
      setLinkUrl("");
      setLinkCaption("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function update(id: string, data: Partial<ApiPhoto>) {
    await adminFetch(`/community/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    reload();
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Remove photo",
        message: "Remove this from the community grid?",
        confirmLabel: "Remove",
        danger: true,
      }))
    )
      return;
    await adminFetch(`/community/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="headline text-5xl">Community</h1>
        <label className="inline-flex h-11 cursor-pointer items-center gap-2 bg-ember px-6 subhead text-sm text-peach hover:bg-ink">
          <Upload size={15} /> {busy ? "Uploading…" : "Upload photos"}
          <input
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => add(e.target.files)}
          />
        </label>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {/* Add by Instagram link — no upload needed */}
      <form
        onSubmit={addLink}
        className="mt-6 flex flex-wrap items-end gap-2 rounded-2xl border border-warmgrey/60 bg-sand/40 p-4"
      >
        <Instagram size={18} className="mb-2 text-ember" />
        <div className="min-w-52 flex-1">
          <Label htmlFor="ig-url">Add by Instagram link</Label>
          <Input
            id="ig-url"
            placeholder="https://instagram.com/p/…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </div>
        <div className="min-w-40 flex-1">
          <Label htmlFor="ig-caption">Caption (optional)</Label>
          <Input
            id="ig-caption"
            placeholder="@handle — pull day"
            value={linkCaption}
            onChange={(e) => setLinkCaption(e.target.value)}
          />
        </div>
        <Button type="submit" variant="accent" disabled={busy}>
          {busy ? "Adding…" : "Add link"}
        </Button>
      </form>
      <p className="mt-1.5 text-xs text-brown">
        We&apos;ll try to pull the post&apos;s photo automatically. If Instagram
        doesn&apos;t expose it, the tile links straight to the post instead.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {photos.map((photo) => (
          <div key={photo.id} className="rounded-xl border border-warmgrey/60 bg-sand/40 p-2">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-ink">
              {photo.imageUrl ? (
                <Image
                  src={photo.imageUrl}
                  alt={photo.caption ?? ""}
                  fill
                  sizes="200px"
                  className={`object-cover ${photo.published ? "" : "opacity-40"}`}
                />
              ) : (
                <div className="flex flex-col items-center gap-1 text-peach/70">
                  <Instagram size={26} />
                  <span className="eyebrow text-[10px]">IG post</span>
                </div>
              )}
            </div>
            <Input
              className="mt-2 py-1.5 text-xs"
              placeholder="Caption (@handle)"
              defaultValue={photo.caption ?? ""}
              onBlur={(e) => update(photo.id, { caption: e.target.value })}
            />
            <Input
              className="mt-1.5 py-1.5 text-xs"
              placeholder="Instagram post URL (optional)"
              defaultValue={photo.postUrl ?? ""}
              onBlur={(e) => update(photo.id, { postUrl: e.target.value })}
            />
            <div className="mt-2 flex items-center justify-between text-xs">
              <CheckboxField
                label="Live"
                checked={photo.published}
                onCheckedChange={(v) => update(photo.id, { published: v })}
              />
              <button
                aria-label="Delete photo"
                className="text-warmgrey hover:text-red-700 cursor-pointer"
                onClick={() => remove(photo.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {photos.length === 0 && (
        <p className="mt-6 text-sm text-brown">No community photos yet.</p>
      )}
    </div>
  );
}
