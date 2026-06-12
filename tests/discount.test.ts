import { describe, expect, test } from "vitest";
import { evaluateCart, nextTierGap, type CampaignInput } from "@/lib/discount";
import { rm } from "@/lib/money";

const NOW = new Date("2026-06-12T12:00:00Z");

function campaign(overrides: Partial<CampaignInput>): CampaignInput {
  return {
    id: "c1",
    name: "Test Campaign",
    type: "quantity_tier",
    rules: { tiers: [{ minQty: 2, percent: 5 }] },
    active: true,
    startAt: null,
    endAt: null,
    priority: 0,
    stacksWithCodes: false,
    ...overrides,
  };
}

const qtyTier = campaign({
  id: "qty",
  name: "Bundle & Save",
  type: "quantity_tier",
  rules: {
    tiers: [
      { minQty: 2, percent: 5 },
      { minQty: 3, percent: 10 },
    ],
  },
});

const SHIPPING = rm(10);

describe("quantity_tier", () => {
  test("no discount one item below the threshold", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 1 }],
      campaigns: [qtyTier],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(0);
    expect(result.discountLabel).toBeNull();
    expect(result.total).toBe(rm(110));
  });

  test("applies exactly at the threshold (2 items → 5%)", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 2 }],
      campaigns: [qtyTier],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.subtotal).toBe(rm(200));
    expect(result.discountAmount).toBe(rm(10)); // 5% of 200
    expect(result.discountSource).toBe("campaign");
    expect(result.total).toBe(rm(200));
  });

  test("upgrades to the higher tier (3 items → 10%)", () => {
    const result = evaluateCart({
      items: [
        { unitPrice: rm(100), quantity: 2 },
        { unitPrice: rm(50), quantity: 1 },
      ],
      campaigns: [qtyTier],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(25)); // 10% of 250
  });

  test("basis is total cart item count across lines", () => {
    const result = evaluateCart({
      items: [
        { unitPrice: rm(100), quantity: 1 },
        { unitPrice: rm(100), quantity: 1 },
      ],
      campaigns: [qtyTier],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(10));
  });

  test("rounds the discount to the nearest sen", () => {
    const result = evaluateCart({
      items: [{ unitPrice: 3333, quantity: 3 }], // subtotal 9999 sen
      campaigns: [qtyTier],
      shippingFee: 0,
      now: NOW,
    });
    expect(result.discountAmount).toBe(1000); // 10% of 9999 = 999.9 → 1000
  });
});

describe("cart_total_tier", () => {
  const totalTier = campaign({
    id: "total",
    name: "Spend & Save",
    type: "cart_total_tier",
    rules: { tiers: [{ minSubtotal: rm(200), percent: 8 }] },
  });

  test("no discount below the subtotal threshold", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(199), quantity: 1 }],
      campaigns: [totalTier],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(0);
  });

  test("applies exactly at the subtotal threshold", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(200), quantity: 1 }],
      campaigns: [totalTier],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(16));
  });
});

describe("buy_x_get_y", () => {
  const bxgy = campaign({
    id: "bxgy",
    name: "Buy 2 = 5%",
    type: "buy_x_get_y",
    rules: { buyQty: 2, percent: 5 },
  });

  test("no discount below buyQty", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 1 }],
      campaigns: [bxgy],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(0);
  });

  test("percent off the cart once buyQty is reached", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 2 }],
      campaigns: [bxgy],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(10));
    expect(result.discountLabel).toBe("Buy 2 = 5%");
  });
});

describe("free_shipping_over", () => {
  const freeShip = campaign({
    id: "ship",
    name: "Free Shipping over RM150",
    type: "free_shipping_over",
    rules: { minSubtotal: rm(150) },
  });

  test("zeroes the shipping fee at the threshold", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(150), quantity: 1 }],
      campaigns: [freeShip],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.shippingFee).toBe(0);
    expect(result.freeShippingApplied).toBe(true);
    expect(result.total).toBe(rm(150));
  });

  test("keeps the shipping fee below the threshold", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(149), quantity: 1 }],
      campaigns: [freeShip],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.shippingFee).toBe(SHIPPING);
    expect(result.freeShippingApplied).toBe(false);
  });

  test("free shipping coexists with the best item discount (separate tracks)", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 2 }],
      campaigns: [freeShip, qtyTier],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(10)); // 5% of 200
    expect(result.shippingFee).toBe(0);
    expect(result.total).toBe(rm(190));
  });
});

describe("campaign windows and active flag", () => {
  test("inactive campaign is ignored", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 2 }],
      campaigns: [campaign({ ...qtyTier, active: false })],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(0);
  });

  test("expired campaign is ignored", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 2 }],
      campaigns: [
        campaign({ ...qtyTier, endAt: new Date("2026-06-01T00:00:00Z") }),
      ],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(0);
  });

  test("not-yet-started campaign is ignored", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 2 }],
      campaigns: [
        campaign({ ...qtyTier, startAt: new Date("2026-07-01T00:00:00Z") }),
      ],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(0);
  });
});

