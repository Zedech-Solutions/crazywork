"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

export interface CartLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  size: string;
  colour: string;
  unitPriceSen: number;
  image: string | null;
  quantity: number;
  maxStock: number;
}

interface CartContextValue {
  lines: CartLine[];
  note: string;
  isOpen: boolean;
  count: number;
  subtotalSen: number;
  addLine: (line: Omit<CartLine, "quantity">, quantity?: number) => void;
  removeLine: (variantId: string) => void;
  setQuantity: (variantId: string, quantity: number) => void;
  setNote: (note: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "crazywork-cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [note, setNote] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLines(parsed.lines ?? []);
        setNote(parsed.note ?? "");
      }
    } catch {
      // corrupted cart — start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lines, note }));
  }, [lines, note, hydrated]);

  const addLine = useCallback(
    (line: Omit<CartLine, "quantity">, quantity = 1) => {
      setLines((prev) => {
        const existing = prev.find((l) => l.variantId === line.variantId);
        if (existing) {
          return prev.map((l) =>
            l.variantId === line.variantId
              ? {
                  ...l,
                  quantity: Math.min(l.quantity + quantity, l.maxStock),
                }
              : l,
          );
        }
        return [...prev, { ...line, quantity: Math.min(quantity, line.maxStock) }];
      });
      setIsOpen(true);
    },
    [],
  );

  const removeLine = useCallback((variantId: string) => {
    setLines((prev) => prev.filter((l) => l.variantId !== variantId));
  }, []);

  const setQuantity = useCallback((variantId: string, quantity: number) => {
    setLines((prev) =>
      quantity < 1
        ? prev.filter((l) => l.variantId !== variantId)
        : prev.map((l) =>
            l.variantId === variantId
              ? { ...l, quantity: Math.min(quantity, l.maxStock) }
              : l,
          ),
    );
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    setNote("");
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      lines,
      note,
      isOpen,
      count: lines.reduce((s, l) => s + l.quantity, 0),
      subtotalSen: lines.reduce((s, l) => s + l.unitPriceSen * l.quantity, 0),
      addLine,
      removeLine,
      setQuantity,
      setNote,
      clear,
      openDrawer: () => setIsOpen(true),
      closeDrawer: () => setIsOpen(false),
    }),
    [lines, note, isOpen, addLine, removeLine, setQuantity, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
