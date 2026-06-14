"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Upload } from "lucide-react";
import { adminFetch, uploadFile } from "@/components/admin/api";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/field";

export type FormPageKey = "mindset" | "drops" | "footer" | "checkoutSuccess";

function Field({
  label,
  value,
  onChange,
  textarea,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  textarea?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {textarea ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
      {hint && <p className="mt-1 text-[11px] text-warmgrey">{hint}</p>}
    </div>
  );
}

function ImageField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
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
        <div className="relative h-20 w-32 shrink-0 overflow-hidden rounded-lg bg-ink">
          {value && (
            <Image src={value} alt="" fill sizes="128px" className="object-cover" />
          )}
        </div>
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-warmgrey px-3 py-2 text-xs hover:border-ink">
          <Upload size={13} /> {busy ? "Uploading…" : "Replace"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pick(e.target.files)}
          />
        </label>
      </div>
    </div>
  );
}

const TITLES: Record<FormPageKey, string> = {
  mindset: "Mindset page",
  drops: "Drops page",
  footer: "Footer (every page)",
  checkoutSuccess: "Checkout success page",
};

export function PageFormEditor({ pageKey }: { pageKey: FormPageKey }) {
  const [content, setContent] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setContent(null);
    adminFetch<{ content: Record<string, string> }>(`/page/${pageKey}`)
      .then((r) => setContent(r.content))
      .catch((e) => setError(e.message));
  }, [pageKey]);

  async function save() {
    if (!content) return;
    setBusy(true);
    setSaved(false);
    try {
      await adminFetch(`/page/${pageKey}`, {
        method: "PUT",
        body: JSON.stringify({ content }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (key: string, value: string) =>
    setContent((c) => (c ? { ...c, [key]: value } : c));

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!content) return <p className="text-sm text-brown">Loading…</p>;

  return (
    <div className="max-w-xl overflow-y-auto">
      <div className="flex items-center justify-between pb-4">
        <h2 className="subhead text-xl">{TITLES[pageKey]}</h2>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
          <Button variant="accent" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-warmgrey/60 bg-sand/40 p-5">
        {pageKey === "mindset" && (
          <>
            <ImageField
              label="Header background image"
              value={content.headerImage ?? ""}
              onChange={(v) => set("headerImage", v)}
            />
            <Field
              label="Small label"
              value={content.headerEyebrow ?? ""}
              onChange={(v) => set("headerEyebrow", v)}
            />
            <Field
              label="Title"
              value={content.headerTitle ?? ""}
              onChange={(v) => set("headerTitle", v)}
              textarea
              hint="Enter = new line. *word* = orange."
            />
            <Field
              label="Intro text"
              value={content.headerSub ?? ""}
              onChange={(v) => set("headerSub", v)}
              textarea
            />
          </>
        )}

        {pageKey === "drops" && (
          <>
            <Field
              label="Heading"
              value={content.title ?? ""}
              onChange={(v) => set("title", v)}
            />
            <Field
              label="Description"
              value={content.description ?? ""}
              onChange={(v) => set("description", v)}
              textarea
            />
          </>
        )}

        {pageKey === "footer" && (
          <>
            <Field
              label="Tagline (under the wordmark)"
              value={content.tagline ?? ""}
              onChange={(v) => set("tagline", v)}
            />
            <Field
              label="Blurb paragraph"
              value={content.blurb ?? ""}
              onChange={(v) => set("blurb", v)}
              textarea
            />
            <p className="text-[11px] text-warmgrey">
              Social links &amp; SSM number are in Settings → Store.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
