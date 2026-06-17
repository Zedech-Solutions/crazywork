import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toSen } from "@/lib/money";
import { isProductSoldOut } from "@/lib/orders";
import type { CardProduct } from "@/components/site/product-card";

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { variants: true; images: true; drop: true };
}>;

// A product counts as sold out when: it's manually flagged, its drop is marked
// sold out, or every variant is out of stock. Used everywhere a product renders
// so the state is consistent across all pages.
export function isSoldOut(product: {
  soldOut?: boolean;
  drop?: { status: string } | null;
  variants: { stock: number }[];
}): boolean {
  return (
    Boolean(product.soldOut) ||
    product.drop?.status === "soldout" ||
    isProductSoldOut(product.variants)
  );
}

// A product is "upcoming" when it belongs to a drop that hasn't launched yet.
// Upcoming products aren't purchasable — the PDP and cards show an Upcoming
// state (plus the drop's countdown) instead of size/colour/add-to-cart.
export function isUpcoming(product: {
  drop?: { status: string } | null;
}): boolean {
  return product.drop?.status === "upcoming";
}

export function toCardProduct(product: ProductWithRelations): CardProduct {
  const inStock = product.variants.filter((v) => v.stock > 0);
  const upcoming = isUpcoming(product);
  // Upcoming takes precedence over sold-out (an unreleased drop may have zero
  // stock) and disables the quick-add path.
  const soldOut = !upcoming && isSoldOut(product);
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
    soldOut,
    upcoming,
    singleVariant:
      !upcoming && !soldOut && inStock.length === 1
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
