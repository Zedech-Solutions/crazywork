"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Plus, Trash2, Upload, X } from "lucide-react";
import { adminFetch, uploadFile } from "@/components/admin/api";
import type { PreviewRegion } from "@/components/admin/home-preview";
import type { FormPageKey } from "@/components/admin/page-form-editor";
import { VisualPageBuilder } from "@/components/admin/visual-page-builder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const PAGE_TABS: { key: "home" | FormPageKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "mindset", label: "Mindset" },
  { key: "drops", label: "Drops" },
  { key: "footer", label: "Footer" },
];
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Label, Textarea } from "@/components/ui/field";
import { DEFAULT_HOME_CONTENT, type HomeContent } from "@/lib/content";

const PAGE_OPTIONS = [
  { label: "Shop page", value: "/shop" },
  { label: "Drops page", value: "/drops" },
  { label: "Mindset page", value: "/mindset" },
  { label: "Our Story page", value: "/our-story" },
  { label: "Blog", value: "/blog" },
  { label: "Collab page", value: "/collab" },
  { label: "Community page", value: "/community" },
  { label: "FAQ page", value: "/faq" },
  { label: "Home page", value: "/" },
];

const REGION_TITLES: Record<PreviewRegion, string> = {
  announcement: "Announcement bar",
  hero: "Top banner",
  marquee: "Scrolling banner",
  featured: "Featured section label",
  mindsetTile: "Mindset tile",
  storyTile: "Our Story tile",
  community: "Community section label",
};

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

