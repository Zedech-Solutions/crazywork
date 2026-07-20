import { randomBytes } from "crypto";
import { prisma, TX_OPTS } from "@/lib/db";
import { evaluateCart, type PricingResult } from "@/lib/discount";
import { toSen } from "@/lib/money";
import {
  PROMO_REJECTION_MESSAGES,
  validatePromoCode,
  type PromoRejection,
} from "@/lib/promoCode";
import { getSettings } from "@/lib/settings";
import { crossedLowStock } from "@/lib/lowStock";
import { mailer } from "@/lib/integrations/mailer";
import { notifier } from "@/lib/integrations/notifier";

export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled";

export type ShippingZone = "west" | "east";

const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["paid", "cancelled"],
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isVariantSoldOut(variant: { stock: number }): boolean {
  return variant.stock <= 0;
}

export function isProductSoldOut(variants: { stock: number }[]): boolean {
  return variants.every(isVariantSoldOut);
}

const ORDER_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateOrderNumber(now = new Date()): string {
  const stamp = now.toISOString().slice(2, 10).replaceAll("-", "");
  let suffix = "";
  for (const byte of randomBytes(4)) {
    suffix += ORDER_ALPHABET[byte % ORDER_ALPHABET.length];
  }
  return `CW-${stamp}-${suffix}`;
}

// ───────────────────────── pricing ─────────────────────────

export interface CheckoutItemInput {
  variantId: string;
  quantity: number;
}

export interface PricedLine {
  variantId: string;
  productId: string;
  productName: string;
  size: string;
  colour: string;
  unitPrice: number; // sen
  costPrice: number | null; // sen, snapshot for profit/margin
  quantity: number;
}

export type CheckoutError =
  | { error: "empty_cart"; message: string }
  | { error: "unknown_variant"; message: string }
  | { error: "out_of_stock"; message: string; variantId: string }
  | { error: "invalid_code"; message: string; reason: PromoRejection };

export type PriceCartResult =
  | ({ ok: false } & CheckoutError)
  | {
      ok: true;
      pricing: PricingResult;
      lines: PricedLine[];
      appliedCodeId: string | null;
      lockToUserId: string | null;
    };

export async function priceCart(input: {
  items: CheckoutItemInput[];
  shippingZone: ShippingZone;
  code?: string | null;
  email: string;
  userId?: string | null;
  now?: Date;
}): Promise<PriceCartResult> {
  if (input.items.length === 0) {
    return { ok: false, error: "empty_cart", message: "Your cart is empty." };
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: input.items.map((i) => i.variantId) } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: PricedLine[] = [];
  for (const item of input.items) {
    const variant = byId.get(item.variantId);
    if (!variant || variant.product.status !== "active") {
      return {
        ok: false,
        error: "unknown_variant",
        message: "An item in your cart is no longer available.",
      };
    }
    if (item.quantity < 1 || variant.stock < item.quantity) {
      return {
        ok: false,
        error: "out_of_stock",
        message: `${variant.product.name} (${variant.size}/${variant.colour}) is sold out.`,
        variantId: variant.id,
      };
    }
    lines.push({
      variantId: variant.id,
      productId: variant.productId,
      productName: variant.product.name,
      size: variant.size,
      colour: variant.colour,
      unitPrice: toSen(variant.product.basePrice),
      costPrice: variant.costPrice != null ? toSen(variant.costPrice) : null,
      quantity: item.quantity,
    });
  }

  const settings = await getSettings();
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const baseShipping =
    input.shippingZone === "east" ? settings.shippingEast : settings.shippingWest;
  // store-level free-shipping threshold (campaigns can also waive it)
  const shippingFee =
    subtotal >= settings.freeShippingThreshold ? 0 : baseShipping;

  const campaigns = await prisma.campaign.findMany({ where: { active: true } });

  let appliedCode: {
    code: string;
    percentage: number;
    amountOffSen?: number | null;
  } | null = null;
  let appliedCodeId: string | null = null;
  let lockToUserId: string | null = null;
  if (input.code?.trim()) {
    const record = await prisma.discountCode.findUnique({
      where: { code: input.code.trim().toUpperCase() },
    });
    let alreadyRedeemedByUser = false;
    if (record?.maxRedemptions != null && input.userId) {
      const existing = await prisma.discountRedemption.findUnique({
        where: {
          discountCodeId_userId: {
            discountCodeId: record.id,
            userId: input.userId,
          },
        },
      });
      alreadyRedeemedByUser = existing != null;
    }
    const validation = validatePromoCode({
      record,
      email: input.email,
      userId: input.userId,
      alreadyRedeemedByUser,
      now: input.now,
    });
    if (!validation.ok) {
      return {
        ok: false,
        error: "invalid_code",
        message: PROMO_REJECTION_MESSAGES[validation.reason],
        reason: validation.reason,
      };
    }
    appliedCode = {
      code: record!.code,
      percentage: record!.percentage,
      amountOffSen: record!.amountOffSen,
    };
    appliedCodeId = record!.id;
    lockToUserId = validation.lockToUserId;
  }

  const pricing = evaluateCart({
    items: lines,
    campaigns: campaigns.map((c) => ({
      ...c,
      type: c.type as "quantity_tier",
      rules: c.rules,
    })),
    code: appliedCode,
    shippingFee,
    now: input.now,
  });

  return { ok: true, pricing, lines, appliedCodeId, lockToUserId };
}