describe("best-single selection (no stacking)", () => {
  test("applies only the single largest of several applicable campaigns", () => {
    const small = campaign({
      id: "small",
      name: "Small",
      type: "cart_total_tier",
      rules: { tiers: [{ minSubtotal: rm(100), percent: 5 }] },
    });
    const big = campaign({
      id: "big",
      name: "Big",
      type: "cart_total_tier",
      rules: { tiers: [{ minSubtotal: rm(100), percent: 12 }] },
    });
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 2 }],
      campaigns: [small, big],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(24)); // 12% only, never 17%
    expect(result.discountLabel).toBe("Big");
  });

  test("priority breaks ties between equal campaign discounts", () => {
    const low = campaign({
      id: "low",
      name: "Low Priority",
      priority: 1,
      type: "cart_total_tier",
      rules: { tiers: [{ minSubtotal: rm(100), percent: 10 }] },
    });
    const high = campaign({
      id: "high",
      name: "High Priority",
      priority: 9,
      type: "cart_total_tier",
      rules: { tiers: [{ minSubtotal: rm(100), percent: 10 }] },
    });
    const result = evaluateCart({
      items: [{ unitPrice: rm(200), quantity: 1 }],
      campaigns: [low, high],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountLabel).toBe("High Priority");
  });
});

describe("campaign vs promo code", () => {
  test("code wins when larger than every campaign", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 2 }], // qtyTier gives 5%
      campaigns: [qtyTier],
      code: { code: "CRAZY1234", percentage: 10 },
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(20));
    expect(result.discountSource).toBe("code");
    expect(result.discountLabel).toBe("CRAZY1234");
  });

  test("campaign wins when larger than the code", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 3 }], // qtyTier gives 10%
      campaigns: [qtyTier],
      code: { code: "CRAZY1234", percentage: 5 },
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(30));
    expect(result.discountSource).toBe("campaign");
    expect(result.discountLabel).toBe("Bundle & Save");
  });

  test("code alone applies with no campaigns", () => {
    const result = evaluateCart({
      items: [{ unitPrice: rm(100), quantity: 1 }],
      campaigns: [],
      code: { code: "CRAZY1234", percentage: 10 },
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.discountAmount).toBe(rm(10));
    expect(result.total).toBe(rm(100));
  });
});

describe("totals are computed server-side from line items", () => {
  test("total = subtotal − discount + shipping; client totals are never an input", () => {
    const result = evaluateCart({
      items: [
        { unitPrice: rm(120), quantity: 2 },
        { unitPrice: rm(80), quantity: 1 },
      ],
      campaigns: [qtyTier],
      shippingFee: rm(15),
      now: NOW,
    });
    expect(result.subtotal).toBe(rm(320));
    expect(result.discountAmount).toBe(rm(32)); // 3 items → 10%
    expect(result.total).toBe(rm(320) - rm(32) + rm(15));
  });

  test("empty cart yields zeros and no discount", () => {
    const result = evaluateCart({
      items: [],
      campaigns: [qtyTier],
      shippingFee: SHIPPING,
      now: NOW,
    });
    expect(result.subtotal).toBe(0);
    expect(result.discountAmount).toBe(0);
    expect(result.discountLabel).toBeNull();
  });
});

describe("nextTierGap (pre-checkout upsell)", () => {
  test("1 item with a 2-item tier → 1 item away from 5%", () => {
    const gap = nextTierGap({
      items: [{ unitPrice: rm(100), quantity: 1 }],
      campaigns: [qtyTier],
      now: NOW,
    });
    expect(gap).toEqual({ itemsAway: 1, percent: 5 });
  });

  test("2 items → 1 away from the 10% tier", () => {
    const gap = nextTierGap({
      items: [{ unitPrice: rm(100), quantity: 2 }],
      campaigns: [qtyTier],
      now: NOW,
    });
    expect(gap).toEqual({ itemsAway: 1, percent: 10 });
  });

  test("already at the top tier → no upsell", () => {
    const gap = nextTierGap({
      items: [{ unitPrice: rm(100), quantity: 3 }],
      campaigns: [qtyTier],
      now: NOW,
    });
    expect(gap).toBeNull();
  });

  test("cart_total_tier within RM50 of the next threshold", () => {
    const totalTier = {
      ...qtyTier,
      id: "tt",
      type: "cart_total_tier" as const,
      rules: { tiers: [{ minSubtotal: rm(200), percent: 8 }] },
    };
    const gap = nextTierGap({
      items: [{ unitPrice: rm(170), quantity: 1 }],
      campaigns: [totalTier],
      now: NOW,
    });
    expect(gap).toEqual({ amountAway: rm(30), percent: 8 });
  });

  test("empty cart → no upsell", () => {
    expect(
      nextTierGap({ items: [], campaigns: [qtyTier], now: NOW }),
    ).toBeNull();
  });

  test("inactive campaign never drives an upsell", () => {
    const gap = nextTierGap({
      items: [{ unitPrice: rm(100), quantity: 1 }],
      campaigns: [{ ...qtyTier, active: false }],
      now: NOW,
    });
    expect(gap).toBeNull();
  });
});
