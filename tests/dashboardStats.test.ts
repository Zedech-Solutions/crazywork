import { describe, expect, test } from "vitest";
import {
  buildTimeseries,
  topProducts,
  type OrderInput,
} from "@/lib/dashboard-stats";

const NOW = new Date("2026-06-13T10:00:00Z");

function order(
  placedAt: string,
  money: { total: number; subtotal: number; discount: number },
  items: OrderInput["items"] = [],
): OrderInput {
  return {
    placedAt: new Date(placedAt),
    totalSen: money.total,
    subtotalSen: money.subtotal,
    discountSen: money.discount,
    items,
  };
}

describe("buildTimeseries", () => {
  test("12mo returns 12 monthly buckets oldest→newest ending this month", () => {
    const buckets = buildTimeseries([], "12mo", NOW);
    expect(buckets).toHaveLength(12);
    expect(buckets[0].label).toBe("Jul");
    expect(buckets[11].label).toBe("Jun");
  });

  test("7d returns 7 daily buckets ending today", () => {
    const buckets = buildTimeseries([], "7d", NOW);
    expect(buckets).toHaveLength(7);
    expect(buckets[6].label).toBe("13 Jun");
  });

  test("30d returns 30 daily buckets, 90d returns 13 weekly buckets", () => {
    expect(buildTimeseries([], "30d", NOW)).toHaveLength(30);
    expect(buildTimeseries([], "90d", NOW)).toHaveLength(13);
  });

  test("empty ranges produce all-zero buckets", () => {
    const buckets = buildTimeseries([], "12mo", NOW);
    for (const b of buckets) {
      expect(b.revenueSen).toBe(0);
      expect(b.profitSen).toBe(0);
      expect(b.orders).toBe(0);
    }
  });

  test("places orders in the correct month and sums revenue/profit/orders", () => {
    const orders = [
      order(
        "2026-06-05T08:00:00Z",
        { total: 10500, subtotal: 10000, discount: 1000 },
        [{ productId: "p1", productName: "Hoodie", unitPriceSen: 5000, costPriceSen: 2000, quantity: 2 }],
      ),
      order(
        "2026-06-20T08:00:00Z",
        { total: 3000, subtotal: 3000, discount: 0 },
        [{ productId: "p2", productName: "Tee", unitPriceSen: 3000, costPriceSen: 1000, quantity: 1 }],
      ),
      order("2026-04-02T08:00:00Z", { total: 2000, subtotal: 2000, discount: 0 }, []),
    ];
    const buckets = buildTimeseries(orders, "12mo", NOW);
    const june = buckets[11];
    const april = buckets.find((b) => b.label === "Apr")!;

    expect(june.orders).toBe(2);
    expect(june.revenueSen).toBe(13500);
    // profit = (10000-1000 - 4000) + (3000-0 - 1000) = 5000 + 2000
    expect(june.profitSen).toBe(7000);
    expect(april.orders).toBe(1);
    expect(april.revenueSen).toBe(2000);
    // no cost snapshot → cogs 0 → profit = subtotal - discount
    expect(april.profitSen).toBe(2000);
  });

  test("ignores orders outside the window", () => {
    const orders = [order("2024-01-01T00:00:00Z", { total: 9999, subtotal: 9999, discount: 0 })];
    const buckets = buildTimeseries(orders, "12mo", NOW);
    expect(buckets.reduce((s, b) => s + b.revenueSen, 0)).toBe(0);
  });
});

describe("topProducts", () => {
  const orders = [
    order("2026-06-05T08:00:00Z", { total: 13000, subtotal: 13000, discount: 0 }, [
      { productId: "p1", productName: "Hoodie", unitPriceSen: 5000, costPriceSen: 2000, quantity: 2 },
      { productId: "p2", productName: "Tee", unitPriceSen: 3000, costPriceSen: 1000, quantity: 1 },
    ]),
    order("2026-05-10T08:00:00Z", { total: 5000, subtotal: 5000, discount: 0 }, [
      { productId: "p1", productName: "Hoodie", unitPriceSen: 5000, costPriceSen: 2000, quantity: 1 },
    ]),
    order("2024-01-01T00:00:00Z", { total: 9999, subtotal: 9999, discount: 0 }, [
      { productId: "p3", productName: "Old", unitPriceSen: 9999, costPriceSen: 0, quantity: 1 },
    ]),
  ];

  test("ranks by revenue within the window, summing units", () => {
    const top = topProducts(orders, "12mo", NOW, 5);
    expect(top).toHaveLength(2);
    expect(top[0]).toMatchObject({ productId: "p1", name: "Hoodie", revenueSen: 15000, units: 3 });
    expect(top[1]).toMatchObject({ productId: "p2", name: "Tee", revenueSen: 3000, units: 1 });
  });

  test("respects the limit", () => {
    expect(topProducts(orders, "12mo", NOW, 1)).toHaveLength(1);
  });
});
