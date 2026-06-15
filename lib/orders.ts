import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
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
    const validation = validatePromoCode({
      record,
      email: input.email,
      userId: input.userId,
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
}

export type PlaceOrderResult =
  | ({ ok: false } & CheckoutError)
  | { ok: true; orderId: string; orderNumber: string; totalSen: number };

export async function placeOrder(
  input: PlaceOrderInput,
): Promise<PlaceOrderResult> {
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
  const order = await prisma.order.create({
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

  await mailer.send(order.customerEmail, "order_confirmation", {
    orderNumber: order.orderNumber,
    total: toRM(pricing.total),
    items: lines.map(
      (l) => `${l.quantity}× ${l.productName} (${l.size}/${l.colour})`,
    ),
  });

  return {
    ok: true,
    orderId: order.id,
    orderNumber: order.orderNumber,
    totalSen: pricing.total,
  };
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
        for (const item of input.items) {
          const v = await tx.productVariant.findUnique({
            where: { id: item.variantId },
          });
          if (!v) throw new Error("An item is no longer available.");
          if (v.stock < item.quantity) {
            const line = byId.get(item.variantId)!;
            throw new Error(
              `Not enough stock for ${line.product.name} (${line.size}/${line.colour}) — ${v.stock} left.`,
            );
          }
          await tx.productVariant.update({
            where: { id: v.id },
            data: { stock: v.stock - item.quantity },
          });
        }
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
    });
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
    const order = await tx.order.findUnique({
      where: { orderNumber },
      include: { items: true },
    });
    if (!order) return { ok: false as const };
    if (order.status !== "pending") {
      return { ok: order.status === "paid", alreadyPaid: true };
    }

    // Consume the discount code now (race-safe single-use) — only on a real
    // payment, so abandoned/failed checkouts don't burn it.
    if (order.discountCodeId) {
      await tx.discountCode.updateMany({
        where: { id: order.discountCodeId, used: false },
        data: {
          used: true,
          ...(order.userId ? { lockedUserId: order.userId } : {}),
        },
      });
    }

    for (const item of order.items) {
      const variant = await tx.productVariant.findUnique({
        where: {
          productId_size_colour: {
            productId: item.productId,
            size: item.size,
            colour: item.colour,
          },
        },
      });
      if (variant) {
        await tx.productVariant.update({
          where: { id: variant.id },
          data: { stock: Math.max(0, variant.stock - item.quantity) },
        });
      }
    }

    const updated = await tx.order.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paymentMethod,
        ...(opts.reference ? { paymentRef: opts.reference } : {}),
        ...(opts.test ? { isTest: true } : {}),
      },
      include: { items: true },
    });
    return { ok: true as const, order: updated };
  });

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
  });

  await mailer.send(updated.customerEmail, "order_status_change", {
    orderNumber: updated.orderNumber,
    status: next,
    courierName: updated.courierName,
    trackingNumber: updated.trackingNumber,
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