// ───────────────────────── order placement ─────────────────────────

const toRM = (sen: number) => (sen / 100).toFixed(2);

// Build the item rows for an order email: a label plus the product's primary
// photo (R2 URL) for the thumbnail strip. Shared by confirmation + status mails.
async function orderEmailItems(
  items: {
    productId: string;
    productName: string;
    size: string;
    colour: string;
    quantity: number;
  }[],
): Promise<{ label: string; image: string | null }[]> {
  return Promise.all(
    items.map(async (i) => {
      const img = await prisma.productImage.findFirst({
        where: { productId: i.productId, mediaType: "image" },
        orderBy: { sortOrder: "asc" },
        select: { imageUrl: true },
      });
      return {
        label: `${i.quantity}× ${i.productName} (${i.size}/${i.colour})`,
        image: img?.imageUrl ?? null,
      };
    }),
  );
}

export interface PlaceOrderInput {
  items: CheckoutItemInput[];
  shippingZone: ShippingZone;
  code?: string | null;
  customer: {
    name: string;
    email: string;
    phone?: string;
    address: string;
    postcode?: string;
    city?: string;
    state: string;
  };
  orderNote?: string | null;
  userId?: string | null;
  // Client-supplied key that collapses a double-click / retry into one order.
  idempotencyKey?: string | null;
}

export type PlaceOrderResult =
  | ({ ok: false } & CheckoutError)
  | { ok: true; orderId: string; orderNumber: string; totalSen: number };

// A prior order created under the same idempotency key → return it unchanged.
function orderResult(order: {
  id: string;
  orderNumber: string;
  total: { toString(): string };
}): PlaceOrderResult {
  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalSen: toSen(order.total),
  };
}

// Prisma unique-constraint violation on the idempotencyKey column — a concurrent
// request under the same key won the create race.
function isIdempotencyConflict(e: unknown): boolean {
  const err = e as { code?: string; meta?: { target?: unknown } };
  return (
    err?.code === "P2002" &&
    JSON.stringify(err?.meta?.target ?? "").includes("idempotencyKey")
  );
}

// How long a pending order holds its reserved stock before it auto-releases.
// Deliberately a touch LONGER than the Stripe Checkout session expiry
// (STRIPE_SESSION_TTL_MS, 30 min — Stripe's minimum): the hold must outlive the
// window in which a payment can still land, so the sweep never frees stock a
// customer is about to pay for. The gap is the safety margin.
export const RESERVATION_TTL_MS = 35 * 60 * 1000;

