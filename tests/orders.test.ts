import { describe, expect, test } from "vitest";
import {
  canTransition,
  isProductSoldOut,
  isVariantSoldOut,
  ordersToCsv,
} from "@/lib/orders";
import { renderUpsellMessage } from "@/lib/upsell";
import { rm } from "@/lib/money";

describe("order status transitions", () => {
  test("happy path: pending → paid → processing → shipped → delivered", () => {
    expect(canTransition("pending", "paid")).toBe(true);
    expect(canTransition("paid", "processing")).toBe(true);
    expect(canTransition("processing", "shipped")).toBe(true);
    expect(canTransition("shipped", "delivered")).toBe(true);
  });

  test("cancellation allowed before shipping only", () => {
    expect(canTransition("pending", "cancelled")).toBe(true);
    expect(canTransition("paid", "cancelled")).toBe(true);
    expect(canTransition("processing", "cancelled")).toBe(true);
    expect(canTransition("shipped", "cancelled")).toBe(false);
  });

  test("no skipping or rewinding", () => {
    expect(canTransition("pending", "shipped")).toBe(false);
    expect(canTransition("delivered", "paid")).toBe(false);
    expect(canTransition("cancelled", "paid")).toBe(false);
    expect(canTransition("paid", "pending")).toBe(false);
  });
});

describe("sold-out derivation", () => {
  test("variant with zero stock is sold out", () => {
    expect(isVariantSoldOut({ stock: 0 })).toBe(true);
    expect(isVariantSoldOut({ stock: 3 })).toBe(false);
  });

  test("product is sold out only when every variant is", () => {
    expect(isProductSoldOut([{ stock: 0 }, { stock: 0 }])).toBe(true);
    expect(isProductSoldOut([{ stock: 0 }, { stock: 1 }])).toBe(false);
    expect(isProductSoldOut([])).toBe(true);
  });
});

describe("ordersToCsv", () => {
  test("renders header + rows and escapes commas/quotes", () => {
    const csv = ordersToCsv([
      {
        orderNumber: "CW-001",
        placedAt: new Date("2026-06-12T08:00:00Z"),
        customerName: 'Aina "AJ" Binti, KL',
        customerEmail: "aina@example.com",
        status: "paid",
        shippingZone: "west",
        subtotalSen: rm(200),
        discountAmountSen: rm(10),
        shippingFeeSen: rm(8),
        totalSen: rm(198),
        appliedDiscountLabel: "Bundle & Save",
        trackingNumber: null,
        itemSummary: "2× Heavy Tee (M/Black)",
      },
    ]);
    const lines = csv.trim().split("\n");
    expect(lines[0]).toBe(
      "Order,Date,Customer,Email,Status,Zone,Subtotal,Discount,Shipping,Total,Discount Label,Tracking,Items",
    );
    expect(lines[1]).toContain('"Aina ""AJ"" Binti, KL"');
    expect(lines[1]).toContain("198.00");
  });
});

describe("renderUpsellMessage", () => {
  const template = "Almost there! Add {n} more and save {percent}% on your cart";

  test("fills item-count gaps", () => {
    expect(renderUpsellMessage(template, { itemsAway: 1, percent: 5 })).toBe(
      "Almost there! Add 1 more and save 5% on your cart",
    );
  });

  test("fills RM gaps using the {n} slot", () => {
    expect(
      renderUpsellMessage(template, { amountAway: rm(30), percent: 8 }),
    ).toBe("Almost there! Add RM 30.00 more and save 8% on your cart");
  });
});
