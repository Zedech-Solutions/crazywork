import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import {
  markOrderPaid,
  placeOrder,
  priceCart,
  updateOrderStatus,
  type PlaceOrderInput,
} from "@/lib/orders";
import { getSettings, type Settings } from "@/lib/settings";
import { mailer } from "@/lib/integrations/mailer";
import { notifier } from "@/lib/integrations/notifier";
import { rm } from "@/lib/money";

// Integration tests — require the docker-compose Postgres.

const RUN = `chkspec-${Date.now()}`;
const EMAIL = `${RUN}@example.com`;

let settings: Settings;
let inStockVariantId: string;
let soldOutVariantId: string;
let productId: string;
let pausedCampaignIds: string[] = [];

const UNIT_PRICE = rm(100); // product price RM100

function customer(overrides: Partial<PlaceOrderInput["customer"]> = {}) {
  return {
    name: "Aina Test",
    email: EMAIL,
    phone: "0123456789",
    address: "1 Jalan Test, Taman Uji",
    state: "Selangor",
    ...overrides,
  };
}

beforeAll(async () => {
  // park any pre-existing active campaigns so pricing is deterministic
  pausedCampaignIds = (
    await prisma.campaign.findMany({ where: { active: true } })
  ).map((c) => c.id);
  await prisma.campaign.updateMany({
    where: { id: { in: pausedCampaignIds } },
    data: { active: false },
  });

  const product = await prisma.product.create({
    data: {
      slug: `${RUN}-heavy-tee`,
      name: "Heavy Tee (spec)",
      basePrice: "100.00",
      status: "active",
      variants: {
        create: [
          { size: "M", colour: "Black", stock: 20 },
          { size: "L", colour: "Black", stock: 0 },
        ],
      },
    },
    include: { variants: true },
  });
  productId = product.id;
  inStockVariantId = product.variants.find((v) => v.size === "M")!.id;
  soldOutVariantId = product.variants.find((v) => v.size === "L")!.id;

  settings = await getSettings();
});

afterAll(async () => {
  await prisma.order.deleteMany({ where: { customerEmail: { contains: RUN } } });
  await prisma.discountRedemption.deleteMany({
    where: { user: { email: { contains: RUN } } },
  });
  await prisma.discountCode.deleteMany({
    where: { issuedEmail: { contains: RUN } },
  });
  await prisma.discountCode.deleteMany({
    where: { batchLabel: { contains: RUN } },
  });
  await prisma.campaign.deleteMany({ where: { name: { contains: RUN } } });
  await prisma.product.deleteMany({ where: { id: productId } });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
  await prisma.campaign.updateMany({
    where: { id: { in: pausedCampaignIds } },
    data: { active: true },
  });
});

describe("priceCart (server-side pricing)", () => {
  test("prices from the database, adds zone shipping", async () => {
    const result = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      email: EMAIL,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricing.subtotal).toBe(UNIT_PRICE);
    expect(result.pricing.shippingFee).toBe(settings.shippingWest);
    expect(result.pricing.total).toBe(UNIT_PRICE + settings.shippingWest);
  });

  test("east zone uses the east rate", async () => {
    const result = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "east",
      email: EMAIL,
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.pricing.shippingFee).toBe(settings.shippingEast);
  });

  test("store threshold gives free shipping", async () => {
    const result = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 2 }], // RM200 ≥ RM150
      shippingZone: "east",
      email: EMAIL,
    });
    if (!result.ok) throw new Error("expected ok");
    expect(result.pricing.shippingFee).toBe(0);
  });

  test("sold-out variant blocks checkout", async () => {
    const result = await priceCart({
      items: [{ variantId: soldOutVariantId, quantity: 1 }],
      shippingZone: "west",
      email: EMAIL,
    });
    expect(result).toMatchObject({ ok: false, error: "out_of_stock" });
  });

  test("quantity above remaining stock blocks checkout", async () => {
    const result = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 25 }],
      shippingZone: "west",
      email: EMAIL,
    });
    expect(result).toMatchObject({ ok: false, error: "out_of_stock" });
  });
});

