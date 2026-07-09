import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { activeProducts, toCardProduct } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Shop",
  description:
    "Shop CRAZYWORK gym & lifestyle apparel — tees, hoodies and shorts built for the work. Free shipping over RM150.",
};

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price ↑" },
  { key: "price-desc", label: "Price ↓" },
];

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category, sort = "newest" } = await searchParams;

  const [categoryRows, productsRaw] = await Promise.all([
    prisma.product.findMany({
      where: { status: "active", category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    }),
    activeProducts(category ? { category } : {}),
  ]);

  const categories = categoryRows.map((p) => p.category!).sort();
  let products = productsRaw;
  if (sort === "price-asc") {
    products = products.sort((a, b) => Number(a.basePrice) - Number(b.basePrice));
  } else if (sort === "price-desc") {
    products = products.sort((a, b) => Number(b.basePrice) - Number(a.basePrice));
  }

  const href = (params: { category?: string; sort?: string }) => {
    const merged = { category, sort, ...params };
    const query = new URLSearchParams();
    if (merged.category) query.set("category", merged.category);
    if (merged.sort && merged.sort !== "newest") query.set("sort", merged.sort);
    const qs = query.toString();
    return `/shop${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="headline text-6xl">Shop All</h1>
      <p className="mt-2 text-sm text-brown">
        {products.length} piece{products.length === 1 ? "" : "s"} · built for the work
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-y border-warmgrey py-3">
        <div className="flex flex-wrap gap-2">
          <Link
            href={href({ category: undefined })}
            className={cn(
              "eyebrow px-3 py-1.5 border transition-colors",
              !category
                ? "border-ink bg-ink text-peach"
                : "border-warmgrey text-brown hover:border-ink",
            )}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              href={href({ category: cat })}
              className={cn(
                "eyebrow px-3 py-1.5 border transition-colors",
                category === cat
                  ? "border-ink bg-ink text-peach"
                  : "border-warmgrey text-brown hover:border-ink",
              )}
            >
              {cat}
            </Link>
          ))}
        </div>
        <div className="flex gap-2">
          {SORTS.map((s) => (
            <Link
              key={s.key}
              href={href({ sort: s.key })}
              className={cn(
                "eyebrow px-2 py-1.5 transition-colors",
                sort === s.key ? "text-ember" : "text-brown hover:text-ink",
              )}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      {products.length === 0 ? (
        <p className="py-24 text-center headline text-3xl text-warmgrey">
          Nothing here yet — next drop loading.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
          {products.map((product, i) => (
            <Reveal key={product.id} index={i % 6}>
              <ProductCard product={toCardProduct(product)} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