// Thrown inside the placement transaction when a line can't be satisfied, so the
// whole reservation rolls back (no partial stock claim). Carries the variantId
// to reconstruct the typed out_of_stock result for the caller.
class ReservationError extends Error {
  constructor(
    readonly variantId: string,
    message: string,
  ) {
    super(message);
  }
}

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
  const key = input.idempotencyKey?.trim() || null;
  // Fast path, before anything else: a retry of an already-placed submission
  // returns that order verbatim — no re-pricing, no second reservation. Must run
  // ahead of priceCart so a retry still succeeds even if the item has since sold
  // out (the customer already holds a valid order).
  if (key) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: key },
    });
    if (existing) return orderResult(existing);
  }

  const priced = await priceCart({
    items: input.items,
    shippingZone: input.shippingZone,
    code: input.code,
    email: input.customer.email,
    userId: input.userId,
  });
  if (!priced.ok) return priced;

  const { pricing, lines } = priced;
  // The code is consumed whenever it contributed a discount — including when it
  // stacks on top of a campaign (so discountSource may be "campaign").
  const codeConsumed = pricing.discounts.some((d) => d.source === "code");

  // The code is only *recorded* on the order here — it isn't consumed until the
  // order is actually paid (markOrderPaid), so a failed/abandoned checkout never
  // burns a single-use code.
  try {
    const order = await prisma.$transaction(async (tx) => {
      // Create the order FIRST so the unique idempotencyKey claims the slot
      // before any stock moves. A concurrent request under the same key trips
      // the unique constraint here and rolls back without touching stock.
      const created = await tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId: input.userId ?? null,
          customerName: input.customer.name,
          customerEmail: input.customer.email.trim().toLowerCase(),
          customerPhone: input.customer.phone ?? null,
          shippingAddress: input.customer.address,
          shippingPostcode: input.customer.postcode ?? null,
          shippingCity: input.customer.city ?? null,
          shippingState: input.customer.state,
          shippingZone: input.shippingZone,
          shippingFee: toRM(pricing.shippingFee),
          subtotal: toRM(pricing.subtotal),
          discountAmount: toRM(pricing.discountAmount),
          total: toRM(pricing.total),
          appliedDiscountLabel: pricing.discountLabel,
          discountCodeId: codeConsumed ? priced.appliedCodeId : null,
          orderNote: input.orderNote ?? null,
          idempotencyKey: key,
          // Stock is now held by this order; payment must not decrement again.
          stockReserved: true,
          reservationExpiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              size: line.size,
              colour: line.colour,
              unitPrice: toRM(line.unitPrice),
              costPrice: line.costPrice != null ? toRM(line.costPrice) : null,
              quantity: line.quantity,
            })),
          },
        },
      });

      // Reserve stock atomically. Each guarded decrement (WHERE stock >= qty) is
      // the authoritative oversell guard — priceCart's earlier check is only an
      // advisory fast-path. If any line can't be satisfied we throw, rolling back
      // the order create and every decrement so far.
      for (const line of lines) {
        const dec = await tx.productVariant.updateMany({
          where: { id: line.variantId, stock: { gte: line.quantity } },
          data: { stock: { decrement: line.quantity } },
        });
        if (dec.count === 0) {
          throw new ReservationError(
            line.variantId,
            `${line.productName} (${line.size}/${line.colour}) is sold out.`,
          );
        }
      }

      return created;
    }, TX_OPTS);

    // The order confirmation email is sent on payment success (markOrderPaid),
    // not here at placement — a pending order isn't confirmed until it's paid.
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalSen: pricing.total,
    };
  } catch (e) {
    if (e instanceof ReservationError) {
      return {
        ok: false,
        error: "out_of_stock",
        message: e.message,
        variantId: e.variantId,
      };
    }
    // Lost the create race under the same idempotency key — return the order the
    // winner created.
    if (key && isIdempotencyConflict(e)) {
      const existing = await prisma.order.findUnique({
        where: { idempotencyKey: key },
      });
      if (existing) return orderResult(existing);
    }
    throw e;
  }
}

