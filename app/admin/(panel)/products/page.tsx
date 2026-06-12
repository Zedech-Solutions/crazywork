"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Plus, Trash2, X } from "lucide-react";
import { adminFetch, uploadFile } from "@/components/admin/api";
import { useConfirm } from "@/components/admin/confirm";
import { SizeGuideEditor } from "@/components/admin/size-guide-editor";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Badge, Input, Label, Textarea } from "@/components/ui/field";
import { formatRM, rm } from "@/lib/money";
import { DEFAULT_SIZE_GUIDE, type SizeGuideTable } from "@/lib/size-guide";

interface VariantForm {
  id?: string;
  size: string;
  colour: string;
  stock: number;
  sku: string;
  costPrice: string;
}

interface ImageForm {
  imageUrl: string;
  alt: string;
}

interface ProductForm {
  id?: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  basePrice: string;
  isNew: boolean;
  isLimited: boolean;
  status: "active" | "draft";
  dropId: string;
  metaTitle: string;
  metaDescription: string;
  variants: VariantForm[];
  images: ImageForm[];
  customSizeGuide: boolean;
  sizeGuide: SizeGuideTable;
}

interface ApiProduct {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  basePrice: string;
  isNew: boolean;
  isLimited: boolean;
  status: "active" | "draft";
  dropId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  variants: {
    id: string;
    size: string;
    colour: string;
    stock: number;
    sku: string | null;
    costPrice: string | null;
  }[];
  images: { imageUrl: string; alt: string | null }[];
  drop: { name: string } | null;
  sizeGuide: SizeGuideTable | null;
}

