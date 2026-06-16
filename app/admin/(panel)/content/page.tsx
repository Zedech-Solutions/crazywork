"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Reorder } from "framer-motion";
import { GripVertical, Plus, Trash2, Upload, X } from "lucide-react";
import { adminFetch, uploadFile } from "@/components/admin/api";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/admin/confirm";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Badge, Input, Label, Textarea } from "@/components/ui/field";

type BlockType = "heading" | "paragraph" | "image" | "image_grid" | "quote" | "button";

interface BlockForm {
  key: string; // local reorder key
  type: BlockType;
  data: Record<string, unknown>;
}

interface PostForm {
  id?: string;
  slug: string;
  title: string;
  coverImageUrl: string;
  type: "collab";
  excerpt: string;
  featured: boolean;
  published: boolean;
  metaTitle: string;
  metaDescription: string;
  blocks: BlockForm[];
}

interface ApiPost {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  type: "blog" | "collab";
  excerpt: string | null;
  featured: boolean;
  published: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  blocks: { id: string; type: BlockType; data: Record<string, unknown> }[];
}

const BLOCK_DEFAULTS: Record<BlockType, Record<string, unknown>> = {
  heading: { text: "", level: 2 },
  paragraph: { text: "" },
  image: { url: "", alt: "" },
  image_grid: { images: [], columns: 3 },
  quote: { text: "", attribution: "" },
  button: { label: "Shop the drop", href: "/shop" },
};

let keyCounter = 0;
const nextKey = () => `blk-${++keyCounter}`;

const EMPTY: PostForm = {
  slug: "",
  title: "",
  coverImageUrl: "",
  type: "collab",
  excerpt: "",
  featured: false,
  published: false,
  metaTitle: "",
  metaDescription: "",
  blocks: [],
};

function BlockEditor({
  block,
  onChange,
  onUpload,
}: {
  block: BlockForm;
  onChange: (data: Record<string, unknown>) => void;
  onUpload: (files: FileList | null, handler: (urls: string[]) => void) => void;
}) {
  const d = block.data;
  switch (block.type) {
    case "heading":
      return (
        <div className="flex gap-2">
          <Input
            placeholder="Heading text"
            value={String(d.text ?? "")}
            onChange={(e) => onChange({ ...d, text: e.target.value })}
          />
          <Dropdown
            className="w-28"
            value={String(d.level ?? 2)}
            onValueChange={(v) => onChange({ ...d, level: Number(v) })}
            options={[
              { label: "Big (H2)", value: "2" },
              { label: "Small (H3)", value: "3" },
            ]}
          />
        </div>
      );
    case "paragraph":
      return (
        <Textarea
          placeholder="Paragraph — **bold** and *italic* supported"
          value={String(d.text ?? "")}
          onChange={(e) => onChange({ ...d, text: e.target.value })}
        />
      );
    case "image":
      return (
        <div className="flex items-start gap-3">
          {d.url ? (
            <div className="relative h-20 w-28 shrink-0 overflow-hidden bg-ink">
              <Image src={String(d.url)} alt="" fill sizes="112px" className="object-cover" />
            </div>
          ) : (
            <label className="flex h-20 w-28 shrink-0 cursor-pointer items-center justify-center border border-dashed border-warmgrey hover:border-ink">
              <Upload size={16} />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => onUpload(e.target.files, (urls) => onChange({ ...d, url: urls[0] }))}
              />
            </label>
          )}
          <Input
            placeholder="Alt text / caption"
            value={String(d.alt ?? "")}
            onChange={(e) => onChange({ ...d, alt: e.target.value })}
          />
        </div>
      );
    case "image_grid": {
      const images = (d.images as { url: string; alt?: string }[]) ?? [];
      return (
        <div>
          <div className="flex flex-wrap gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative h-16 w-16 overflow-hidden bg-ink">
                <Image src={img.url} alt="" fill sizes="64px" className="object-cover" />
                <button
                  aria-label="Remove image"
                  className="absolute right-0 top-0 bg-ink/80 p-0.5 text-peach cursor-pointer"
                  onClick={() =>
                    onChange({ ...d, images: images.filter((_, j) => j !== i) })
                  }
                >
                  <X size={10} />
                </button>
              </div>
            ))}
            <label className="flex h-16 w-16 cursor-pointer items-center justify-center border border-dashed border-warmgrey hover:border-ink">
              <Plus size={14} />
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) =>
                  onUpload(e.target.files, (urls) =>
                    onChange({
                      ...d,
                      images: [...images, ...urls.map((url) => ({ url, alt: "" }))],
                    }),
                  )
                }
              />
            </label>
          </div>
          <div className="mt-2 flex items-center gap-2 text-xs text-brown">
            Columns
            <Dropdown
              className="w-20"
              value={String(d.columns ?? 3)}
              onValueChange={(v) => onChange({ ...d, columns: Number(v) })}
              options={[2, 3, 4].map((n) => ({ label: String(n), value: String(n) }))}
            />
          </div>
        </div>
      );
    }
    case "quote":
      return (
        <div className="space-y-2">
          <Textarea
            placeholder="Quote text"
            className="min-h-16"
            value={String(d.text ?? "")}
            onChange={(e) => onChange({ ...d, text: e.target.value })}
          />
          <Input
            placeholder="Attribution"
            value={String(d.attribution ?? "")}
            onChange={(e) => onChange({ ...d, attribution: e.target.value })}
          />
        </div>
      );
    case "button":
      return (
        <div className="flex gap-2">
          <Input
            placeholder="Label"
            value={String(d.label ?? "")}
            onChange={(e) => onChange({ ...d, label: e.target.value })}
          />
          <Input
            placeholder="/shop or https://…"
            value={String(d.href ?? "")}
            onChange={(e) => onChange({ ...d, href: e.target.value })}
          />
        </div>
      );
  }
}