// Release a pending order's reserved stock back onto the shelf and cancel it.
// Used when a checkout is abandoned (Stripe session expires) or a hold times out.
// The `status: pending, stockReserved: true` guard on the flip makes this atomic
// and idempotent: only the first caller restores stock; a paid order (or an
// already-released one) is left untouched.
export async function releaseReservation(
  orderNumber: string,
): Promise<{ released: boolean }> {
  return prisma.$transaction(async (tx) => {
    const flip = await tx.order.updateMany({
      where: { orderNumber, status: "pending", stockReserved: true },
      data: { status: "cancelled", stockReserved: false },
    });
    if (flip.count === 0) return { released: false };

    const order = await tx.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) return { released: false };

    await Promise.all(
      order.items.map((item) =>
        tx.productVariant.updateMany({
          where: {
            productId: item.productId,
            size: item.size,
            colour: item.colour,
          },
          data: { stock: { increment: item.quantity } },
        }),
      ),
    );
    return { released: true };
  }, TX_OPTS);
}

// Sweep pending holds whose reservation window has passed, handing their stock
// back. A backstop for the Stripe session-expired webhook (a webhook can be
// missed / delayed); safe to run on a schedule. Releases are idempotent, so a
// row a concurrent webhook already released is simply skipped.
export async function sweepExpiredReservations(
  now = new Date(),
): Promise<{ released: number }> {
  const stale = await prisma.order.findMany({
    where: {
      status: "pending",
      stockReserved: true,
      reservationExpiresAt: { lt: now },
    },
    select: { orderNumber: true },
  });
  let released = 0;
  for (const { orderNumber } of stale) {
    const res = await releaseReservation(orderNumber);
    if (res.released) released += 1;
  }
  return { released };
}

// ───────────────────────── manual / offline orders ─────────────────────────

// Statuses that mean the sale happened → stock should come off the shelf.
const STOCK_DEDUCTING: OrderStatus[] = [
  "paid",
  "processing",
  "shipped",
  "delivered",
];

export interface ManualOrderInput {
  items: CheckoutItemInput[];
  customer: {
    name: string;
    email?: string;
    phone?: string;
    address?: string;
    state?: string;
  };
  status: OrderStatus;
  note?: string | null;
  /** Amount actually charged, in sen. Defaults to the item subtotal; a lower
   *  value is recorded as a discount (e.g. a friends-and-family promo). */
  totalSen?: number;
  /** Create / link a customer account by email so they show as a real customer
   *  (not a guest) in the CRM. */
  createCustomer?: boolean;
  /** How the sale was paid (cash, bank transfer, etc.). Defaults to "offline". */
  paymentMethod?: string;
}

export type ManualOrderResult =
  | { ok: false; message: string }
  | { ok: true; orderId: string; orderNumber: string; totalSen: number };

