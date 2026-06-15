"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { MediaField } from "@/components/admin/media-field";
import type { FormPageKey } from "@/components/admin/page-form-editor";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input, Label, Textarea } from "@/components/ui/field";
import { Dropdown } from "@/components/ui/dropdown";
import { MINDSET_BG_OPTIONS, slugify, type MindsetArticle } from "@/lib/content";

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


const PANEL_TITLES: Record<string, string> = {
  header: "Header",
  stories: "Stories",
  intro: "Intro",
  footer: "Footer",
  success: "Checkout success",
};

// Live visual builder for the non-home pages (mindset / drops / footer) — same
// iframe + click-an-orange-tag flow as Home, with each page's fields.
export function VisualPageBuilder({ pageKey }: { pageKey: FormPageKey }) {
  const [content, setContent] = useState<Record<string, unknown> | null>(null);
  const [region, setRegion] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setContent(null);
    setRegion(null);
    setReady(false);
    adminFetch<{ content: Record<string, string> }>(`/page/${pageKey}`)
      .then((r) => setContent(r.content))
      .catch((e) => setError(e.message));
  }, [pageKey]);

  useEffect(() => {
    function onMsg(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "crazywork:ready") setReady(true);
      else if (e.data?.type === "crazywork:edit") setRegion(e.data.region);
    }
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);

  useEffect(() => {
    if (ready && content) {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "crazywork:content", content },
        window.location.origin,
      );
    }
  }, [ready, content]);

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
  const str = (key: string) => String(content?.[key] ?? "");

  const articles = (content?.articles as MindsetArticle[]) ?? [];
  const setArticles = (next: MindsetArticle[]) =>
    setContent((c) => (c ? { ...c, articles: next } : c));
  const updateArticle = (i: number, patch: Partial<MindsetArticle>) =>
    setArticles(articles.map((a, j) => (j === i ? { ...a, ...patch } : a)));
  const addArticle = () =>
    setArticles([
      ...articles,
      {
        slug: "",
        tag: "Mindset",
        title: "New story",
        excerpt: "",
        readTime: "4 min read",
        image: "",
        featured: false,
        bgColor: "ink",
        sections: [],
      },
    ]);
  const removeArticle = (i: number) =>
    setArticles(articles.filter((_, j) => j !== i));

  // Article body blocks (heading + paragraphs) — power the detail page.
  const setSections = (i: number, next: MindsetArticle["sections"]) =>
    updateArticle(i, { sections: next });
  const addSection = (i: number) =>
    setSections(i, [...(articles[i].sections ?? []), { heading: "", body: "" }]);
  const updateSection = (
    i: number,
    s: number,
    patch: Partial<MindsetArticle["sections"][number]>,
  ) =>
    setSections(
      i,
      (articles[i].sections ?? []).map((sec, k) =>
        k === s ? { ...sec, ...patch } : sec,
      ),
    );
  const removeSection = (i: number, s: number) =>
    setSections(
      i,
      (articles[i].sections ?? []).filter((_, k) => k !== s),
    );

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!content) return <p className="text-sm text-brown">Loading…</p>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-end gap-3 pb-3">
        {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
        <Button variant="accent" onClick={save} disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-warmgrey/60 bg-sand/40">
          {/* key forces a fresh load when switching pages */}
          <iframe
            key={pageKey}
            ref={iframeRef}
            src={`/preview/${pageKey}`}
            title={`${pageKey} preview`}
            className="h-full w-full"
          />
        </div>

        {region && (
          <aside className="fixed inset-x-0 bottom-0 z-40 flex max-h-[75vh] flex-col overflow-hidden rounded-t-2xl border border-warmgrey/60 bg-white shadow-2xl md:static md:max-h-none md:w-[340px] md:shrink-0 md:rounded-2xl md:bg-white/60 md:shadow-none">
            <div className="flex items-center justify-between border-b border-warmgrey/60 px-4 py-3">
              <p className="subhead text-base">
                {PANEL_TITLES[region] ?? "Edit"}
              </p>
              <button
                aria-label="Close"
                className="text-brown hover:text-ember cursor-pointer"
                onClick={() => setRegion(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              {pageKey === "mindset" && region === "header" && (
                <>
                  <MediaField
                    label="Header background image"
                    value={str("headerImage")}
                    onChange={(v) => set("headerImage", v)}
                  />
                  <Field
                    label="Small label"
                    value={str("headerEyebrow")}
                    onChange={(v) => set("headerEyebrow", v)}
                  />
                  <Field
                    label="Title"
                    value={str("headerTitle")}
                    onChange={(v) => set("headerTitle", v)}
                    textarea
                    hint="Enter = new line. *word* = orange."
                  />
                  <Field
                    label="Intro text"
                    value={str("headerSub")}
                    onChange={(v) => set("headerSub", v)}
                    textarea
                  />
                </>
              )}

              {pageKey === "mindset" && region === "stories" && (
                <>
                  {articles.map((a, i) => (
                    <div
                      key={i}
                      className="space-y-2 rounded-lg border border-warmgrey/60 bg-sand/30 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <CheckboxField
                          label="Featured"
                          checked={a.featured}
                          onCheckedChange={(v) => updateArticle(i, { featured: v })}
                        />
                        <button
                          aria-label="Remove story"
                          className="text-warmgrey hover:text-red-700 cursor-pointer"
                          onClick={() => removeArticle(i)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <MediaField
                        label="Image"
                        value={a.image}
                        onChange={(v) => updateArticle(i, { image: v })}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Field
                          label="Tag"
                          value={a.tag}
                          onChange={(v) => updateArticle(i, { tag: v })}
                        />
                        <Field
                          label="Read time"
                          value={a.readTime}
                          onChange={(v) => updateArticle(i, { readTime: v })}
                        />
                      </div>
                      <Field
                        label="Title"
                        value={a.title}
                        onChange={(v) => updateArticle(i, { title: v })}
                        textarea
                      />
                      <Field
                        label="Page link (slug)"
                        value={a.slug ?? ""}
                        onChange={(v) => updateArticle(i, { slug: slugify(v) })}
                        hint={`Opens at /mindset/${slugify(a.slug?.trim() || a.title) || "…"}. Blank = from title.`}
                      />
                      <Field
                        label="Excerpt"
                        value={a.excerpt}
                        onChange={(v) => updateArticle(i, { excerpt: v })}
                        textarea
                      />
                      <div>
                        <Label>Page background</Label>
                        <Dropdown
                          value={a.bgColor ?? "ink"}
                          onValueChange={(v) =>
                            updateArticle(i, {
                              bgColor: v as MindsetArticle["bgColor"],
                            })
                          }
                          options={MINDSET_BG_OPTIONS}
                        />
                      </div>

                      {/* Article body — shown on the detail page */}
                      <div className="space-y-2 border-t border-warmgrey/60 pt-3">
                        <p className="eyebrow text-brown">Article body</p>
                        {(a.sections ?? []).map((sec, s) => (
                          <div
                            key={s}
                            className="space-y-2 rounded-lg border border-warmgrey/60 bg-white/60 p-2.5"
                          >
                            <div className="flex items-center justify-between">
                              <span className="eyebrow text-[10px] text-brown">
                                Section {s + 1}
                              </span>
                              <button
                                aria-label="Remove section"
                                className="p-0.5 text-warmgrey hover:text-red-700 cursor-pointer"
                                onClick={() => removeSection(i, s)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                            <Field
                              label="Heading"
                              value={sec.heading}
                              onChange={(v) =>
                                updateSection(i, s, { heading: v })
                              }
                            />
                            <Field
                              label="Text"
                              value={sec.body}
                              onChange={(v) => updateSection(i, s, { body: v })}
                              textarea
                              hint="Blank line = new paragraph."
                            />
                          </div>
                        ))}
                        <button
                          className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ember/60 px-3 py-1.5 text-xs font-medium text-ember hover:bg-ember/10 cursor-pointer"
                          onClick={() => addSection(i)}
                        >
                          <Plus size={12} /> Add section
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ember/60 px-3 py-2 text-xs font-medium text-ember hover:bg-ember/10 cursor-pointer"
                    onClick={addArticle}
                  >
                    <Plus size={13} /> Add story
                  </button>
                </>
              )}

              {pageKey === "drops" && (
                <>
                  <Field
                    label="Heading"
                    value={str("title")}
                    onChange={(v) => set("title", v)}
                  />
                  <Field
                    label="Description"
                    value={str("description")}
                    onChange={(v) => set("description", v)}
                    textarea
                  />
                </>
              )}

              {pageKey === "footer" && (
                <>
                  <Field
                    label="Tagline (under the wordmark)"
                    value={str("tagline")}
                    onChange={(v) => set("tagline", v)}
                  />
                  <Field
                    label="Blurb paragraph"
                    value={str("blurb")}
                    onChange={(v) => set("blurb", v)}
                    textarea
                  />
                  <p className="text-[11px] text-warmgrey">
                    Links &amp; socials are in Settings → Store.
                  </p>
                </>
              )}

              {pageKey === "checkoutSuccess" && (
                <>
                  <MediaField
                    label="Background image (blank = soft white)"
                    value={str("backgroundImage")}
                    placeholderClassName="bg-white"
                    onChange={(v) => set("backgroundImage", v)}
                  />
                  <Field
                    label="Heading"
                    value={str("heading")}
                    onChange={(v) => set("heading", v)}
                  />
                  <Field
                    label="Subheading"
                    value={str("subheading")}
                    onChange={(v) => set("subheading", v)}
                    textarea
                  />
                  <p className="text-[11px] text-warmgrey">
                    Both the uploaded image and the default white background render
                    blurred behind a frosted card.
                  </p>
                </>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
