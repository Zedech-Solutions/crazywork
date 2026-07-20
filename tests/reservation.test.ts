import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import {
  markOrderPaid,
  placeOrder,
  releaseReservation,
  sweepExpiredReservations,
  updateOrderStatus,
  type PlaceOrderInput,
} from "@/lib/orders";

// Integration tests — require the docker-compose Postgres.
// These cover the stock-reservation lifecycle: stock is claimed atomically at
// placement (not at payment), so concurrent buyers can never oversell.

const RUN = `resspec-${Date.now()}`;

function customer(
  overrides: Partial<PlaceOrderInput["customer"]> = {},
): PlaceOrderInput["customer"] {
  return {
    name: "Aina Test",
    email: `${RUN}@example.com`,
    phone: "0123456789",
    address: "1 Jalan Test, Taman Uji",
    postcode: "43000",
    city: "Kajang",
    state: "Selangor",
    ...overrides,
  };
}

let productId: string;

// Fresh single-variant product with the given stock — isolates each stock test.
async function makeVariant(stock: number): Promise<string> {
  const p = await prisma.product.create({
    data: {
      slug: `${RUN}-${Math.random().toString(36).slice(2, 10)}`,
      name: "Reservation Tee (spec)",
      basePrice: "100.00",
      status: "active",
      variants: { create: [{ size: "M", colour: "Black", stock }] },
    },
    include: { variants: true },
  });
  productId = p.id;
  return p.variants[0].id;
}

async function stockOf(variantId: string): Promise<number> {
  const v = await prisma.productVariant.findUnique({ where: { id: variantId } });
  return v!.stock;
}

afterAll(async () => {
  await prisma.order.deleteMany({ where: { customerEmail: { contains: RUN } } });
  await prisma.product.deleteMany({ where: { slug: { contains: RUN } } });
});

describe("stock reservation at placement", () => {
  test("placeOrder claims stock immediately, and payment does not double-decrement", async () => {
    const variantId = await makeVariant(10);

    const placed = await placeOrder({
      items: [{ variantId, quantity: 2 }],
      shippingZone: "west",
      customer: customer(),
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) return;

    // Reserved at placement — before any payment.
    expect(await stockOf(variantId)).toBe(8);

    // Paying must NOT decrement a second time (stock already came off the shelf).
    await markOrderPaid(placed.orderNumber);
    expect(await stockOf(variantId)).toBe(8);
  });

  test("concurrent buyers cannot oversell the last unit", async () => {
    const variantId = await makeVariant(1);

    // Ten buyers race for a single unit — all pass priceCart's advisory check,
    // but only the reservation can actually claim the stock.
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        placeOrder({
          items: [{ variantId, quantity: 1 }],
          shippingZone: "west",
          customer: customer({ email: `${RUN}-race${i}@example.com` }),
        }),
      ),
    );

    const won = results.filter((r) => r.ok);
    const lost = results.filter((r) => !r.ok);
    expect(won).toHaveLength(1);
    expect(lost).toHaveLength(9);
    expect(lost.every((r) => !r.ok && r.error === "out_of_stock")).toBe(true);

    // Never negative, never oversold: exactly the one unit is gone.
    expect(await stockOf(variantId)).toBe(0);
  });

  test("a reservation that fails on a later line rolls back its earlier claim", async () => {
    // One plentiful variant and one with a single unit. Two orders each want the
    // plentiful line first, then the scarce line — so they both decrement the
    // plentiful line, then contend for the last scarce unit. The loser fails on
    // the scarce line and must roll back the plentiful unit it already claimed.
    const p = await prisma.product.create({
      data: {
        slug: `${RUN}-multi-${Math.random().toString(36).slice(2, 8)}`,
        name: "Multi Variant (spec)",
        basePrice: "100.00",
        status: "active",
        variants: {
          create: [
            { size: "M", colour: "Black", stock: 5 },
            { size: "L", colour: "Black", stock: 1 },
          ],
        },
      },
      include: { variants: true },
    });
    const plentiful = p.variants.find((v) => v.size === "M")!.id;
    const scarce = p.variants.find((v) => v.size === "L")!.id;

    const items = [
      { variantId: plentiful, quantity: 1 },
      { variantId: scarce, quantity: 1 },
    ];
    const [a, b] = await Promise.all([
      placeOrder({
        items,
        shippingZone: "west",
        customer: customer({ email: `${RUN}-rbA@example.com` }),
      }),
      placeOrder({
        items,
        shippingZone: "west",
        customer: customer({ email: `${RUN}-rbB@example.com` }),
      }),
    ]);

    // Exactly one order wins the scarce unit.
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    // The loser rolled its plentiful claim back: only the winner's unit is gone.
    expect(await stockOf(plentiful)).toBe(4);
    expect(await stockOf(scarce)).toBe(0);
  });
});

