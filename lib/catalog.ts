import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toSen } from "@/lib/money";
import { isProductSoldOut } from "@/lib/orders";
import type { CardProduct } from "@/components/site/product-card";

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { variants: true; images: true; drop: true };
}>;

export function toCardProduct(product: ProductWithRelations): CardProduct {
  const inStock = product.variants.filter((v) => v.stock > 0);
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    basePriceSen: toSen(product.basePrice),
    image:
      [...product.images].sort((a, b) => a.sortOrder - b.sortOrder)[0]
        ?.imageUrl ?? null,
    isNew: product.isNew,
    isLimited: product.isLimited,
    soldOut: isProductSoldOut(product.variants),
    singleVariant:
      inStock.length === 1
        ? {
            variantId: inStock[0].id,
            size: inStock[0].size,
            colour: inStock[0].colour,
            stock: inStock[0].stock,
          }
        : null,
  };
}

export async function activeProducts(where: Prisma.ProductWhereInput = {}) {
  return prisma.product.findMany({
    where: { status: "active", ...where },
    include: { variants: true, images: true, drop: true },
    orderBy: { createdAt: "desc" },
  });
}
