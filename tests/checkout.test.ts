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
          { size: "M", colour: "Black", stock: 5 },
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
  await prisma.discountCode.deleteMany({
    where: { issuedEmail: { contains: RUN } },
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
      items: [{ variantId: inStockVariantId, quantity: 6 }],
      shippingZone: "west",
      email: EMAIL,
    });
    expect(result).toMatchObject({ ok: false, error: "out_of_stock" });
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

    const confirmation = mailer.sent.find(
      (m) =>
        m.template === "order_confirmation" &&
        m.data.orderNumber === placed.orderNumber,
    );
    expect(confirmation?.to).toBe(EMAIL);
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

  test("illegal transitions are rejected", async () => {
    const placed = await placeOrder({
      items: [{ variantId: inStockVariantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
    });
    if (!placed.ok) throw new Error("expected ok");
    const order = await prisma.order.findUnique({
      where: { orderNumber: placed.orderNumber },
    });
    // pending → shipped skips paid
    expect((await updateOrderStatus(order!.id, "shipped")).ok).toBe(false);
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

  test("code wins → consumed, locked to the signed-in user, single-use", async () => {
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

    const after = await prisma.discountCode.findUnique({
      where: { id: code.id },
    });
    expect(after?.used).toBe(true);
    expect(after?.lockedUserId).toBe(user.id);

    // single-use: second attempt rejected
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
