import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CategoryChips } from "@/components/site/category-chips";
import { ProductCard } from "@/components/site/product-card";
import { Reveal } from "@/components/site/reveal";
import { activeCategories, activeProductCards } from "@/lib/catalog";
import { categoryBySlug, categoryDescription, categoryFor } from "@/lib/categories";
import { breadcrumbJsonLd, JsonLd } from "@/lib/jsonld";
import { pageMeta } from "@/lib/seo";

export const revalidate = 60;

// Registers this dynamic segment for ISR, like the product pages.
export function generateStaticParams() {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) return { title: "Not found" };
  return {
    title: category.heading,
    description: categoryDescription(category),
    ...pageMeta(`/shop/${category.slug}`),
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category: slug } = await params;
  const category = categoryBySlug(slug);
  if (!category) notFound();

  const [cards, categories] = await Promise.all([
    activeProductCards(),
    activeCategories(),
  ]);
  const products = cards.filter((p) => categoryFor(p.category)?.slug === slug);
  // A category with no active products would be an empty page; it is also
  // left out of the sitemap.
  if (products.length === 0) notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Shop", path: "/shop" },
          { name: category.heading, path: `/shop/${slug}` },
        ])}
      />
      <h1 className="headline text-6xl">{category.heading}</h1>
      <p className="mt-3 max-w-2xl text-sm text-brown">{category.intro}</p>

      <div className="mt-6 border-y border-warmgrey py-3">
        <CategoryChips values={categories} active={`/shop/${slug}`} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-10 md:grid-cols-3">
        {products.map((product, i) => (
          <Reveal key={product.productId} index={i % 6}>
            <ProductCard product={product} />
          </Reveal>
        ))}
      </div>
    </div>
  );
}
