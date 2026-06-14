"use client";

import { useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { uploadFile } from "@/components/admin/api";
import { Label } from "@/components/ui/field";
import { isVideo } from "@/lib/media";

// Upload an image OR a video. Used everywhere the CMS exposes a replaceable
// background. Stored as a URL; the storefront <Media> renders the right tag.
export function MediaField({
  label,
  value,
  onChange,
  placeholderClassName = "bg-ink",
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  placeholderClassName?: string;
}) {
  const [busy, setBusy] = useState(false);
  async function pick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    try {
      onChange(await uploadFile(files[0]));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <Label>{label}</Label>
      <div className="flex items-center gap-3">
        <div
          className={`relative h-16 w-28 shrink-0 overflow-hidden rounded-lg border border-warmgrey/40 ${placeholderClassName}`}
        >
          {value &&
            (isVideo(value) ? (
              <video
                src={value}
                muted
                loop
                playsInline
                autoPlay
                className="h-full w-full object-cover"
              />
            ) : (
              <Image src={value} alt="" fill sizes="112px" className="object-cover" />
            ))}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-warmgrey px-3 py-2 text-xs hover:border-ink">
          <Upload size={13} /> {busy ? "Uploading…" : "Replace"}
          <input
            type="file"
            accept="image/*,video/*"
            className="hidden"
            onChange={(e) => pick(e.target.files)}
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-warmgrey">Image or video (mp4 / webm).</p>
    </div>
  );
}
