"use client";

import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { useWishlist } from "@/components/wishlist/wishlist-context";
import { cn } from "@/lib/utils";

// Heart toggle. Saves to the account wishlist; sends guests to sign-in.
export function WishlistButton({
  productId,
  size = 18,
  className,
  onToggled,
}: {
  productId: string;
  size?: number;
  className?: string;
  onToggled?: (saved: boolean) => void;
}) {
  const { isWishlisted, toggle } = useWishlist();
  const router = useRouter();
  const active = isWishlisted(productId);

  return (
    <button
      type="button"
      aria-label={active ? "Remove from wishlist" : "Save to wishlist"}
      title={active ? "Saved" : "Save to wishlist"}
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const result = await toggle(productId);
        if (result === "auth") router.push("/auth/sign-in");
        else if (result === "added" || result === "removed") {
          onToggled?.(result === "added");
        }
      }}
      className={cn(
        "inline-flex items-center justify-center transition-colors cursor-pointer",
        className,
      )}
    >
      <Heart
        size={size}
        className={cn(
          "transition-colors",
          active ? "fill-ember text-ember" : "text-current",
        )}
      />
    </button>
  );
}
