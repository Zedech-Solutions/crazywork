"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { Badge } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { ColourDropdown } from "@/components/product/colour-dropdown";
import { CountdownTimer } from "@/components/site/countdown-timer";
import { NotifyMe } from "@/components/site/notify-me";
import { SizeGuide } from "@/components/site/size-guide";
import { useCart } from "@/components/cart/cart-context";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { formatRM } from "@/lib/money";
import type { SizeGuideTable } from "@/lib/size-guide";
import { cn } from "@/lib/utils";

export interface PdpVariant {
  id: string;
  size: string;
  colour: string;
  stock: number;
}

export interface PdpProduct {
  productId: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  basePriceSen: number;
  isNew: boolean;
  isLimited: boolean;
  soldOut: boolean; // forced sold out (manual flag or sold-out drop)
  upcoming: boolean; // belongs to a drop that hasn't launched — not purchasable
  countdownUntil: string | null; // the drop's launch countdown, when set
  dropId: string | null; // its drop, for "notify me" signups when upcoming
  images: { url: string; alt: string; type: "image" | "video" }[];
  variants: PdpVariant[];
}

export function PdpClient({
  product,
  sizeGuide,
  notifyEnabled = false,
}: {
  product: PdpProduct;
  sizeGuide: SizeGuideTable;
  notifyEnabled?: boolean;
}) {
  const router = useRouter();
  const cart = useCart();
  const sizes = useMemo(
    () => [...new Set(product.variants.map((v) => v.size))],
    [product.variants],
  );
  const colours = useMemo(
    () => [...new Set(product.variants.map((v) => v.colour))],
    [product.variants],
  );
  const [size, setSize] = useState(sizes[0] ?? "");
  const [colour, setColour] = useState(colours[0] ?? "");
  const [imageIndex, setImageIndex] = useState(0);
  const [showSticky, setShowSticky] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const selected = product.variants.find(
    (v) => v.size === size && v.colour === colour,
  );
  const soldOut = product.soldOut || !selected || selected.stock <= 0;
  const allSoldOut =
    product.soldOut || product.variants.every((v) => v.stock <= 0);

  useEffect(() => {
    const target = ctaRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { rootMargin: "-56px 0px 0px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  function stockFor(checkSize: string, checkColour: string) {
    return (
      product.variants.find((v) => v.size === checkSize && v.colour === checkColour)
        ?.stock ?? 0
    );
  }

  function onTouchStart(e: React.TouchEvent) {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!touchStart.current || product.images.length < 2) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    touchStart.current = null;
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
    setImageIndex((prev) =>
      dx < 0 ? (prev + 1) % product.images.length
             : (prev - 1 + product.images.length) % product.images.length,
    );
  }

  function addToCart() {
    if (!selected || soldOut) return;
    cart.addLine({
      variantId: selected.id,
      productId: product.productId,
      slug: product.slug,
      name: product.name,
      size: selected.size,
      colour: selected.colour,
      unitPriceSen: product.basePriceSen,
      image:
        product.images.find((m) => m.type === "image")?.url ??
        product.images[0]?.url ??
        null,
      maxStock: selected.stock,
    });
  }

  const image = product.images[imageIndex] ?? product.images[0];

  return (
    <>
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? router.back() : router.push("/shop"))}
        className="mb-4 inline-flex cursor-pointer items-center gap-1 text-xs uppercase tracking-[0.2em] text-brown transition hover:text-ink"
      >
        <ChevronLeft size={14} /> Back
      </button>
      <div className="grid gap-10 lg:grid-cols-[7fr_5fr]">
        {/* GALLERY */}
        <div className="min-w-0">
          <div className="group relative aspect-[4/5] overflow-hidden bg-ink" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
            {image &&
              (image.type === "video" ? (
                <video
                  key={image.url}
                  src={image.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Image
                  src={image.url}
                  alt={image.alt}
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 58vw"
                  className="object-cover"
                />
              ))}
            <div className="absolute left-3 top-3 flex gap-2">
              {product.upcoming && <Badge tone="ember">Upcoming</Badge>}
              {product.isNew && !product.upcoming && <Badge tone="ember">New</Badge>}
              {product.isLimited && <Badge tone="ink">Limited</Badge>}
            </div>
            {product.images.length > 1 && (
              <>
                <button
                  type="button"
                  aria-label="Previous image"
                  onClick={() =>
                    setImageIndex(
                      (imageIndex - 1 + product.images.length) %
                        product.images.length,
                    )
                  }
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-peach/85 text-ink opacity-0 backdrop-blur transition hover:bg-peach group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  aria-label="Next image"
                  onClick={() =>
                    setImageIndex((imageIndex + 1) % product.images.length)
                  }
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-peach/85 text-ink opacity-0 backdrop-blur transition hover:bg-peach group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
          {product.images.length > 1 && (
            <p className="mt-2 text-center text-xs tracking-[0.2em] text-warmgrey">
              {imageIndex + 1} / {product.images.length}
            </p>
          )}
          {product.images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {product.images.map((img, i) => (
                <button
                  key={img.url}
                  onClick={() => setImageIndex(i)}
                  className={cn(
                    "relative h-20 w-16 shrink-0 overflow-hidden bg-ink cursor-pointer border",
                    i === imageIndex ? "border-ember" : "border-transparent",
                  )}
                  aria-label={`${img.type === "video" ? "Video" : "Image"} ${i + 1}`}
                >
                  {img.type === "video" ? (
                    <>
                      <video
                        src={img.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Play size={16} className="text-peach drop-shadow" fill="currentColor" />
                      </span>
                    </>
                  ) : (
                    <Image src={img.url} alt={img.alt} fill sizes="64px" className="object-cover" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* DETAILS */}
        <div>
          {product.category && (
            <p className="eyebrow text-brown">{product.category}</p>
          )}
          <h1 className="headline mt-1 text-5xl">{product.name}</h1>
          <p className="mt-3 text-2xl font-bold">{formatRM(product.basePriceSen)}</p>

          {product.upcoming ? (
            <div className="mt-8 rounded-2xl border border-warmgrey bg-sand/40 p-6">
              <p className="eyebrow text-ember">Upcoming drop</p>
              <p className="mt-2 text-sm text-brown">
                This piece hasn&apos;t dropped yet. Check back when it goes live.
              </p>
              {product.countdownUntil &&
                new Date(product.countdownUntil).getTime() > Date.now() && (
                  <div className="mt-4">
                    <CountdownTimer
                      until={product.countdownUntil}
                      label="Drops in"
                    />
                  </div>
                )}
              {product.dropId && notifyEnabled && (
                <div className="mt-5">
                  <NotifyMe dropId={product.dropId} dropName={product.name} />
                </div>
              )}
            </div>
          ) : (
            <>
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="eyebrow text-brown">Size — {size}</p>
              <SizeGuide guide={sizeGuide} />
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {sizes.map((s) => {
                const available = colours.some((c) => stockFor(s, c) > 0);
                return (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={cn(
                      "h-11 min-w-11 border px-3 subhead text-sm transition-colors cursor-pointer",
                      size === s
                        ? "border-ink bg-ink text-peach"
                        : "border-warmgrey hover:border-ink",
                      !available && "opacity-35 line-through",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6">
            <p className="eyebrow text-brown">Colour — {colour}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {colours.map((c) => {
                const available = stockFor(size, c) > 0;
                return (
                  <button
                    key={c}
                    onClick={() => setColour(c)}
                    className={cn(
                      "h-11 border px-4 subhead text-sm transition-colors cursor-pointer",
                      colour === c
                        ? "border-ink bg-ink text-peach"
                        : "border-warmgrey hover:border-ink",
                      !available && "opacity-35 line-through",
                    )}
                  >
                    {c}
                  </button>
                );
              })}
            </div>
          </div>

          <div ref={ctaRef} className="mt-8">
            <div className="flex gap-3">
              <Button
                variant="accent"
                size="lg"
                className="flex-1"
                disabled={soldOut}
                onClick={addToCart}
              >
                {allSoldOut
                  ? "Sold Out"
                  : soldOut
                    ? `${size} / ${colour} — Sold Out`
                    : "Add to Cart"}
              </Button>
              <WishlistButton
                productId={product.productId}
                size={20}
                className="h-12 w-12 shrink-0 rounded-md border border-ink text-ink hover:border-ember hover:text-ember"
              />
            </div>
            {selected && !soldOut && selected.stock <= 3 && (
              <p className="mt-2 text-center text-xs text-ember">
                Only {selected.stock} left in {size}/{colour}
              </p>
            )}
          </div>
            </>
          )}

          {product.description && (
            <div className="mt-8 border-t border-warmgrey pt-6">
              <p className="eyebrow mb-2 text-brown">The piece</p>
              <p className="whitespace-pre-line text-sm leading-relaxed text-ink/85">
                {product.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* STICKY ADD-TO-CART — floating glassy panel (iOS-style); hidden for
          upcoming products since they aren't purchasable yet. */}
      <div
        className={cn(
          "fixed bottom-4 z-30 transition-all duration-300",
          "inset-x-3 sm:inset-x-auto sm:left-1/2 sm:-translate-x-1/2",
          showSticky && !product.upcoming
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-[160%] opacity-0",
        )}
      >
        <div className="flex max-w-[calc(100vw-1.5rem)] flex-col gap-3 rounded-[1.75rem] border border-white/50 bg-peach/55 px-4 py-3 shadow-[0_12px_44px_rgba(26,26,26,0.22)] backdrop-blur-2xl sm:flex-row sm:items-center sm:gap-5 sm:px-5">
          <div className="min-w-0 shrink-0 sm:max-w-[11rem]">
            <p className="subhead truncate text-sm leading-none">{product.name}</p>
            <p className="mt-1 text-sm font-bold leading-none">
              {formatRM(product.basePriceSen)}
            </p>
          </div>

          <div className="flex min-w-0 items-center gap-3 sm:gap-4">
            {/* size */}
            <div className="flex shrink-0 items-center gap-1">
              {sizes.map((s) => {
                const available = colours.some((c) => stockFor(s, c) > 0);
                return (
                  <button
                    key={s}
                    onClick={() => setSize(s)}
                    className={cn(
                      "h-8 min-w-8 shrink-0 whitespace-nowrap rounded-full px-2 subhead text-xs transition-colors cursor-pointer",
                      size === s
                        ? "bg-ink text-peach"
                        : "bg-white/40 text-ink hover:bg-white/70",
                      !available && "opacity-35 line-through",
                    )}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {/* colour — custom themed dropdown (matches the glassy bar) */}
            {colours.length > 0 && (
              <ColourDropdown
                value={colour}
                onChange={setColour}
                options={colours.map((c) => ({
                  value: c,
                  available: stockFor(size, c) > 0,
                }))}
                className="w-36 max-w-[calc(100vw-2rem)] shrink"
              />
            )}
          </div>

          <Button
            variant="accent"
            disabled={soldOut}
            onClick={addToCart}
            className="shrink-0 rounded-full sm:ml-1"
          >
            {soldOut ? "Sold Out" : "Add to Cart"}
          </Button>
        </div>
      </div>
    </>
  );
}
