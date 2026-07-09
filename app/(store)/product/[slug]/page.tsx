import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PdpClient } from "@/components/product/pdp-client";
import { ProductCard } from "@/components/site/product-card";
import { activeProducts, isSoldOut, isUpcoming, toCardProduct } from "@/lib/catalog";
import { prisma } from "@/lib/db";
import { getSetting } from "@/lib/settings";
import { toSen } from "@/lib/money";
import { getDefaultSizeGuide, resolveSizeGuide } from "@/lib/size-guide";

export const revalidate = 60;

// Registers this dynamic segment for ISR: params render on demand, then cache
// for the revalidate window. Without this export Next treats the page as
// fully dynamic and revalidate is ignored.
export function generateStaticParams() {
  return [];
}

const getProduct = cache(async (slug: string) => {
  return prisma.product.findFirst({
    where: { slug, status: "active" },
    include: {
      variants: { orderBy: { sortOrder: "asc" } },
      images: { orderBy: { sortOrder: "asc" } },
      drop: true,
    },
  });
});

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
      images: (() => {
        const cover = product.images.find((img) => img.mediaType === "image");
        return cover ? [{ url: cover.imageUrl }] : [];
      })(),
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

  // Parallelize independent follow-up queries.
  const [defaultSizeGuide, notifyEnabled, relatedRaw] = await Promise.all([
    getDefaultSizeGuide(),
    getSetting("emailDropLaunch"),
    activeProducts({
      id: { not: product.id },
      ...(product.category ? { category: product.category } : {}),
    }),
  ]);

  const sizeGuide = resolveSizeGuide(product.sizeGuide, defaultSizeGuide);

  // Related-products fallback: if category query returned nothing, fetch any
  // active product (still excluding current); this second query is conditional.
  const related = relatedRaw.slice(0, 4);
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
          upcoming: isUpcoming(product),
          countdownUntil: product.drop?.countdownUntil
            ? product.drop.countdownUntil.toISOString()
            : null,
          dropId: product.dropId,
          images: product.images.map((img) => ({
            url: img.imageUrl,
            alt: img.alt ?? product.name,
            type: img.mediaType,
          })),
          variants: product.variants.map((v) => ({
            id: v.id,
            size: v.size,
            colour: v.colour,
            stock: v.stock,
          })),
        }}
        sizeGuide={sizeGuide}
        notifyEnabled={notifyEnabled}
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
