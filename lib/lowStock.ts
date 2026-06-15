// Decide which just-sold variants should fire a low-stock alert. An item only
// qualifies when this order *crossed* the threshold — it was above before and
// is at/below now. Variants that were already low don't re-alert on every
// subsequent sale, so the channel stays quiet until something newly dips.

export interface SoldVariant {
  productName: string;
  size: string;
  colour: string;
  quantity: number;
  stockLeft: number | null; // remaining after this order (null if variant gone)
}

export interface CrossedVariant {
  productName: string;
  size: string;
  colour: string;
  stockLeft: number;
}

export function crossedLowStock(
  items: SoldVariant[],
  threshold: number,
): CrossedVariant[] {
  const crossed: CrossedVariant[] = [];
  for (const i of items) {
    if (i.stockLeft == null) continue;
    const before = i.stockLeft + i.quantity;
    if (i.stockLeft <= threshold && before > threshold) {
      crossed.push({
        productName: i.productName,
        size: i.size,
        colour: i.colour,
        stockLeft: i.stockLeft,
      });
    }
  }
  return crossed;
}
