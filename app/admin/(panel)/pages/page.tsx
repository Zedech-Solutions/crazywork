"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { MediaField } from "@/components/admin/media-field";
import type { PreviewRegion } from "@/components/admin/home-preview";
import type { FormPageKey } from "@/components/admin/page-form-editor";
import { VisualPageBuilder } from "@/components/admin/visual-page-builder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PageTabKey = "home" | FormPageKey;

const PAGE_TABS: { key: PageTabKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "mindset", label: "Mindset" },
  { key: "drops", label: "Drops" },
  { key: "ourStory", label: "Our Story" },
  { key: "footer", label: "Footer" },
  { key: "checkoutSuccess", label: "Checkout" },
];
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Label, Textarea } from "@/components/ui/field";
import {
  DEFAULT_HOME_CONTENT,
  HOME_SLOTS,
  sectionsInSlot,
  type CategoryTile,
  type HomeContent,
  type HomeSection,
  type HomeSlot,
} from "@/lib/content";

const PAGE_OPTIONS = [
  { label: "Shop page", value: "/shop" },
  { label: "Drops page", value: "/drops" },
  { label: "Mindset page", value: "/mindset" },
  { label: "Our Story page", value: "/our-story" },
  { label: "Collab page", value: "/collab" },
  { label: "Community page", value: "/community" },
  { label: "FAQ page", value: "/faq" },
  { label: "Home page", value: "/" },
];

