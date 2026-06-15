import { describe, expect, test } from "vitest";
import { crossedLowStock, type SoldVariant } from "@/lib/lowStock";

function sold(overrides: Partial<SoldVariant> = {}): SoldVariant {
  return {
    productName: "Heavy Tee",
    size: "M",
    colour: "Black",
    quantity: 1,
    stockLeft: 2,
    ...overrides,
  };
}

const THRESHOLD = 3;

describe("crossedLowStock", () => {
  test("alerts when an order drops a variant from above the threshold to at/below", () => {
    const result = crossedLowStock([sold({ quantity: 3, stockLeft: 2 })], THRESHOLD);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ size: "M", colour: "Black", stockLeft: 2 });
  });

  test("alerts when stock lands exactly on the threshold", () => {
    const result = crossedLowStock([sold({ quantity: 2, stockLeft: 3 })], THRESHOLD);
    expect(result).toHaveLength(1);
  });

  test("does not re-alert when the variant was already low before this order", () => {
    // 2 left after selling 2 means it started at 4 — wait, that's a crossing.
    // Already-low case: started at 3 (≤ threshold), sold 1, now 2.
    const result = crossedLowStock([sold({ quantity: 1, stockLeft: 2 })], THRESHOLD);
    expect(result).toHaveLength(0);
  });

  test("ignores variants that stay comfortably above the threshold", () => {
    const result = crossedLowStock([sold({ quantity: 1, stockLeft: 9 })], THRESHOLD);
    expect(result).toHaveLength(0);
  });

  test("skips variants with unknown remaining stock", () => {
    const result = crossedLowStock([sold({ quantity: 5, stockLeft: null })], THRESHOLD);
    expect(result).toHaveLength(0);
  });

  test("returns only the variants that crossed in a mixed cart", () => {
    const result = crossedLowStock(
      [
        sold({ size: "M", quantity: 3, stockLeft: 1 }), // 4 → 1: crossed
        sold({ size: "L", quantity: 1, stockLeft: 20 }), // 21 → 20: fine
      ],
      THRESHOLD,
    );
    expect(result).toHaveLength(1);
    expect(result[0].size).toBe("M");
  });
});