// Admin-created order (offline / walk-in sale). No shipping or discounts; stock
// is deducted immediately when the chosen status implies the sale is done.
export async function createManualOrder(
  input: ManualOrderInput,
): Promise<ManualOrderResult> {
  if (!input.items.length) {
    return { ok: false, message: "Add at least one item." };
  }
  if (!input.customer.name.trim()) {
    return { ok: false, message: "Customer name is required." };
  }

  const variants = await prisma.productVariant.findMany({
    where: { id: { in: input.items.map((i) => i.variantId) } },
    include: { product: true },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  const lines: PricedLine[] = [];
  for (const item of input.items) {
    const v = byId.get(item.variantId);
    if (!v) return { ok: false, message: "An item is no longer available." };
    if (item.quantity < 1) {
      return { ok: false, message: "Quantities must be at least 1." };
    }
    lines.push({
      variantId: v.id,
      productId: v.productId,
      productName: v.product.name,
      size: v.size,
      colour: v.colour,
      unitPrice: toSen(v.product.basePrice),
      costPrice: v.costPrice != null ? toSen(v.costPrice) : null,
      quantity: item.quantity,
    });
  }

  const deductsStock = STOCK_DEDUCTING.includes(input.status);
  const subtotalSen = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const totalSen =
    input.totalSen != null && input.totalSen >= 0
      ? Math.round(input.totalSen)
      : subtotalSen;
  const discountSen = Math.max(0, subtotalSen - totalSen);
  const email = (input.customer.email ?? "").trim().toLowerCase();

  if (input.createCustomer && !email) {
    return { ok: false, message: "Add an email to create a customer." };
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      // Optionally create / link a customer account by email.
      let userId: string | null = null;
      if (input.createCustomer && email) {
        const existing = await tx.user.findUnique({
          where: { email },
          select: { id: true },
        });
        userId = existing
          ? existing.id
          : (
              await tx.user.create({
                data: {
                  email,
                  name: input.customer.name.trim(),
                  phone: input.customer.phone?.trim() || null,
                  role: "customer",
                },
              })
            ).id;
      }

      if (deductsStock) {
        // Guarded decrements in parallel — avoids sequential round-trips inside
        // the interactive transaction while preventing read-then-write oversell.
        await Promise.all(
          input.items.map(async (item) => {
            const dec = await tx.productVariant.updateMany({
              where: { id: item.variantId, stock: { gte: item.quantity } },
              data: { stock: { decrement: item.quantity } },
            });
            if (dec.count === 0) {
              // Either variant missing or insufficient stock — surface to caller.
              const v = await tx.productVariant.findUnique({
                where: { id: item.variantId },
                select: { stock: true },
              });
              const meta = byId.get(item.variantId);
              if (!v) throw new Error("An item is no longer available.");
              throw new Error(
                `Not enough stock for ${meta?.product.name ?? item.variantId} (${meta?.size ?? "?"}/${meta?.colour ?? "?"}) — ${v.stock} left.`,
              );
            }
          }),
        );
      }
      return tx.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          customerName: input.customer.name.trim(),
          customerEmail: email,
          customerPhone: input.customer.phone?.trim() || null,
          shippingAddress: input.customer.address?.trim() || "Walk-in / offline",
          shippingState: input.customer.state?.trim() || "—",
          shippingZone: "west",
          shippingFee: "0.00",
          subtotal: toRM(subtotalSen),
          discountAmount: toRM(discountSen),
          total: toRM(totalSen),
          appliedDiscountLabel: discountSen > 0 ? "Manual adjustment" : null,
          discountCodeId: null,
          orderNote: input.note?.trim() || null,
          paymentMethod: deductsStock
            ? input.paymentMethod?.trim() || "offline"
            : null,
          manual: true,
          status: input.status,
          // If this offline sale already took stock off the shelf, mark it
          // reserved so a later markOrderPaid (via updateOrderStatus) won't
          // decrement a second time.
          stockReserved: deductsStock,
          items: {
            create: lines.map((line) => ({
              productId: line.productId,
              productName: line.productName,
              size: line.size,
              colour: line.colour,
              unitPrice: toRM(line.unitPrice),
              costPrice: line.costPrice != null ? toRM(line.costPrice) : null,
              quantity: line.quantity,
            })),
          },
        },
      });
    }, TX_OPTS);
    return {
      ok: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      totalSen,
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// ───────────────────────── payment / fulfilment ─────────────────────────

export async function markOrderPaid(
  orderNumber: string,
  paymentMethod = "stub",
  opts: { reference?: string; test?: boolean } = {},
): Promise<{ ok: boolean; alreadyPaid?: boolean }> {
  const result = await prisma.$transaction(async (tx) => {
    // FIRST: atomically flip status from "pending" → "paid". If count === 0
    // the order was already processed by a concurrent call — short-circuit.
    const flip = await tx.order.updateMany({
      where: { orderNumber, status: "pending" },
      data: {
        status: "paid",
        paymentMethod,
        ...(opts.reference ? { paymentRef: opts.reference } : {}),
        ...(opts.test ? { isTest: true } : {}),
      },
    });
    if (flip.count === 0) {
      // Already paid (or doesn't exist); return alreadyPaid for the caller.
      const existing = await tx.order.findUnique({
        where: { orderNumber },
        select: { status: true },
      });
      if (!existing) return { ok: false as const };
      return { ok: existing.status === "paid", alreadyPaid: true };
    }

    // Fetch the full order now that we own the status transition.
    const order = await tx.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) return { ok: false as const };

    // Consume the discount code now — only on a real payment, so abandoned/
    // failed checkouts don't burn it.
    if (order.discountCodeId) {
      const dc = await tx.discountCode.findUnique({
        where: { id: order.discountCodeId },
        select: { maxRedemptions: true },
      });
      if (dc?.maxRedemptions != null) {
        // Shared quota code. Guard A: atomic conditional increment — Postgres
        // serializes the row update, so the WHERE makes overselling impossible.
        const inc = await tx.discountCode.updateMany({
          where: {
            id: order.discountCodeId,
            redeemedCount: { lt: dc.maxRedemptions },
          },
          data: { redeemedCount: { increment: 1 } },
        });
        if (inc.count === 1 && order.userId) {
          // Guard B: once-per-customer. The @@unique(discountCodeId, userId)
          // index makes the insert a no-op for a repeat customer (skipDuplicates
          // avoids throwing inside the transaction).
          const ins = await tx.discountRedemption.createMany({
            data: [
              {
                discountCodeId: order.discountCodeId,
                userId: order.userId,
                orderId: order.id,
              },
            ],
            skipDuplicates: true,
          });
          if (ins.count === 0) {
            // This customer already redeemed (a concurrent second order). Undo
            // the slot so the repeat doesn't consume quota; the order is honored.
            await tx.discountCode.updateMany({
              where: { id: order.discountCodeId },
              data: { redeemedCount: { decrement: 1 } },
            });
          }
        }
        // inc.count === 0 → quota already exhausted by a concurrent payment.
        // The order was already charged the discounted amount, so honor it
        // without incrementing further (bounded overage, surfaced in admin).
      } else {
        // Legacy single-use code (race-safe via WHERE used:false).
        await tx.discountCode.updateMany({
          where: { id: order.discountCodeId, used: false },
          data: {
            used: true,
            ...(order.userId ? { lockedUserId: order.userId } : {}),
          },
        });
      }
    }

    // Storefront orders reserve their stock at placement (order.stockReserved),
    // so payment must not decrement again. Only orders that did NOT reserve
    // up front — e.g. a manual pending order an admin promotes to paid — deduct
    // here.
    //
    // Guarded stock decrements — use updateMany with stock ≥ qty so the WHERE
    // acts as the guard; no separate read needed. Batch all items in parallel
    // to avoid holding the connection across sequential per-item round-trips.
    //
    // Variant resolution: items carry productId+size+colour (not a stored
    // variantId), matching the productId_size_colour unique index on the table.
    if (!order.stockReserved) {
      await Promise.all(
        order.items.map(async (item) => {
          // Attempt an atomic guarded decrement.
          const dec = await tx.productVariant.updateMany({
            where: {
              productId: item.productId,
              size: item.size,
              colour: item.colour,
              stock: { gte: item.quantity },
            },
            data: { stock: { decrement: item.quantity } },
          });
          if (dec.count === 0) {
            // No row matched — stock was already at 0 or below qty. Clamp to 0
            // and surface an oversell warning via the same notifier used elsewhere.
            // The stock < quantity guard keeps the clamp from zeroing a variant a
            // concurrent restock/decrement has meanwhile pushed to a satisfiable level.
            await tx.productVariant.updateMany({
              where: {
                productId: item.productId,
                size: item.size,
                colour: item.colour,
                stock: { lt: item.quantity },
              },
              data: { stock: 0 },
            });
            console.warn(
              `[oversell] order ${orderNumber}: ${item.productName} (${item.size}/${item.colour}) — ` +
                `not enough stock for qty ${item.quantity}; clamped to 0`,
            );
          }
        }),
      );
    }

    return { ok: true as const, order };
  }, TX_OPTS);

  if (result.ok && "order" in result && result.order) {
    const order = result.order;
    // Stock was just decremented in the transaction above; read it back so the
    // alert can show how many are left of each ordered variant.
    const items = await Promise.all(
      order.items.map(async (i) => {
        const variant = await prisma.productVariant.findUnique({
          where: {
            productId_size_colour: {
              productId: i.productId,
              size: i.size,
              colour: i.colour,
            },
          },
          select: { stock: true },
        });
        return {
          productName: i.productName,
          size: i.size,
          colour: i.colour,
          quantity: i.quantity,
          stockLeft: variant?.stock ?? null,
        };
      }),
    );
    await notifier.orderPlaced({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      totalSen: toSen(order.total),
      items,
      test: order.isTest,
    });

    // Confirmation email to the customer — only now that payment has succeeded.
    await mailer.send(order.customerEmail, "order_confirmation", {
      orderNumber: order.orderNumber,
      total: toRM(toSen(order.total)),
      items: await orderEmailItems(order.items),
    });

    // Warn (on a separate channel) about any variant this sale just pushed low.
    const { lowStockThreshold } = await getSettings();
    const crossed = crossedLowStock(items, lowStockThreshold);
    if (crossed.length) {
      await notifier.lowStock({
        orderNumber: order.orderNumber,
        threshold: lowStockThreshold,
        items: crossed,
        test: order.isTest,
      });
    }
  }
  return { ok: result.ok, alreadyPaid: "alreadyPaid" in result ? result.alreadyPaid : undefined };
}