describe("priceCart — shared quota codes", () => {
  const SHARED = `${RUN}-SHARED`.toUpperCase();
  let userId: string;

  beforeAll(async () => {
    const user = await prisma.user.create({
      data: { email: `${RUN}-shareduser@example.com` },
    });
    userId = user.id;
    await prisma.discountCode.create({
      data: {
        code: SHARED,
        issuedEmail: null,
        percentage: 10,
        source: "campaign",
        batchLabel: `${RUN}-shared`,
        maxRedemptions: 2,
        redeemedCount: 0,
      },
    });
  });

  test("applies a shared code with quota remaining", async () => {
    const result = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      email: EMAIL,
      userId,
      code: SHARED,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pricing.discounts.some((d) => d.source === "code")).toBe(true);
  });

  test("rejects once the quota is fully redeemed", async () => {
    await prisma.discountCode.update({
      where: { code: SHARED },
      data: { redeemedCount: 2 },
    });
    const result = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      email: EMAIL,
      userId,
      code: SHARED,
    });
    expect(result).toMatchObject({ ok: false, reason: "fully_redeemed" });
    await prisma.discountCode.update({
      where: { code: SHARED },
      data: { redeemedCount: 0 },
    });
  });

  test("rejects a customer who already redeemed it", async () => {
    const dc = await prisma.discountCode.findUniqueOrThrow({
      where: { code: SHARED },
    });
    await prisma.discountRedemption.create({
      data: { discountCodeId: dc.id, userId },
    });
    const result = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      email: EMAIL,
      userId,
      code: SHARED,
    });
    expect(result).toMatchObject({ ok: false, reason: "already_used" });
    await prisma.discountRedemption.deleteMany({ where: { userId } });
  });
});

describe("markOrderPaid — shared quota concurrency", () => {
  async function makeSharedCode(quota: number) {
    const code = `${RUN}-Q${quota}`.toUpperCase();
    const dc = await prisma.discountCode.create({
      data: {
        code,
        issuedEmail: null,
        percentage: 10,
        source: "campaign",
        batchLabel: `${RUN}-shared`,
        maxRedemptions: quota,
        redeemedCount: 0,
      },
    });
    return { code, id: dc.id };
  }

  async function placeForUser(code: string, email: string) {
    const user = await prisma.user.create({ data: { email } });
    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer({ email }),
      code,
      userId: user.id,
    });
    if (!placed.ok) throw new Error("placement failed");
    return { userId: user.id, orderNumber: placed.orderNumber };
  }

  test("cap holds: 5 distinct customers race a quota of 3 → exactly 3 counted, all honored", async () => {
    const { code, id } = await makeSharedCode(3);
    const placements = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        placeForUser(code, `${RUN}-race${i}@example.com`),
      ),
    );

    const results = await Promise.all(
      placements.map((p) => markOrderPaid(p.orderNumber)),
    );
    expect(results.every((r) => r.ok)).toBe(true);

    const dc = await prisma.discountCode.findUniqueOrThrow({ where: { id } });
    expect(dc.redeemedCount).toBe(3);

    const rows = await prisma.discountRedemption.count({
      where: { discountCodeId: id },
    });
    expect(rows).toBe(3);
  });

  test("once-per-customer: same user pays two orders with the code → counted once", async () => {
    const { code, id } = await makeSharedCode(10);
    const user = await prisma.user.create({
      data: { email: `${RUN}-dupe@example.com` },
    });
    const place = async () => {
      const placed = await placeOrder({
        items: [{ variantId: inStockVariantId, quantity: 1 }],
        shippingZone: "west",
        customer: customer({ email: `${RUN}-dupe@example.com` }),
        code,
        userId: user.id,
      });
      if (!placed.ok) throw new Error("placement failed");
      return placed.orderNumber;
    };
    const [a, b] = [await place(), await place()];

    await Promise.all([markOrderPaid(a), markOrderPaid(b)]);

    const dc = await prisma.discountCode.findUniqueOrThrow({ where: { id } });
    expect(dc.redeemedCount).toBe(1);
    const rows = await prisma.discountRedemption.count({
      where: { discountCodeId: id, userId: user.id },
    });
    expect(rows).toBe(1);
  });
});

