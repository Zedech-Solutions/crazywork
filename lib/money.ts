// All money math in the app happens in integer sen (1 RM = 100 sen).
// Prisma Decimal columns hold RM; convert at the boundary with toSen/fromSen.

export function formatRM(sen: number): string {
  const ringgit = sen / 100;
  return `RM ${ringgit.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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