function LinkField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const isKnown = PAGE_OPTIONS.some((o) => o.value === value);
  const [custom, setCustom] = useState(!isKnown && value !== "");
  return (
    <div>
      <Label>{label}</Label>
      <Dropdown
        value={custom ? "__custom__" : value}
        onValueChange={(v) => {
          if (v === "__custom__") setCustom(true);
          else {
            setCustom(false);
            onChange(v);
          }
        }}
        options={[
          ...PAGE_OPTIONS,
          { label: "Other web address…", value: "__custom__" },
        ]}
      />
      {custom && (
        <Input
          className="mt-2"
          placeholder="https://example.com or /some-page"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
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
        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-ink">
          {value && (
            <Image src={value} alt="" fill sizes="112px" className="object-cover" />
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

export default function AdminPagesPage() {
  const [page, setPage] = useState<"home" | FormPageKey>("home");
  const [c, setC] = useState<HomeContent | null>(null);
  const [announcementBar, setAnnouncementBar] = useState("");
  const [region, setRegion] = useState<PreviewRegion | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    adminFetch<{ content: HomeContent }>("/page/home")
      .then((r) => setC(r.content))
      .catch((e) => setError(e.message));
    adminFetch<{ settings: { announcementBar: string } }>("/settings")
      .then((r) => setAnnouncementBar(r.settings.announcementBar))
      .catch(() => {});
  }, []);

  // bridge: iframe announces ready / requests an edit
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "crazywork:ready") setReady(true);
      else if (e.data?.type === "crazywork:edit") setRegion(e.data.region);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // live-sync draft content (+ announcement bar) into the preview as it changes
  useEffect(() => {
    if (ready && c) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "crazywork:content", content: { ...c, announcementBar } },
        window.location.origin,
      );
    }
  }, [ready, c, announcementBar]);

  const set = useCallback(
    <K extends keyof HomeContent>(key: K, value: HomeContent[K]) =>
      setC((prev) => (prev ? { ...prev, [key]: value } : prev)),
    [],
  );

  async function save() {
    if (!c) return;
    setBusy(true);
    setSaved(false);
    try {
      await Promise.all([
        adminFetch("/page/home", {
          method: "PUT",
          body: JSON.stringify({ content: c }),
        }),
        adminFetch("/settings", {
          method: "PATCH",
          body: JSON.stringify({ announcementBar }),
        }),
      ]);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const tabs = (
    <div className="mb-4 flex flex-wrap gap-2">
      {PAGE_TABS.map((t) => (
        <button
          key={t.key}
          onClick={() => {
            setPage(t.key);
            setRegion(null);
          }}
          className={cn(
            "rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-[0.12em] transition-colors cursor-pointer",
            page === t.key
              ? "bg-ink text-peach"
              : "border border-warmgrey text-brown hover:border-ink",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  // non-home pages use the same live builder (iframe + click-to-edit)
  if (page !== "home") {
    return (
      <div className="flex h-[calc(100vh-9rem)] flex-col">
        <div className="pb-1">
          <h1 className="headline text-4xl">Pages</h1>
          <div className="mt-3">{tabs}</div>
          <p className="text-xs text-brown">
            Editing <span className="font-bold capitalize">{page}</span> · click
            an <span className="text-ember">✎ orange tag</span> on the preview.
          </p>
        </div>
        <VisualPageBuilder pageKey={page} />
      </div>
    );
  }

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!c)
    return (
      <div>
        <h1 className="headline text-4xl">Pages</h1>
        <div className="mt-3">{tabs}</div>
        <p className="text-sm text-brown">Loading…</p>
      </div>
    );

  return (
    <div className="flex h-[calc(100vh-9rem)] flex-col">
      <div className="flex items-start justify-between pb-3">
        <div>
          <h1 className="headline text-4xl">Pages</h1>
          <div className="mt-3">{tabs}</div>
          <p className="text-xs text-brown">
            Editing <span className="font-bold">Home</span> · click an{" "}
            <span className="text-ember">✎ orange tag</span> on the preview to edit
            that part.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
          <Button variant="ghost" onClick={() => setC({ ...DEFAULT_HOME_CONTENT })}>
            Reset
          </Button>
          <Button variant="accent" onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        {/* live preview canvas */}
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-warmgrey/60 bg-sand/40">
          <iframe
            ref={iframeRef}
            src="/preview/home"
            title="Home preview"
            className="h-full w-full"
          />
        </div>

        {/* edit panel — opens on region click; preview stays visible + live */}
        {region && (
          <aside className="flex w-[340px] shrink-0 flex-col overflow-hidden rounded-2xl border border-warmgrey/60 bg-white/60">
            <div className="flex items-center justify-between border-b border-warmgrey/60 px-4 py-3">
              <p className="subhead text-base">{REGION_TITLES[region]}</p>
              <button
                aria-label="Close"
                className="text-brown hover:text-ember cursor-pointer"
                onClick={() => setRegion(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {region === "announcement" && (
                <Field
                  label="Announcement bar text"
                  value={announcementBar}
                  onChange={setAnnouncementBar}
                  hint="The thin orange strip at the very top of every store page."
                />
              )}

              {region === "hero" && (
                <>
                  <ImageField
                    label="Background image"
                    value={c.heroImage}
                    onChange={(v) => set("heroImage", v)}
                  />
                  <Field
                    label="Tagline (above headline)"
                    value={c.heroEyebrow}
                    onChange={(v) => set("heroEyebrow", v)}
                  />
                  <Field
                    label="Big headline"
                    value={c.heroHeadline}
                    onChange={(v) => set("heroHeadline", v)}
                    textarea
                    hint="Enter = new line. *word* = orange."
                  />
                  <Field
                    label="Supporting text"
                    value={c.heroSub}
                    onChange={(v) => set("heroSub", v)}
                    textarea
                  />
                  <Field
                    label="Main button — text"
                    value={c.heroCtaPrimary.label}
                    onChange={(v) =>
                      set("heroCtaPrimary", { ...c.heroCtaPrimary, label: v })
                    }
                  />
                  <LinkField
                    label="Main button — goes to"
                    value={c.heroCtaPrimary.href}
                    onChange={(v) =>
                      set("heroCtaPrimary", { ...c.heroCtaPrimary, href: v })
                    }
                  />
                  <Field
                    label="Second button — text"
                    value={c.heroCtaSecondary.label}
                    onChange={(v) =>
                      set("heroCtaSecondary", { ...c.heroCtaSecondary, label: v })
                    }
                  />
                  <LinkField
                    label="Second button — goes to"
                    value={c.heroCtaSecondary.href}
                    onChange={(v) =>
                      set("heroCtaSecondary", { ...c.heroCtaSecondary, href: v })
                    }
                  />
                </>
              )}

              {region === "marquee" && (
                <div className="space-y-2">
                  {c.marquee.map((line, i) => (
                    <div key={i} className="flex gap-2">
                      <Input
                        value={line}
                        onChange={(e) =>
                          set(
                            "marquee",
                            c.marquee.map((l, j) => (j === i ? e.target.value : l)),
                          )
                        }
                      />
                      <button
                        aria-label="Remove line"
                        className="px-1 text-warmgrey hover:text-red-700 cursor-pointer"
                        onClick={() =>
                          set("marquee", c.marquee.filter((_, j) => j !== i))
                        }
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                  <button
                    className="inline-flex items-center gap-1 eyebrow text-ember hover:underline cursor-pointer"
                    onClick={() => set("marquee", [...c.marquee, ""])}
                  >
                    <Plus size={12} /> add line
                  </button>
                </div>
              )}

              {region === "featured" && (
                <Field
                  label="Small label above the product grid"
                  value={c.featuredEyebrow}
                  onChange={(v) => set("featuredEyebrow", v)}
                />
              )}

              {region === "mindsetTile" && (
                <>
                  <ImageField
                    label="Tile image"
                    value={c.mindsetTile.image}
                    onChange={(v) =>
                      set("mindsetTile", { ...c.mindsetTile, image: v })
                    }
                  />
                  <Field
                    label="Small label"
                    value={c.mindsetTile.eyebrow}
                    onChange={(v) =>
                      set("mindsetTile", { ...c.mindsetTile, eyebrow: v })
                    }
                  />
                  <Field
                    label="Title"
                    value={c.mindsetTile.title}
                    onChange={(v) =>
                      set("mindsetTile", { ...c.mindsetTile, title: v })
                    }
                    textarea
                  />
                  <Field
                    label="Link text"
                    value={c.mindsetTile.linkLabel}
                    onChange={(v) =>
                      set("mindsetTile", { ...c.mindsetTile, linkLabel: v })
                    }
                  />
                  <LinkField
                    label="Tile goes to"
                    value={c.mindsetTile.href}
                    onChange={(v) =>
                      set("mindsetTile", { ...c.mindsetTile, href: v })
                    }
                  />
                </>
              )}

              {region === "storyTile" && (
                <>
                  <Field
                    label="Small label"
                    value={c.storyTile.eyebrow}
                    onChange={(v) =>
                      set("storyTile", { ...c.storyTile, eyebrow: v })
                    }
                  />
                  <Field
                    label="Title"
                    value={c.storyTile.title}
                    onChange={(v) => set("storyTile", { ...c.storyTile, title: v })}
                    textarea
                  />
                  <Field
                    label="Link text"
                    value={c.storyTile.linkLabel}
                    onChange={(v) =>
                      set("storyTile", { ...c.storyTile, linkLabel: v })
                    }
                  />
                  <LinkField
                    label="Tile goes to"
                    value={c.storyTile.href}
                    onChange={(v) => set("storyTile", { ...c.storyTile, href: v })}
                  />
                </>
              )}

              {region === "community" && (
                <>
                  <Field
                    label="Small label"
                    value={c.communityEyebrow}
                    onChange={(v) => set("communityEyebrow", v)}
                  />
                  <Field
                    label="Heading"
                    value={c.communityTitle}
                    onChange={(v) => set("communityTitle", v)}
                  />
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
