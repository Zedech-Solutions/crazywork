import { unstable_cache } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { toSen } from "@/lib/money";
import { isProductSoldOut } from "@/lib/orders";
import type { CardProduct } from "@/components/site/product-card";

export type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { variants: true; images: true; drop: true };
}>;

// Minimal structural type that toCardProduct and activeProducts consumers need.
// Using a structural type means callers that fetch a subset of fields (e.g.
// activeProducts with select on variants/images/drop) type-check cleanly while
// callers that fetch the full model (PDP, drops page) also satisfy this.
export type CardProductSource = {
  id: string;
  slug: string;
  name: string;
  category: string | null;
  basePrice: Prisma.Decimal;
  isNew: boolean;
  isLimited: boolean;
  soldOut?: boolean;
  drop?: { status: string } | null;
  variants: { id: string; size: string; colour: string | null; stock: number }[];
  images: { imageUrl: string; mediaType: "image" | "video"; sortOrder: number }[];
};

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

export function toCardProduct(product: CardProductSource): CardProduct {
  const inStock = product.variants.filter((v) => v.stock > 0);
  const upcoming = isUpcoming(product);
  // Upcoming takes precedence over sold-out (an unreleased drop may have zero
  // stock) and disables the quick-add path.
  const soldOut = !upcoming && isSoldOut(product);
  // Images are already ordered by sortOrder (activeProducts uses orderBy+take:2).
  // For callers that fetch all images unordered, sort before slicing.
  const sortedImages = [...product.images].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  return {
    productId: product.id,
    slug: product.slug,
    name: product.name,
    category: product.category,
    basePriceSen: toSen(product.basePrice),
    image: sortedImages[0]?.imageUrl ?? null,
    imageType: sortedImages[0]?.mediaType ?? "image",
    hoverImage: sortedImages[1]?.imageUrl ?? null,
    hoverImageType: sortedImages[1]?.mediaType ?? "image",
    isNew: product.isNew,
    isLimited: product.isLimited,
    soldOut,
    upcoming,
    singleVariant:
      !upcoming && !soldOut && inStock.length === 1
        ? {
            variantId: inStock[0].id,
            size: inStock[0].size,
            colour: inStock[0].colour ?? "",
            stock: inStock[0].stock,
          }
        : null,
  };
}

export async function activeProducts(where: Prisma.ProductWhereInput = {}) {
  return prisma.product.findMany({
    where: { status: "active", ...where },
    include: {
      // Only the fields toCardProduct needs per variant (id, size, colour, stock).
      variants: { select: { id: true, size: true, colour: true, stock: true } },
      // toCardProduct uses image[0] and image[1] only (main + hover).
      images: {
        select: { imageUrl: true, mediaType: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
        take: 2,
      },
      // drop.status is used by isSoldOut / isUpcoming.
      drop: { select: { status: true, countdownUntil: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// The /shop listing is dynamic (it reads searchParams for category/sort), so
// its Prisma reads aren't covered by Next's full-route cache the way the static
// ISR pages (home, drops, PDP) are. These helpers cache the *results* instead,
// sparing Neon a query on every browse during a spike. 60s TTL matches the
// site-wide ISR window; toCardProduct output is plain JSON, so it round-trips
// through the cache cleanly. Tagged "products" for future targeted invalidation.

// Cards for the shop grid, optionally filtered by category. The category arg is
// part of the cache key (unstable_cache keys on the function arguments).
const cachedProductCards = unstable_cache(
  async (category?: string) => {
    const products = await activeProducts(category ? { category } : {});
    return products.map(toCardProduct);
  },
  ["active-product-cards"],
  { revalidate: 60, tags: ["products"] },
);

export function activeProductCards(category?: string): Promise<CardProduct[]> {
  return cachedProductCards(category);
}

// Distinct categories across active products — param-independent, so cached once.
export const activeCategories = unstable_cache(
  async (): Promise<string[]> => {
    const rows = await prisma.product.findMany({
      where: { status: "active", category: { not: null } },
      select: { category: true },
      distinct: ["category"],
    });
    return rows.map((r) => r.category!).sort();
  },
  ["active-categories"],
  { revalidate: 60, tags: ["products"] },
);