export default function AdminContentPage() {
  const [posts, setPosts] = useState<ApiPost[]>([]);
  const [form, setForm] = useState<PostForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  const reload = useCallback(() => {
    adminFetch<{ posts: ApiPost[] }>("/content")
      .then((r) => setPosts(r.posts))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  function startEdit(p?: ApiPost) {
    setError(null);
    if (!p) return setForm({ ...EMPTY });
    setForm({
      id: p.id,
      slug: p.slug,
      title: p.title,
      coverImageUrl: p.coverImageUrl ?? "",
      type: "collab",
      excerpt: p.excerpt ?? "",
      featured: p.featured,
      published: p.published,
      metaTitle: p.metaTitle ?? "",
      metaDescription: p.metaDescription ?? "",
      blocks: p.blocks.map((b) => ({ key: nextKey(), type: b.type, data: b.data })),
    });
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...form,
        coverImageUrl: form.coverImageUrl || null,
        blocks: form.blocks.map((b) => ({ type: b.type, data: b.data })),
      };
      if (form.id) {
        await adminFetch(`/content/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/content", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(null);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Delete post",
        message: "Delete this post and all its blocks?",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    await adminFetch(`/content/${id}`, { method: "DELETE" });
    reload();
  }

  function handleUpload(files: FileList | null, apply: (urls: string[]) => void) {
    if (!files?.length) return;
    setBusy(true);
    Promise.all([...files].map(uploadFile))
      .then(apply)
      .catch((e) => setError((e as Error).message))
      .finally(() => setBusy(false));
  }

  if (form) {
    const set = <K extends keyof PostForm>(key: K, value: PostForm[K]) =>
      setForm((f) => (f ? { ...f, [key]: value } : f));

    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between gap-3">
          <h1 className="headline text-4xl sm:text-5xl">
            {form.id ? "Edit Collab" : "New Collab"}
          </h1>
          <Button variant="ghost" className="shrink-0" onClick={() => setForm(null)}>
            <X size={16} /> Close
          </Button>
        </div>

        <div className="mt-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-[2fr_1fr_1fr]">
            <div>
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(e) => {
                  set("title", e.target.value);
                  if (!form.id) {
                    set(
                      "slug",
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, "-")
                        .replace(/(^-|-$)/g, ""),
                    );
                  }
                }}
              />
            </div>
            <div>
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(e) => set("slug", e.target.value)} />
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div>
              <Label>Cover</Label>
              {form.coverImageUrl ? (
                <div className="relative h-24 w-40 overflow-hidden bg-ink">
                  <Image src={form.coverImageUrl} alt="" fill sizes="160px" className="object-cover" />
                  <button
                    aria-label="Remove cover"
                    className="absolute right-1 top-1 bg-ink/80 p-0.5 text-peach cursor-pointer"
                    onClick={() => set("coverImageUrl", "")}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <label className="flex h-24 w-40 cursor-pointer items-center justify-center border border-dashed border-warmgrey hover:border-ink">
                  <Upload size={16} />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) =>
                      handleUpload(e.target.files, (urls) => set("coverImageUrl", urls[0]))
                    }
                  />
                </label>
              )}
            </div>
            <div className="flex-1">
              <Label>Excerpt</Label>
              <Textarea
                className="min-h-24"
                value={form.excerpt}
                onChange={(e) => set("excerpt", e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6">
            <CheckboxField
              label="Published"
              checked={form.published}
              onCheckedChange={(v) => set("published", v)}
            />
            <CheckboxField
              label="Featured on collab page"
              checked={form.featured}
              onCheckedChange={(v) => set("featured", v)}
            />
          </div>

          {/* BLOCKS */}
          <section className="border-t border-warmgrey pt-5">
            <h2 className="subhead text-xl">Blocks (drag to reorder)</h2>
            <Reorder.Group
              axis="y"
              values={form.blocks}
              onReorder={(blocks) => set("blocks", blocks)}
              className="mt-3 space-y-3"
            >
              {form.blocks.map((block) => (
                <Reorder.Item
                  key={block.key}
                  value={block}
                  className="flex gap-3 border border-warmgrey bg-sand/40 p-3"
                >
                  <span className="cursor-grab pt-1 text-warmgrey active:cursor-grabbing">
                    <GripVertical size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge tone="outline">{block.type.replace("_", " ")}</Badge>
                      <button
                        aria-label="Remove block"
                        className="text-warmgrey hover:text-red-700 cursor-pointer"
                        onClick={() =>
                          set("blocks", form.blocks.filter((b) => b.key !== block.key))
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <BlockEditor
                      block={block}
                      onUpload={handleUpload}
                      onChange={(data) =>
                        set(
                          "blocks",
                          form.blocks.map((b) =>
                            b.key === block.key ? { ...b, data } : b,
                          ),
                        )
                      }
                    />
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
            <div className="mt-4 flex flex-wrap gap-2">
              {(Object.keys(BLOCK_DEFAULTS) as BlockType[]).map((type) => (
                <Button
                  key={type}
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    set("blocks", [
                      ...form.blocks,
                      { key: nextKey(), type, data: { ...BLOCK_DEFAULTS[type] } },
                    ])
                  }
                >
                  + {type.replace("_", " ")}
                </Button>
              ))}
            </div>
          </section>

          {/* SEO */}
          <section className="border-t border-warmgrey pt-5">
            <h2 className="subhead text-xl">SEO</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Meta title</Label>
                <Input
                  value={form.metaTitle}
                  onChange={(e) => set("metaTitle", e.target.value)}
                />
              </div>
              <div>
                <Label>Meta description</Label>
                <Input
                  value={form.metaDescription}
                  onChange={(e) => set("metaDescription", e.target.value)}
                />
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-3 border-t border-warmgrey pt-5">
            <Button
              variant="accent"
              onClick={save}
              disabled={busy || !form.title.trim() || !form.slug.trim()}
            >
              {busy ? "Saving…" : "Save post"}
            </Button>
            <Button variant="ghost" onClick={() => setForm(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="headline text-4xl sm:text-5xl">Collab</h1>
        <Button
          variant="accent"
          className="w-full sm:w-auto"
          onClick={() => startEdit()}
        >
          <Plus size={16} /> New collab
        </Button>
      </div>
      <p className="mt-2 text-sm text-brown">
        Block-based collab stories shown on <code>/collab</code>. Tick{" "}
        <span className="font-bold">Featured</span> to highlight one at the top.
      </p>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      <div className="mt-8 space-y-3">
        {posts
          .filter((post) => post.type === "collab")
          .map((post) => (
          <div
            key={post.id}
            className="flex flex-wrap items-center justify-between gap-3 border border-warmgrey bg-sand/40 p-4"
          >
            <button className="text-left cursor-pointer" onClick={() => startEdit(post)}>
              <p className="subhead text-lg hover:text-ember">{post.title}</p>
              <p className="mt-0.5 text-xs text-brown">
                /collab/{post.slug} ·{" "}
                {post.blocks.length} block{post.blocks.length === 1 ? "" : "s"}
              </p>
            </button>
            <div className="flex items-center gap-3">
              {post.featured && <Badge tone="ink">featured</Badge>}
              <Badge tone={post.published ? "ember" : "outline"}>
                {post.published ? "published" : "draft"}
              </Badge>
              <button
                aria-label={`Delete ${post.title}`}
                className="text-warmgrey hover:text-red-700 cursor-pointer"
                onClick={() => remove(post.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {posts.length === 0 && <p className="text-sm text-brown">No posts yet.</p>}
      </div>
    </div>
  );
}
