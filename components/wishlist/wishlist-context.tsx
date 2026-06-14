"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type ToggleResult = "added" | "removed" | "auth" | "error";

interface WishlistValue {
  isWishlisted: (productId: string) => boolean;
  toggle: (productId: string) => Promise<ToggleResult>;
}

const WishlistContext = createContext<WishlistValue | null>(null);

export function WishlistProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    fetch("/api/wishlist/ids")
      .then((r) => r.json())
      .then((b) => {
        if (active && Array.isArray(b.ids)) setIds(new Set<string>(b.ids));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const isWishlisted = useCallback((id: string) => ids.has(id), [ids]);

  const toggle = useCallback(async (id: string): Promise<ToggleResult> => {
    const res = await fetch("/api/wishlist/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: id }),
    });
    if (res.status === 401) return "auth";
    const body = await res.json().catch(() => ({}));
    if (!res.ok || !body.ok) return "error";
    setIds((prev) => {
      const next = new Set(prev);
      if (body.wishlisted) next.add(id);
      else next.delete(id);
      return next;
    });
    return body.wishlisted ? "added" : "removed";
  }, []);

  return (
    <WishlistContext.Provider value={{ isWishlisted, toggle }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within WishlistProvider");
  return ctx;
}