describe("releasing a reservation", () => {
  async function place(variantId: string, qty = 1) {
    const placed = await placeOrder({
      items: [{ variantId, quantity: qty }],
      shippingZone: "west",
      customer: customer(),
    });
    if (!placed.ok) throw new Error("placement failed");
    return placed;
  }

  test("releasing a pending order restores its stock and cancels it", async () => {
    const variantId = await makeVariant(3);
    const placed = await place(variantId, 2);
    expect(await stockOf(variantId)).toBe(1);

    const res = await releaseReservation(placed.orderNumber);
    expect(res.released).toBe(true);

    expect(await stockOf(variantId)).toBe(3); // stock handed back
    const order = await prisma.order.findUnique({
      where: { orderNumber: placed.orderNumber },
    });
    expect(order?.status).toBe("cancelled");
    expect(order?.stockReserved).toBe(false);
  });

  test("releasing is idempotent — a second call never double-restores", async () => {
    const variantId = await makeVariant(3);
    const placed = await place(variantId, 2);

    await releaseReservation(placed.orderNumber);
    const second = await releaseReservation(placed.orderNumber);
    expect(second.released).toBe(false);
    expect(await stockOf(variantId)).toBe(3); // not 5
  });

  test("a paid order is never released — its stock stays sold", async () => {
    const variantId = await makeVariant(3);
    const placed = await place(variantId, 2);
    await markOrderPaid(placed.orderNumber);
    expect(await stockOf(variantId)).toBe(1);

    const res = await releaseReservation(placed.orderNumber);
    expect(res.released).toBe(false);
    expect(await stockOf(variantId)).toBe(1); // unchanged
  });

  test("cancelling a pending reserved order hands its stock back", async () => {
    const variantId = await makeVariant(3);
    const placed = await place(variantId, 2);
    expect(await stockOf(variantId)).toBe(1);

    const order = await prisma.order.findUnique({
      where: { orderNumber: placed.orderNumber },
    });
    const res = await updateOrderStatus(order!.id, "cancelled");
    expect(res.ok).toBe(true);

    expect(await stockOf(variantId)).toBe(3); // reservation released
    expect(
      (await prisma.order.findUnique({ where: { id: order!.id } }))?.status,
    ).toBe("cancelled");
  });

  test("the sweep releases past-expiry holds and leaves live ones alone", async () => {
    const variantId = await makeVariant(5);
    const fresh = await place(variantId, 1); // reservation expires ~30 min out
    const stale = await place(variantId, 1);
    // Force the stale hold to have already expired.
    await prisma.order.update({
      where: { orderNumber: stale.orderNumber },
      data: { reservationExpiresAt: new Date(Date.now() - 60_000) },
    });
    expect(await stockOf(variantId)).toBe(3); // both holds active

    const res = await sweepExpiredReservations();
    expect(res.released).toBeGreaterThanOrEqual(1);

    // Stale hold handed its unit back; fresh hold untouched.
    expect(await stockOf(variantId)).toBe(4);
    expect(
      (
        await prisma.order.findUnique({
          where: { orderNumber: stale.orderNumber },
        })
      )?.status,
    ).toBe("cancelled");
    expect(
      (
        await prisma.order.findUnique({
          where: { orderNumber: fresh.orderNumber },
        })
      )?.status,
    ).toBe("pending");
  });
});

describe("idempotent checkout", () => {
  test("re-submitting with the same key returns the same order, reserves once", async () => {
    const variantId = await makeVariant(5);
    const key = `idem-${RUN}-seq`;
    const a = await placeOrder({
      items: [{ variantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
      idempotencyKey: key,
    });
    const b = await placeOrder({
      items: [{ variantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
      idempotencyKey: key,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.orderNumber).toBe(a.orderNumber); // same order, not a second one
    expect(await stockOf(variantId)).toBe(4); // one unit reserved, not two
  });

  test("a concurrent double-click with one key creates a single order", async () => {
    const variantId = await makeVariant(5);
    const key = `idem-${RUN}-race`;
    const [a, b] = await Promise.all([
      placeOrder({
        items: [{ variantId, quantity: 1 }],
        shippingZone: "west",
        customer: customer(),
        idempotencyKey: key,
      }),
      placeOrder({
        items: [{ variantId, quantity: 1 }],
        shippingZone: "west",
        customer: customer(),
        idempotencyKey: key,
      }),
    ]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.orderNumber).toBe(b.orderNumber);
    expect(await prisma.order.count({ where: { idempotencyKey: key } })).toBe(1);
    expect(await stockOf(variantId)).toBe(4); // reserved exactly once
  });

  test("a retry returns the existing order even after the item sold out", async () => {
    const variantId = await makeVariant(1);
    const key = `idem-${RUN}-soldout`;
    const first = await placeOrder({
      items: [{ variantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
      idempotencyKey: key,
    });
    expect(first.ok).toBe(true);
    expect(await stockOf(variantId)).toBe(0); // last unit now held

    // The same submission is retried (e.g. the response was lost). Even though
    // the variant is now sold out, the customer already has this order.
    const retry = await placeOrder({
      items: [{ variantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
      idempotencyKey: key,
    });
    expect(retry.ok).toBe(true);
    if (!retry.ok || !first.ok) return;
    expect(retry.orderNumber).toBe(first.orderNumber);
    expect(await stockOf(variantId)).toBe(0); // still exactly one unit gone
  });

  test("different keys create distinct orders", async () => {
    const variantId = await makeVariant(5);
    const a = await placeOrder({
      items: [{ variantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
      idempotencyKey: `idem-${RUN}-d1`,
    });
    const b = await placeOrder({
      items: [{ variantId, quantity: 1 }],
      shippingZone: "west",
      customer: customer(),
      idempotencyKey: `idem-${RUN}-d2`,
    });
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.orderNumber).not.toBe(b.orderNumber);
    expect(await stockOf(variantId)).toBe(3);
  });
});
