"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WishlistButton } from "@/components/wishlist/wishlist-button";
import { useSession } from "@/lib/auth-client";
import { formatRM } from "@/lib/money";

interface Item {
  productId: string;
  slug: string;
  name: string;
  basePriceSen: number;
  image: string | null;
  soldOut: boolean;
}

export default function WishlistPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [items, setItems] = useState<Item[] | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/auth/sign-in");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((b) => setItems(b.ok && Array.isArray(b.items) ? b.items : []))
      .catch(() => setItems([]));
  }, [session]);

  if (!session) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6">
      <p className="eyebrow text-ember">Account</p>
      <h1 className="headline mt-1 text-6xl">Wishlist</h1>

      {items === null ? (
        <p className="mt-8 text-sm text-brown">Loading…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-sm text-brown">
          Nothing saved yet — tap the heart on any product to save it here.
        </p>
      ) : (
        <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((item) => (
            <div key={item.productId} className="group">
              <Link
                href={`/product/${item.slug}`}
                className="relative block aspect-[4/5] overflow-hidden bg-ink"
              >
                {item.image && (
                  <Image
                    src={item.image}
                    alt={item.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 25vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                )}
                <WishlistButton
                  productId={item.productId}
                  className="absolute right-2 top-2 h-8 w-8 rounded-full bg-peach/85 text-ink backdrop-blur hover:bg-peach"
                  onToggled={(saved) => {
                    if (!saved) {
                      setItems(
                        (prev) =>
                          prev?.filter((x) => x.productId !== item.productId) ??
                          null,
                      );
                    }
                  }}
                />
                {item.soldOut && (
                  <div className="absolute inset-x-0 bottom-0 bg-ink/85 py-2 text-center subhead text-xs text-warmgrey">
                    Sold Out
                  </div>
                )}
              </Link>
              <p className="mt-2 truncate subhead text-sm">{item.name}</p>
              <p className="text-xs text-brown">{formatRM(item.basePriceSen)}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-12">
        <Link href="/account" className="eyebrow text-brown hover:text-ember">
          ← Back to account
        </Link>
      </div>
    </div>
  );
}