const EMPTY: ProductForm = {
  slug: "",
  name: "",
  description: "",
  category: "",
  basePrice: "0",
  isNew: false,
  isLimited: false,
  status: "draft",
  dropId: "",
  metaTitle: "",
  metaDescription: "",
  variants: [{ size: "M", colour: "Black", stock: 0, sku: "", costPrice: "" }],
  images: [],
  customSizeGuide: false,
  sizeGuide: DEFAULT_SIZE_GUIDE,
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [drops, setDrops] = useState<{ id: string; name: string }[]>([]);
  const [editing, setEditing] = useState<ProductForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const confirm = useConfirm();

  const reload = useCallback(() => {
    adminFetch<{ products: ApiProduct[] }>("/products")
      .then((r) => setProducts(r.products))
      .catch((e) => setError(e.message));
    adminFetch<{ drops: { id: string; name: string }[] }>("/drops")
      .then((r) => setDrops(r.drops))
      .catch(() => {});
  }, []);

  useEffect(reload, [reload]);

  function startEdit(p?: ApiProduct) {
    setError(null);
    if (!p) return setEditing({ ...EMPTY });
    setEditing({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description ?? "",
      category: p.category ?? "",
      basePrice: String(Number(p.basePrice)),
      isNew: p.isNew,
      isLimited: p.isLimited,
      status: p.status,
      dropId: p.dropId ?? "",
      metaTitle: p.metaTitle ?? "",
      metaDescription: p.metaDescription ?? "",
      variants: p.variants.map((v) => ({
        id: v.id,
        size: v.size,
        colour: v.colour,
        stock: v.stock,
        sku: v.sku ?? "",
        costPrice: v.costPrice ? String(Number(v.costPrice)) : "",
      })),
      images: p.images.map((img) => ({
        imageUrl: img.imageUrl,
        alt: img.alt ?? "",
      })),
      customSizeGuide: p.sizeGuide != null,
      sizeGuide: p.sizeGuide ?? DEFAULT_SIZE_GUIDE,
    });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        ...editing,
        basePrice: Number(editing.basePrice),
        dropId: editing.dropId || null,
        variants: editing.variants.map((v) => ({
          ...v,
          costPrice: v.costPrice === "" ? null : Number(v.costPrice),
        })),
        // null → fall back to the store default guide on the PDP
        sizeGuide: editing.customSizeGuide ? editing.sizeGuide : null,
      };
      if (editing.id) {
        await adminFetch(`/products/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/products", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setEditing(null);
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
        title: "Delete product",
        message: "Delete this product and all its variants? This can't be undone.",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    await adminFetch(`/products/${id}`, { method: "DELETE" });
    reload();
  }

  async function addImages(files: FileList | null) {
    if (!files || !editing) return;
    setBusy(true);
    try {
      const urls = await Promise.all([...files].map(uploadFile));
      setEditing({
        ...editing,
        images: [
          ...editing.images,
          ...urls.map((url) => ({ imageUrl: url, alt: editing.name })),
        ],
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setEditing((f) => (f ? { ...f, [key]: value } : f));

  if (editing) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between">
          <h1 className="headline text-5xl">
            {editing.id ? "Edit Product" : "New Product"}
          </h1>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            <X size={16} /> Close
          </Button>
        </div>

        <div className="mt-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label>Name</Label>
              <Input
                value={editing.name}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!editing.id) {
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
              <Input value={editing.slug} onChange={(e) => set("slug", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={editing.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <Label>Category</Label>
              <Input
                placeholder="Tees / Hoodies / Shorts"
                value={editing.category}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
            <div>
              <Label>Base price (RM)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={editing.basePrice}
                onChange={(e) => set("basePrice", e.target.value)}
              />
            </div>
            <div>
              <Label>Drop</Label>
              <Dropdown
                value={editing.dropId || "none"}
                onValueChange={(lv) => set("dropId", lv === "none" ? "" : lv)}
                options={[
                  { label: "— None —", value: "none" },
                  ...drops.map((d) => ({ label: d.name, value: d.id })),
                ]}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-sm">
            <CheckboxField
              label="Active (visible in store)"
              checked={editing.status === "active"}
              onCheckedChange={(v) => set("status", v ? "active" : "draft")}
            />
            <CheckboxField
              label="NEW badge"
              checked={editing.isNew}
              onCheckedChange={(v) => set("isNew", v)}
            />
            <CheckboxField
              label="LIMITED badge"
              checked={editing.isLimited}
              onCheckedChange={(v) => set("isLimited", v)}
            />
          </div>

          {/* VARIANTS */}
          <section className="border-t border-warmgrey pt-5">
            <div className="flex items-center justify-between">
              <h2 className="subhead text-xl">Variants (size × colour × stock)</h2>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  set("variants", [
                    ...editing.variants,
                    { size: "", colour: "", stock: 0, sku: "", costPrice: "" },
                  ])
                }
              >
                <Plus size={14} /> Variant
              </Button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="grid grid-cols-[1fr_1fr_80px_1fr_100px_32px] gap-2 eyebrow text-brown">
                <span>Size</span>
                <span>Colour</span>
                <span>Stock</span>
                <span>SKU</span>
                <span>Cost (RM)</span>
                <span />
              </div>
              {editing.variants.map((variant, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_1fr_80px_1fr_100px_32px] items-center gap-2"
                >
                  <Input
                    value={variant.size}
                    onChange={(e) =>
                      set(
                        "variants",
                        editing.variants.map((v, j) =>
                          j === i ? { ...v, size: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <Input
                    value={variant.colour}
                    onChange={(e) =>
                      set(
                        "variants",
                        editing.variants.map((v, j) =>
                          j === i ? { ...v, colour: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    value={variant.stock}
                    onChange={(e) =>
                      set(
                        "variants",
                        editing.variants.map((v, j) =>
                          j === i ? { ...v, stock: Number(e.target.value) } : v,
                        ),
                      )
                    }
                  />
                  <Input
                    value={variant.sku}
                    onChange={(e) =>
                      set(
                        "variants",
                        editing.variants.map((v, j) =>
                          j === i ? { ...v, sku: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="margin only"
                    value={variant.costPrice}
                    onChange={(e) =>
                      set(
                        "variants",
                        editing.variants.map((v, j) =>
                          j === i ? { ...v, costPrice: e.target.value } : v,
                        ),
                      )
                    }
                  />
                  <button
                    aria-label="Remove variant"
                    className="text-warmgrey hover:text-red-700 cursor-pointer"
                    onClick={() =>
                      set(
                        "variants",
                        editing.variants.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* IMAGES */}
          <section className="border-t border-warmgrey pt-5">
            <h2 className="subhead text-xl">Images</h2>
            <div className="mt-3 flex flex-wrap gap-3">
              {editing.images.map((img, i) => (
                <div key={i} className="relative h-28 w-22">
                  <Image
                    src={img.imageUrl}
                    alt={img.alt}
                    fill
                    sizes="88px"
                    className="object-cover"
                  />
                  <button
                    aria-label="Remove image"
                    className="absolute -right-1.5 -top-1.5 bg-ink p-0.5 text-peach hover:bg-red-700 cursor-pointer"
                    onClick={() =>
                      set(
                        "images",
                        editing.images.filter((_, j) => j !== i),
                      )
                    }
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="flex h-28 w-22 cursor-pointer items-center justify-center border border-dashed border-warmgrey text-brown hover:border-ink">
                <Plus size={18} />
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => addImages(e.target.files)}
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-warmgrey">
              Uploads via Storage stub → /public/uploads (R2 at launch)
            </p>
          </section>

          {/* SIZE GUIDE */}
          <section className="border-t border-warmgrey pt-5">
            <div className="flex items-center justify-between">
              <h2 className="subhead text-xl">Size guide</h2>
              <CheckboxField
                label="Custom for this product"
                checked={editing.customSizeGuide}
                onCheckedChange={(v) => set("customSizeGuide", v)}
              />
            </div>
            {editing.customSizeGuide ? (
              <div className="mt-3">
                <SizeGuideEditor
                  value={editing.sizeGuide}
                  onChange={(g) => set("sizeGuide", g)}
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-warmgrey">
                Using the store default size guide (edit it in Settings). Tick
                the box to give this product its own chart — e.g. waist/inseam
                for shorts.
              </p>
            )}
          </section>

          {/* SEO */}
          <section className="border-t border-warmgrey pt-5">
            <h2 className="subhead text-xl">SEO</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Meta title</Label>
                <Input
                  value={editing.metaTitle}
                  onChange={(e) => set("metaTitle", e.target.value)}
                />
              </div>
              <div>
                <Label>Meta description</Label>
                <Input
                  value={editing.metaDescription}
                  onChange={(e) => set("metaDescription", e.target.value)}
                />
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-3 border-t border-warmgrey pt-5">
            <Button variant="accent" onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Save product"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="headline text-5xl">Products</h1>
        <Button variant="accent" onClick={() => startEdit()}>
          <Plus size={16} /> New product
        </Button>
      </div>
      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      <table className="mt-8 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink text-left">
            {["Product", "Price", "Stock", "Drop", "Status", ""].map((h, i) => (
              <th key={i} className="py-2 pr-3 eyebrow text-brown">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {products.map((p) => {
            const stock = p.variants.reduce((s, v) => s + v.stock, 0);
            return (
              <tr key={p.id} className="border-b border-sand">
                <td className="py-3 pr-3">
                  <button
                    className="flex items-center gap-3 text-left subhead text-base hover:text-ember cursor-pointer"
                    onClick={() => startEdit(p)}
                  >
                    {p.images[0] && (
                      <span className="relative inline-block h-12 w-10 shrink-0 overflow-hidden bg-ink">
                        <Image
                          src={p.images[0].imageUrl}
                          alt=""
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      </span>
                    )}
                    {p.name}
                  </button>
                </td>
                <td className="py-3 pr-3">{formatRM(rm(Number(p.basePrice)))}</td>
                <td className={`py-3 pr-3 ${stock === 0 ? "font-bold text-red-700" : ""}`}>
                  {stock}
                </td>
                <td className="py-3 pr-3 text-brown">{p.drop?.name ?? "—"}</td>
                <td className="py-3 pr-3">
                  <Badge tone={p.status === "active" ? "ember" : "outline"}>
                    {p.status}
                  </Badge>
                </td>
                <td className="py-3 text-right">
                  <button
                    aria-label={`Delete ${p.name}`}
                    className="text-warmgrey hover:text-red-700 cursor-pointer"
                    onClick={() => remove(p.id)}
                  >
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {products.length === 0 && (
        <p className="mt-6 text-sm text-brown">No products yet.</p>
      )}
    </div>
  );
}
