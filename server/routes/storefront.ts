import { Hono } from "hono";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { issueCodeForEmail } from "@/lib/codes";
import { nextTierGap } from "@/lib/discount";
import { mailer } from "@/lib/integrations/mailer";
import { payment } from "@/lib/integrations/payment";
import {
  markOrderPaid,
  placeOrder,
  priceCart,
  type CheckoutItemInput,
  type ShippingZone,
} from "@/lib/orders";
import { getSettings } from "@/lib/settings";
import { toSen } from "@/lib/money";
import { renderUpsellMessage } from "@/lib/upsell";

export const storefront = new Hono();

async function sessionFor(headers: Headers) {
  return auth.api.getSession({ headers });
}

function parseItems(raw: unknown): CheckoutItemInput[] | null {
  if (!Array.isArray(raw)) return null;
  const items: CheckoutItemInput[] = [];
  for (const entry of raw) {
    if (
      typeof entry?.variantId !== "string" ||
      typeof entry?.quantity !== "number" ||
      entry.quantity < 1
    ) {
      return null;
    }
    items.push({ variantId: entry.variantId, quantity: Math.floor(entry.quantity) });
  }
  return items;
}

function zoneOf(raw: unknown): ShippingZone {
  return raw === "east" ? "east" : "west";
}

// Live cart totals + discount preview. Prices always come from the DB.
storefront.post("/checkout/quote", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const items = parseItems(body.items);
  if (!items) return c.json({ ok: false, message: "Invalid cart." }, 400);
  const session = await sessionFor(c.req.raw.headers);
  const result = await priceCart({
    items,
    shippingZone: zoneOf(body.shippingZone),
    code: typeof body.code === "string" ? body.code : null,
    email:
      typeof body.email === "string" && body.email
        ? body.email
        : (session?.user.email ?? ""),
    userId: session?.user.id ?? null,
  });
  // The quote is a live price preview — an invalid code / soft pricing issue is
  // a normal outcome the client renders, not an HTTP error (avoids console 422s).
  return c.json(result, 200);
});

// Pre-checkout upsell: fired on Checkout click, never blocks.
storefront.post("/checkout/upsell", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const items = parseItems(body.items);
  if (!items) return c.json({ show: false });
  const settings = await getSettings();
  if (!settings.preCheckoutUpsellEnabled) return c.json({ show: false });

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: items.map((i) => i.variantId) } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));
  const lines = items
    .filter((i) => byId.has(i.variantId))
    .map((i) => ({
      unitPrice: Math.round(Number(byId.get(i.variantId)!.product.basePrice) * 100),
      quantity: i.quantity,
    }));
  const campaigns = await prisma.campaign.findMany({ where: { active: true } });
  const gap = nextTierGap({
    items: lines,
    campaigns: campaigns.map((cmp) => ({
      ...cmp,
      type: cmp.type as "quantity_tier",
      rules: cmp.rules,
    })),
  });
  if (!gap) return c.json({ show: false });
  return c.json({
    show: true,
    message: renderUpsellMessage(settings.preCheckoutUpsellTemplate, gap),
    percent: gap.percent,
  });
});

storefront.post("/checkout", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const items = parseItems(body.items);
  const customer = body.customer ?? {};
  if (
    !items ||
    typeof customer.name !== "string" ||
    !customer.name.trim() ||
    typeof customer.email !== "string" ||
    !/.+@.+\..+/.test(customer.email) ||
    typeof customer.address !== "string" ||
    !customer.address.trim() ||
    typeof customer.postcode !== "string" ||
    !customer.postcode.trim() ||
    typeof customer.city !== "string" ||
    !customer.city.trim() ||
    typeof customer.state !== "string" ||
    !customer.state.trim()
  ) {
    return c.json({ ok: false, message: "Missing checkout details." }, 400);
  }
  const session = await sessionFor(c.req.raw.headers);
  const placed = await placeOrder({
    items,
    shippingZone: zoneOf(body.shippingZone),
    code: typeof body.code === "string" ? body.code : null,
    customer: {
      name: customer.name.trim(),
      email: customer.email.trim(),
      phone: typeof customer.phone === "string" ? customer.phone.trim() : undefined,
      address: customer.address.trim(),
      postcode: customer.postcode.trim(),
      city: customer.city.trim(),
      state: customer.state.trim(),
    },
    orderNote: typeof body.orderNote === "string" ? body.orderNote : null,
    userId: session?.user.id ?? null,
  });
  if (!placed.ok) return c.json(placed, 422);

  // The order is persisted (pending); a Stripe failure here leaves it for
  // retry/lookup rather than losing it. 503 → Stripe not configured / down.
  let checkout: { url: string; id: string };
  try {
    checkout = await payment.createCheckout(
      {
        orderNumber: placed.orderNumber,
        totalSen: placed.totalSen,
        customerEmail: customer.email,
      },
      c.req.header("origin") ?? undefined,
    );
  } catch (e) {
    console.error("[checkout] payment.createCheckout failed", e);
    return c.json(
      {
        ok: false,
        orderNumber: placed.orderNumber,
        message: "Payment is temporarily unavailable. Please try again shortly.",
      },
      503,
    );
  }
  return c.json({ ok: true, orderNumber: placed.orderNumber, url: checkout.url });
});