describe("placeOrder → markOrderPaid lifecycle", () => {
  test("order persists with snapshot items and server-computed totals", async () => {
    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
      orderNote: "Leave at the guardhouse",
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const order = await prisma.order.findUnique({
      where: { orderNumber: placed.orderNumber },
      include: { items: true },
    });
    expect(order?.status).toBe("pending");
    expect(order?.orderNote).toBe("Leave at the guardhouse");
    expect(order?.items).toHaveLength(1);
    expect(order?.items[0]).toMatchObject({
      productName: "Heavy Tee (spec)",
      size: "M",
      colour: "Black",
      quantity: 1,
    });
    expect(Number(order?.total)).toBeCloseTo(
      (UNIT_PRICE + settings.shippingWest) / 100,
    );

    // Confirmation email is NOT sent at placement — only after payment.
    const confirmation = mailer.sent.find(
      (m) =>
        m.template === "order_confirmation" &&
        m.data.orderNumber === placed.orderNumber,
    );
    expect(confirmation).toBeUndefined();
  });

  test("paying decrements stock and fires the owner alert", async () => {
    const before = await prisma.productVariant.findUnique({
      where: { id: inStockVariantId },
    });
    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 2 }],
      shippingZone: "west",
      customer: customer(),
    });
    if (!placed.ok) throw new Error("expected ok");

    const result = await markOrderPaid(placed.orderNumber);
    expect(result.ok).toBe(true);

    const after = await prisma.productVariant.findUnique({
      where: { id: inStockVariantId },
    });
    expect(after?.stock).toBe((before?.stock ?? 0) - 2);

    const order = await prisma.order.findUnique({
      where: { orderNumber: placed.orderNumber },
    });
    expect(order?.status).toBe("paid");

    expect(
      notifier.alerts.some((a) => a.orderNumber === placed.orderNumber),
    ).toBe(true);

    // Confirmation email goes out now that payment has succeeded.
    const confirmation = mailer.sent.find(
      (m) =>
        m.template === "order_confirmation" &&
        m.data.orderNumber === placed.orderNumber,
    );
    expect(confirmation?.to).toBe(EMAIL);
  });

  test("a sale that crosses the low-stock threshold fires a low-stock alert", async () => {
    const startStock = settings.lowStockThreshold + 1; // one above the line
    const lowProduct = await prisma.product.create({
      data: {
        slug: `${RUN}-lowstock`,
        name: "Last Few (spec)",
        basePrice: "100.00",
        status: "active",
        variants: { create: [{ size: "S", colour: "Red", stock: startStock }] },
      },
      include: { variants: true },
    });

    const placed = await placeOrder({
      items: [{ variantId: lowProduct.variants[0].id, quantity: 1 }], // lands on threshold
      shippingZone: "west",
      customer: customer(),
    });
    if (!placed.ok) throw new Error("expected ok");
    await markOrderPaid(placed.orderNumber);

    const alert = notifier.lowStockAlerts.find(
      (a) => a.orderNumber === placed.orderNumber,
    );
    expect(alert).toBeTruthy();
    expect(alert?.items.some((i) => i.colour === "Red")).toBe(true);

    await prisma.order.deleteMany({ where: { orderNumber: placed.orderNumber } });
    await prisma.product.delete({ where: { id: lowProduct.id } });
  });

  test("marking paid twice does not double-decrement", async () => {
    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
    });
    if (!placed.ok) throw new Error("expected ok");
    await markOrderPaid(placed.orderNumber);
    const once = await prisma.productVariant.findUnique({
      where: { id: inStockVariantId },
    });
    const again = await markOrderPaid(placed.orderNumber);
    expect(again.alreadyPaid).toBe(true);
    const twice = await prisma.productVariant.findUnique({
      where: { id: inStockVariantId },
    });
    expect(twice?.stock).toBe(once?.stock);
  });

  test("status walks paid → processing → shipped (tracking emails the customer)", async () => {
    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
    });
    if (!placed.ok) throw new Error("expected ok");
    await markOrderPaid(placed.orderNumber);
    const order = await prisma.order.findUnique({
      where: { orderNumber: placed.orderNumber },
    });

    expect((await updateOrderStatus(order!.id, "processing")).ok).toBe(true);
    const shipped = await updateOrderStatus(order!.id, "shipped", {
      courierName: "J&T",
      trackingNumber: "JT123456789MY",
    });
    expect(shipped.ok).toBe(true);

    const updated = await prisma.order.findUnique({ where: { id: order!.id } });
    expect(updated?.trackingNumber).toBe("JT123456789MY");

    const statusMail = mailer.sent.find(
      (m) =>
        m.template === "order_status_change" &&
        m.data.orderNumber === placed.orderNumber &&
        m.data.status === "shipped",
    );
    expect(statusMail?.to).toBe(EMAIL);
  });

  test("admin override: any status is settable, and pending→sold deducts stock once", async () => {
    const before = await prisma.productVariant.findUnique({
      where: { id: inStockVariantId },
    });
    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
    });
    if (!placed.ok) throw new Error("expected ok");
    const order = await prisma.order.findUnique({
      where: { orderNumber: placed.orderNumber },
    });

    // pending → shipped is now allowed (admin override) and deducts stock once
    expect((await updateOrderStatus(order!.id, "shipped")).ok).toBe(true);
    const afterShip = await prisma.order.findUnique({ where: { id: order!.id } });
    expect(afterShip?.status).toBe("shipped");
    const stockNow = await prisma.productVariant.findUnique({
      where: { id: inStockVariantId },
    });
    expect(stockNow?.stock).toBe((before?.stock ?? 0) - 1);

    // a terminal order can still be moved (e.g. delivered → cancelled)
    await updateOrderStatus(order!.id, "delivered");
    expect((await updateOrderStatus(order!.id, "cancelled")).ok).toBe(true);
    const stockUnchanged = await prisma.productVariant.findUnique({
      where: { id: inStockVariantId },
    });
    // no double-deduction from the extra transitions
    expect(stockUnchanged?.stock).toBe((before?.stock ?? 0) - 1);
  });
});

