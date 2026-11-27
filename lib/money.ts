// All money math in the app happens in integer sen (1 RM = 100 sen).
// Prisma Decimal columns hold RM; convert at the boundary with toSen/fromSen.

// Just the formatted amount, no currency prefix (e.g. "1,166.00").
export function formatAmount(sen: number): string {
  return (sen / 100).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatRM(sen: number): string {
  return `RM ${formatAmount(sen)}`;
}

// Shopper-facing product price. Upcoming products are saved at RM 0 until
// priced, and "RM 0.00" reads as free.
export function formatPrice(sen: number): string {
  return sen > 0 ? formatRM(sen) : "Price coming soon";
}

export function rm(ringgit: number): number {
  return Math.round(ringgit * 100);
}

export function toSen(value: string | number | { toString(): string }): number {
  const n = typeof value === "number" ? value : Number(value.toString());
  return Math.round(n * 100);
}

export function fromSen(sen: number): number {
  return sen / 100;
}