// Stripe sends checkout.session.completed here; verifyWebhook checks the
// signature and markOrderPaid is idempotent against duplicate deliveries.
storefront.post("/webhook/payment", async (c) => {
  const event = await payment.verifyWebhook(c.req.raw);
  if (!event) return c.json({ ok: false }, 400);
  const result = await markOrderPaid(event.orderNumber, event.paymentMethod, {
    reference: event.reference,
    test: event.test,
  });
  return c.json(result, result.ok ? 200 : 404);
});

// Email popup capture → 10% first-purchase code (one per email, reused).
storefront.post("/subscribe", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/.+@.+\..+/.test(email)) {
    return c.json({ ok: false, message: "Enter a valid email." }, 400);
  }
  await prisma.emailSubscriber.upsert({
    where: { email },
    create: { email, source: "popup" },
    update: {},
  });
  const { record, isNew } = await issueCodeForEmail(email, "popup");
  // Email the code exactly once — the first time this address claims it.
  // Re-submitting (or having signed up already) won't fire it again.
  if (isNew) {
    await mailer.send(email, "welcome_code", { code: record.code });
  }
  return c.json({
    ok: true,
    code: record.code,
    percentage: record.percentage,
    used: record.used,
    alreadyClaimed: !isNew,
  });
});

// Guest order lookup: order number + email must both match.
storefront.get("/orders/lookup", async (c) => {
  const orderNumber = c.req.query("orderNumber")?.trim() ?? "";
  const email = c.req.query("email")?.trim().toLowerCase() ?? "";
  if (!orderNumber || !email) return c.json({ ok: false }, 400);
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true },
  });
  if (!order || order.customerEmail !== email) {
    return c.json({ ok: false, message: "No order found for that combination." }, 404);
  }
  return c.json({
    ok: true,
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      placedAt: order.placedAt,
      total: order.total,
      courierName: order.courierName,
      trackingNumber: order.trackingNumber,
      items: order.items.map((i) => ({
        productName: i.productName,
        size: i.size,
        colour: i.colour,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
      })),
    },
  });
});

// Signed-in customer: their 10% code (copyable on the profile page).
storefront.get("/me/code", async (c) => {
  const session = await sessionFor(c.req.raw.headers);
  if (!session) return c.json({ ok: false }, 401);
  const { record } = await issueCodeForEmail(session.user.email, "signup");
  return c.json({
    ok: true,
    code: record.code,
    percentage: record.percentage,
    used: record.used,
  });
});

storefront.get("/me/orders", async (c) => {
  const session = await sessionFor(c.req.raw.headers);
  if (!session) return c.json({ ok: false }, 401);
  const orders = await prisma.order.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { customerEmail: session.user.email.toLowerCase() },
      ],
    },
    include: { items: true },
    orderBy: { placedAt: "desc" },
  });
  return c.json({ ok: true, orders });
});

// ───────────────────────── wishlist (account holders) ─────────────────────────

// Just the product ids — used to light up the hearts across the site.
storefront.get("/wishlist/ids", async (c) => {
  const session = await sessionFor(c.req.raw.headers);
  if (!session) return c.json({ ok: true, ids: [] as string[] });
  const items = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    select: { productId: true },
  });
  return c.json({ ok: true, ids: items.map((i) => i.productId) });
});

// Full wishlist for the profile page.
storefront.get("/wishlist", async (c) => {
  const session = await sessionFor(c.req.raw.headers);
  if (!session) return c.json({ ok: false }, 401);
  const items = await prisma.wishlistItem.findMany({
    where: { userId: session.user.id },
    include: {
      product: {
        include: {
          variants: { select: { stock: true } },
          images: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  return c.json({
    ok: true,
    items: items.map((w) => ({
      productId: w.productId,
      slug: w.product.slug,
      name: w.product.name,
      basePriceSen: toSen(w.product.basePrice),
      image: w.product.images[0]?.imageUrl ?? null,
      soldOut:
        w.product.variants.length > 0 &&
        w.product.variants.every((v) => v.stock <= 0),
    })),
  });
});

storefront.post("/wishlist/toggle", async (c) => {
  const session = await sessionFor(c.req.raw.headers);
  if (!session) {
    return c.json({ ok: false, message: "Sign in to save items." }, 401);
  }
  const body = (await c.req.json().catch(() => ({}))) as { productId?: unknown };
  const productId = typeof body.productId === "string" ? body.productId : "";
  if (!productId) return c.json({ ok: false, message: "Missing product." }, 400);

  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_productId: { userId: session.user.id, productId } },
  });
  if (existing) {
    await prisma.wishlistItem.delete({ where: { id: existing.id } });
    return c.json({ ok: true, wishlisted: false });
  }
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true },
  });
  if (!product) return c.json({ ok: false, message: "Product not found." }, 404);
  await prisma.wishlistItem.create({
    data: { userId: session.user.id, productId },
  });
  return c.json({ ok: true, wishlisted: true });
});
