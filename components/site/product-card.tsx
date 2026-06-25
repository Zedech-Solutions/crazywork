"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/field";
import { useCart } from "@/components/cart/cart-context";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { formatRM } from "@/lib/money";
import { cn } from "@/lib/utils";

export interface CardProduct {
  productId: string;
  slug: string;
  name: string;
  category: string | null;
  basePriceSen: number;
  image: string | null;
  imageType: "image" | "video";
  /** second product image (e.g. backside) revealed on hover */
  hoverImage: string | null;
  hoverImageType: "image" | "video";
  isNew: boolean;
  isLimited: boolean;
  soldOut: boolean;
  /** belongs to a drop that hasn't launched — not purchasable */
  upcoming: boolean;
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
  const mediaRef = useRef<HTMLDivElement>(null);

  // Videos play (muted) while the card is hovered, then reset when the pointer
  // leaves — a silent preview that mirrors the photo hover-reveal.
  function playVideos() {
    mediaRef.current?.querySelectorAll("video").forEach((v) => {
      void v.play().catch(() => {});
    });
  }
  function resetVideos() {
    mediaRef.current?.querySelectorAll("video").forEach((v) => {
      v.pause();
      v.currentTime = 0;
    });
  }

  const sizesAttr = large
    ? "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
    : "(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw";
  const showHover = Boolean(product.hoverImage) && product.imageType !== "video";

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
        ref={mediaRef}
        onMouseEnter={playVideos}
        onMouseLeave={resetVideos}
        className={cn(
          "relative overflow-hidden bg-ink",
          large ? "aspect-[3/4]" : "aspect-[4/5]",
        )}
      >
        {product.image &&
          (product.imageType === "video" ? (
            <video
              src={product.image}
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes={sizesAttr}
              className={cn(
                "object-cover transition-transform duration-500 group-hover:scale-[1.04]",
                showHover && "transition-opacity group-hover:opacity-0",
              )}
            />
          ))}
        {showHover &&
          (product.hoverImageType === "video" ? (
            <video
              src={product.hoverImage!}
              muted
              loop
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
            />
          ) : (
            <Image
              src={product.hoverImage!}
              alt={`${product.name} — alternate view`}
              fill
              sizes={sizesAttr}
              className="object-cover opacity-0 transition-all duration-500 group-hover:scale-[1.04] group-hover:opacity-100"
            />
          ))}
        <div className="absolute left-2 top-2 flex flex-col gap-1.5">
          {product.upcoming && <Badge tone="ember">Upcoming</Badge>}
          {product.isNew && !product.upcoming && <Badge tone="ember">New</Badge>}
          {product.isLimited && <Badge tone="ink">Limited</Badge>}
        </div>
        <WishlistButton
          productId={product.productId}
          className="absolute right-2 top-2 z-10 h-8 w-8 rounded-full bg-peach/85 text-ink backdrop-blur hover:bg-peach"
        />
        {product.upcoming ? (
          <div className="absolute inset-x-0 bottom-0 bg-ink/85 py-2.5 text-center subhead text-sm text-ember">
            Upcoming
          </div>
        ) : product.soldOut ? (
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
