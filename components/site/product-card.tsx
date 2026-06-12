"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/field";
import { useCart } from "@/components/cart/cart-context";
import { formatRM } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface CardProduct {
  productId: string;
  slug: string;
  name: string;
  category: string | null;
  basePriceSen: number;
  image: string | null;
  isNew: boolean;
  isLimited: boolean;
  soldOut: boolean;
  /** present when exactly one in-stock variant exists → direct add-to-cart */
  singleVariant: {
    variantId: string;
    size: string;
    colour: string;
    stock: number;
  } | null;
}

export function ProductCard({
  product,
  size = "default",
}: {
  product: CardProduct;
  size?: "default" | "large";
}) {
  const cart = useCart();
  const router = useRouter();
  const large = size === "large";

  function addToCart(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (product.soldOut) return;
    if (product.singleVariant) {
      cart.addLine({
        variantId: product.singleVariant.variantId,
        productId: product.productId,
        slug: product.slug,
        name: product.name,
        size: product.singleVariant.size,
        colour: product.singleVariant.colour,
        unitPriceSen: product.basePriceSen,
        image: product.image,
        maxStock: product.singleVariant.stock,
      });
    } else {
      router.push(`/product/${product.slug}`);
    }
  }

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block"
      aria-label={product.name}
    >
      <div
        className={cn(
          "relative overflow-hidden bg-ink",
          large ? "aspect-[3/4]" : "aspect-[4/5]",
        )}
      >
        {product.image && (
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes={
              large
                ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            }
            className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          />
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1.5">
          {product.isNew && <Badge tone="ember">New</Badge>}
          {product.isLimited && <Badge tone="ink">Limited</Badge>}
        </div>
        {product.soldOut ? (
          <div className="absolute inset-x-0 bottom-0 bg-ink/85 py-2.5 text-center subhead text-sm text-warmgrey">
            Sold Out
          </div>
        ) : (
          <button
            onClick={addToCart}
            className="absolute inset-x-0 bottom-0 translate-y-full bg-ember py-2.5 text-center subhead text-sm text-peach transition-transform duration-200 group-hover:translate-y-0 cursor-pointer"
          >
            Add to Cart
          </button>
        )}
      </div>
      <div
        className={cn(
          "flex items-start justify-between gap-2",
          large ? "mt-4" : "mt-2.5",
        )}
      >
        <div>
          <p
            className={cn(
              "subhead leading-tight group-hover:text-ember",
              large ? "text-2xl" : "text-base",
            )}
          >
            {product.name}
          </p>
          {product.category && (
            <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-warmgrey">
              {product.category}
            </p>
          )}
        </div>
        <p className={cn("font-bold", large ? "text-lg" : "text-sm")}>
          {formatRM(product.basePriceSen)}
        </p>
      </div>
    </Link>
  );
}
