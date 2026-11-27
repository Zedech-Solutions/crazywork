import type { Metadata } from "next";
import Link from "next/link";
import { CategoryChips } from "@/components/site/category-chips";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { activeCategories, activeProductCards } from "@/lib/catalog";
import { categoryFor, categoryLinks } from "@/lib/categories";
import { pageMeta } from "@/lib/seo";
import { cn } from "@/lib/utils";

// Reads searchParams (category/sort) → rendered per request. The DB reads are
// cached in lib/catalog (activeProductCards / activeCategories, 60s) so a
// browse spike doesn't hit Neon on every view.
export const dynamic = "force-dynamic";

// ?sort= and utm variants canonicalise to /shop; an old ?category= link to its
// category page.
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}): Promise<Metadata> {
  const match = categoryFor((await searchParams).category);
  return {
    title: "Shop Gym Wear",
    description:
      "Shop CRAZYWORK, Malaysian gym & lifestyle apparel: tank tops, muscle tees, boxy tees, oversized tees, baggy pants, shorts and socks, built for the work.",
    ...pageMeta(match ? `/shop/${match.slug}` : "/shop"),
  };
}

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

  const [categories, cards] = await Promise.all([
    activeCategories(),
    activeProductCards(category),
  ]);

  // Copy before sorting — the cached array is shared, so never sort it in place.
  let products = cards;
  if (sort === "price-asc") {
    products = [...cards].sort((a, b) => a.basePriceSen - b.basePriceSen);
  } else if (sort === "price-desc") {
    products = [...cards].sort((a, b) => b.basePriceSen - a.basePriceSen);
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
        <CategoryChips
          values={categories}
          active={category ? (categoryLinks([category])[0]?.href ?? null) : null}
          allHref={href({ category: undefined })}
        />
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
            <Reveal key={product.productId} index={i % 6}>
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
