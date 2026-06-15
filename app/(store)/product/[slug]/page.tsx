import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdpClient } from "@/components/product/pdp-client";
import { ProductCard } from "@/components/site/product-card";
import { activeProducts, isSoldOut, toCardProduct } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { toSen } from "@/lib/money";
import { getDefaultSizeGuide, resolveSizeGuide } from "@/lib/size-guide";

export const dynamic = "force-dynamic";

async function getProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "active" },
    include: {
      variants: true,
      images: { orderBy: { sortOrder: "asc" } },
      drop: true,
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Not found" };
  return {
    title: product.metaTitle ? { absolute: product.metaTitle } : product.name,
    description:
      product.metaDescription ??
      product.description?.slice(0, 155) ??
      `${product.name} — CRAZYWORK gym & lifestyle apparel.`,
    openGraph: {
      images: product.images[0] ? [{ url: product.images[0].imageUrl }] : [],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const sizeGuide = resolveSizeGuide(
    product.sizeGuide,
    await getDefaultSizeGuide(),
  );

  const related = (
    await activeProducts({
      id: { not: product.id },
      ...(product.category ? { category: product.category } : {}),
    })
  ).slice(0, 4);
  const fallback =
    related.length > 0
      ? related
      : (await activeProducts({ id: { not: product.id } })).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PdpClient
        product={{
          productId: product.id,
          slug: product.slug,
          name: product.name,
          description: product.description,
          category: product.category,
          basePriceSen: toSen(product.basePrice),
          isNew: product.isNew,
          isLimited: product.isLimited,
          soldOut: isSoldOut(product),
          images: product.images.map((img) => ({
            url: img.imageUrl,
            alt: img.alt ?? product.name,
          })),
          variants: product.variants.map((v) => ({
            id: v.id,
            size: v.size,
            colour: v.colour,
            stock: v.stock,
          })),
        }}
        sizeGuide={sizeGuide}
      />

      {fallback.length > 0 && (
        <section className="mt-20 border-t border-warmgrey pt-10 pb-16">
          <h2 className="headline text-4xl">You May Also Like</h2>
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
            {fallback.map((p) => (
              <ProductCard key={p.id} product={toCardProduct(p)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