export async function updateOrderStatus(
  orderId: string,
  next: OrderStatus,
  opts: { courierName?: string; trackingNumber?: string } = {},
): Promise<{ ok: boolean; message?: string }> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { ok: false, message: "Order not found." };

  // A pending order first becoming "sold" (any stock-deducting status) runs the
  // paid transition once — deducts stock + fires the paid side-effects (alert).
  if (order.status === "pending" && STOCK_DEDUCTING.includes(next)) {
    const paid = await markOrderPaid(order.orderNumber, "manual");
    if (!paid.ok) return { ok: false, message: "Order cannot be marked paid." };
    if (next === "paid") return { ok: true };
  }

  // Cancelling a still-pending order that holds reserved stock releases the
  // hold back onto the shelf (idempotent — a no-op if a webhook/sweep beat us).
  if (order.status === "pending" && order.stockReserved && next === "cancelled") {
    await releaseReservation(order.orderNumber);
  }

  // Admin override: every order is freely editable — no lifecycle lock, so even
  // delivered/cancelled orders can be moved to any status.
  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: next,
      ...(opts.courierName !== undefined ? { courierName: opts.courierName } : {}),
      ...(opts.trackingNumber !== undefined
        ? { trackingNumber: opts.trackingNumber }
        : {}),
    },
    include: { items: true },
  });

  await mailer.send(updated.customerEmail, "order_status_change", {
    orderNumber: updated.orderNumber,
    status: next,
    courierName: updated.courierName,
    trackingNumber: updated.trackingNumber,
    items: await orderEmailItems(updated.items),
  });

  return { ok: true };
}

// ───────────────────────── CSV export ─────────────────────────

export interface CsvOrderRow {
  orderNumber: string;
  placedAt: Date;
  customerName: string;
  customerEmail: string;
  status: string;
  shippingZone: string;
  subtotalSen: number;
  discountAmountSen: number;
  shippingFeeSen: number;
  totalSen: number;
  appliedDiscountLabel: string | null;
  trackingNumber: string | null;
  itemSummary: string;
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function ordersToCsv(rows: CsvOrderRow[]): string {
  const header =
    "Order,Date,Customer,Email,Status,Zone,Subtotal,Discount,Shipping,Total,Discount Label,Tracking,Items";
  const body = rows.map((row) =>
    [
      row.orderNumber,
      row.placedAt.toISOString(),
      row.customerName,
      row.customerEmail,
      row.status,
      row.shippingZone,
      toRM(row.subtotalSen),
      toRM(row.discountAmountSen),
      toRM(row.shippingFeeSen),
      toRM(row.totalSen),
      row.appliedDiscountLabel ?? "",
      row.trackingNumber ?? "",
      row.itemSummary,
    ]
      .map(csvCell)
      .join(","),
  );
  return [header, ...body].join("\n") + "\n";
}