describe("promo codes at checkout", () => {
  test("campaign beats code → code is NOT consumed", async () => {
    const campaign = await prisma.campaign.create({
      data: {
        name: `${RUN} Mega`,
        type: "cart_total_tier",
        rules: { tiers: [{ minSubtotal: rm(50), percent: 50 }] },
        active: true,
        priority: 1,
      },
    });
    const code = await prisma.discountCode.create({
      data: {
        code: `CRAZY${RUN.slice(-6).toUpperCase()}A`,
        issuedEmail: EMAIL,
        percentage: 10,
        source: "popup",
      },
    });

    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      code: code.code,
      customer: customer(),
    });
    expect(placed.ok).toBe(true);

    const after = await prisma.discountCode.findUnique({
      where: { id: code.id },
    });
    expect(after?.used).toBe(false);

    await prisma.campaign.delete({ where: { id: campaign.id } });
  });

  test("code is consumed at payment (not placement) → single-use after paid", async () => {
    const user = await prisma.user.create({
      data: { email: `${RUN}-locker@example.com`, name: "Locker" },
    });
    const code = await prisma.discountCode.create({
      data: {
        code: `CRAZY${RUN.slice(-6).toUpperCase()}B`,
        issuedEmail: EMAIL,
        percentage: 10,
        source: "popup",
      },
    });

    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      code: code.code,
      customer: customer(),
      userId: user.id,
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    const order = await prisma.order.findUnique({
      where: { orderNumber: placed.orderNumber },
    });
    expect(order?.appliedDiscountLabel).toBe(code.code);
    expect(Number(order?.discountAmount)).toBeCloseTo(10); // 10% of RM100

    // NOT consumed yet — the order is still pending (failed/abandoned checkout
    // must not burn the code), and it stays reusable until paid.
    let codeRow = await prisma.discountCode.findUnique({ where: { id: code.id } });
    expect(codeRow?.used).toBe(false);
    const stillUsable = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      code: code.code,
      email: EMAIL,
      userId: user.id,
    });
    expect(stillUsable.ok).toBe(true);

    // paying consumes + locks the code
    expect((await markOrderPaid(placed.orderNumber)).ok).toBe(true);
    codeRow = await prisma.discountCode.findUnique({ where: { id: code.id } });
    expect(codeRow?.used).toBe(true);
    expect(codeRow?.lockedUserId).toBe(user.id);

    // single-use: now rejected
    const second = await priceCart({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      code: code.code,
      email: EMAIL,
      userId: user.id,
    });
    expect(second).toMatchObject({ ok: false, error: "invalid_code" });
  });
});