const REGION_TITLES: Record<PreviewRegion, string> = {
  announcement: "Announcement bar",
  hero: "Top banner",
  marquee: "Scrolling banner",
  categories: "Shop by category",
  featured: "Featured section label",
  sections: "Promo sections",
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

export default function AdminPagesPage() {
  const [page, setPage] = useState<PageTabKey>("home");
  const [c, setC] = useState<HomeContent | null>(null);
  const [announcementBar, setAnnouncementBar] = useState("");
  const [region, setRegion] = useState<PreviewRegion | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<HomeSlot | null>(null);
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

  // Promo sections are addressed by id (they're grouped by slot in the UI, so
  // array index isn't stable). Drag-and-drop just reassigns `position`.
  const updateSection = useCallback(
    (id: string, patch: Partial<HomeSection>) =>
      setC((prev) =>
        prev
          ? {
              ...prev,
              sections: prev.sections.map((s) =>
                s.id === id ? { ...s, ...patch } : s,
              ),
            }
          : prev,
      ),
    [],
  );
  const removeSection = useCallback(
    (id: string) =>
      setC((prev) =>
        prev
          ? { ...prev, sections: prev.sections.filter((s) => s.id !== id) }
          : prev,
      ),
    [],
  );
  const addSection = useCallback(
    (slot: HomeSlot) =>
      setC((prev) =>
        prev
          ? {
              ...prev,
              sections: [
                ...prev.sections,
                {
                  id: crypto.randomUUID(),
                  position: slot,
                  eyebrow: "",
                  heading: "New section",
                  body: "",
                  image: "",
                  buttonLabel: "Shop",
                  buttonHref: "/shop",
                } satisfies HomeSection,
              ],
            }
          : prev,
      ),
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
    <>
      {/* mobile: dropdown */}
      <div className="mb-4 sm:hidden">
        <Dropdown
          value={page}
          onValueChange={(v) => {
            setPage(v as "home" | FormPageKey);
            setRegion(null);
          }}
          options={PAGE_TABS.map((t) => ({ label: t.label, value: t.key }))}
        />
      </div>
      {/* desktop: pills */}
      <div className="mb-4 hidden flex-wrap gap-2 sm:flex">
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
    </>
  );

  // non-home pages use the same live builder (iframe + click-to-edit)
  if (page !== "home") {
    const pageLabel = PAGE_TABS.find((t) => t.key === page)?.label ?? page;
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="pb-1">
          <h1 className="headline text-4xl">Pages</h1>
          <div className="mt-3">{tabs}</div>
          <p className="text-xs text-brown">
            Editing <span className="font-bold">{pageLabel}</span> · click an{" "}
            <span className="font-bold text-ink">✎ edit tag</span> on the preview.
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
    <div className="flex h-full min-h-0 flex-col">
      <div className="pb-1">
        <h1 className="headline text-4xl">Pages</h1>
        <div className="mt-3">{tabs}</div>
        <p className="text-xs text-brown">
          Editing <span className="font-bold">Home</span> · click an{" "}
          <span className="font-bold text-ink">✎ edit tag</span> on the preview to edit
          that part.
        </p>
      </div>

      {/* action toolbar — same placement as the other pages' builder */}
      <div className="flex items-center justify-end gap-3 pb-3">
        {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
        <Button variant="ghost" onClick={() => setC({ ...DEFAULT_HOME_CONTENT })}>
          Reset
        </Button>
        <Button variant="accent" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
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
          <aside className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-t-2xl border border-warmgrey/60 bg-white shadow-2xl md:static md:max-h-none md:w-[340px] md:shrink-0 md:rounded-2xl md:bg-white/60 md:shadow-none">
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
                  <MediaField
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

              {region === "categories" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-warmgrey">
                    Image tiles shown above the featured products. Leave empty to
                    hide the whole section.
                  </p>
                  {(c.categories ?? []).map((cat) => (
                    <div
                      key={cat.id}
                      className="space-y-2 rounded-lg border border-warmgrey/60 bg-sand/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="eyebrow text-brown">Tile</span>
                        <button
                          aria-label="Remove tile"
                          className="p-1 text-warmgrey hover:text-red-700 cursor-pointer"
                          onClick={() =>
                            set(
                              "categories",
                              c.categories.filter((x) => x.id !== cat.id),
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <MediaField
                        label="Tile image"
                        value={cat.image}
                        onChange={(v) =>
                          set(
                            "categories",
                            c.categories.map((x) =>
                              x.id === cat.id ? { ...x, image: v } : x,
                            ),
                          )
                        }
                      />
                      <Field
                        label="Label"
                        value={cat.label}
                        onChange={(v) =>
                          set(
                            "categories",
                            c.categories.map((x) =>
                              x.id === cat.id ? { ...x, label: v } : x,
                            ),
                          )
                        }
                      />
                      <LinkField
                        label="Tile goes to"
                        value={cat.href}
                        onChange={(v) =>
                          set(
                            "categories",
                            c.categories.map((x) =>
                              x.id === cat.id ? { ...x, href: v } : x,
                            ),
                          )
                        }
                      />
                    </div>
                  ))}
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ember/60 px-3 py-2 text-xs font-medium text-ember hover:bg-ember/10 cursor-pointer"
                    onClick={() =>
                      set("categories", [
                        ...(c.categories ?? []),
                        {
                          id: crypto.randomUUID(),
                          label: "New category",
                          image: "",
                          href: "/shop",
                        } satisfies CategoryTile,
                      ])
                    }
                  >
                    <Plus size={13} /> Add tile
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

              {region === "sections" && (
                <div className="space-y-3">
                  <p className="text-[11px] text-warmgrey">
                    Each box below is a spot on the home page. Drag a promo band by
                    its <GripVertical size={11} className="inline -mt-0.5" /> handle
                    into the spot you want, or hit + to add one there. Bands sharing
                    a spot auto-rotate as a slideshow.
                  </p>
                  {HOME_SLOTS.map((slot) => {
                    const items = sectionsInSlot(c.sections, slot.value);
                    const over = dragOverSlot === slot.value;
                    return (
                      <div
                        key={slot.value}
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (draggingId) setDragOverSlot(slot.value);
                        }}
                        onDragLeave={(e) => {
                          if (
                            !e.currentTarget.contains(e.relatedTarget as Node)
                          )
                            setDragOverSlot(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggingId)
                            updateSection(draggingId, { position: slot.value });
                          setDraggingId(null);
                          setDragOverSlot(null);
                        }}
                        className={cn(
                          "rounded-xl border-2 border-dashed p-2 transition-colors",
                          over
                            ? "border-ember bg-ember/10"
                            : "border-warmgrey/50 bg-sand/20",
                        )}
                      >
                        <div className="flex items-center justify-between px-1 pb-1.5">
                          <span className="eyebrow text-[10px] text-brown">
                            {slot.label}
                          </span>
                          <button
                            aria-label={`Add band in ${slot.label}`}
                            className="text-ember hover:text-ink cursor-pointer"
                            onClick={() => addSection(slot.value)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        {items.length === 0 ? (
                          <p className="px-1 py-2 text-center text-[11px] text-warmgrey">
                            Empty — drop a band here
                          </p>
                        ) : (
                          <div className="space-y-2">
                            {items.map((s) => (
                              <div
                                key={s.id}
                                className={cn(
                                  "space-y-2 rounded-lg border border-warmgrey/60 bg-white/70 p-3 transition-opacity",
                                  draggingId === s.id && "opacity-40",
                                )}
                              >
                                <div className="flex items-center justify-between">
                                  <span
                                    draggable
                                    onDragStart={(e) => {
                                      setDraggingId(s.id);
                                      e.dataTransfer.effectAllowed = "move";
                                    }}
                                    onDragEnd={() => {
                                      setDraggingId(null);
                                      setDragOverSlot(null);
                                    }}
                                    className="flex cursor-grab items-center gap-1 text-brown active:cursor-grabbing"
                                  >
                                    <GripVertical size={15} />
                                    <span className="eyebrow text-[10px]">Drag</span>
                                  </span>
                                  <button
                                    aria-label="Remove band"
                                    className="p-1 text-warmgrey hover:text-red-700 cursor-pointer"
                                    onClick={() => removeSection(s.id)}
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                                <MediaField
                                  label="Background media"
                                  value={s.image}
                                  onChange={(v) => updateSection(s.id, { image: v })}
                                />
                                <Field
                                  label="Small label"
                                  value={s.eyebrow}
                                  onChange={(v) =>
                                    updateSection(s.id, { eyebrow: v })
                                  }
                                />
                                <Field
                                  label="Heading"
                                  value={s.heading}
                                  textarea
                                  hint="Enter = new line. *word* = orange."
                                  onChange={(v) =>
                                    updateSection(s.id, { heading: v })
                                  }
                                />
                                <Field
                                  label="Text"
                                  value={s.body}
                                  textarea
                                  onChange={(v) => updateSection(s.id, { body: v })}
                                />
                                <Field
                                  label="Button text (leave blank to hide)"
                                  value={s.buttonLabel}
                                  onChange={(v) =>
                                    updateSection(s.id, { buttonLabel: v })
                                  }
                                />
                                <LinkField
                                  label="Button goes to"
                                  value={s.buttonHref}
                                  onChange={(v) =>
                                    updateSection(s.id, { buttonHref: v })
                                  }
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {region === "mindsetTile" && (
                <>
                  <MediaField
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
                  <MediaField
                    label="Background image / video (optional)"
                    value={c.storyTile.image}
                    placeholderClassName="bg-sand"
                    onChange={(v) =>
                      set("storyTile", { ...c.storyTile, image: v })
                    }
                  />
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
