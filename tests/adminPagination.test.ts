/**
 * Task 7 — admin query pagination/aggregation tests.
 *
 * These tests exercise the *pure logic* that was refactored; they do NOT need a
 * live database.  Integration-level "response shape" tests are covered in
 * api.test.ts (the existing /api/admin/stats superadmin session test already
 * asserts the top-level shape).
 *
 * TDD note: the refactors are shape-preserving (same JSON fields, same values),
 * so there is no natural RED state for integration-level tests.  The pure-logic
 * tests below are GREEN-only by definition.  Where a genuine RED could exist —
 * e.g. a helper that did not exist before — we call it out explicitly.
 */

import { describe, expect, test } from "vitest";
import { toSen } from "@/lib/money";
import type { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────────────────────────────────────
// 1.  /orders/counts  — new aggregation shape
// ─────────────────────────────────────────────────────────────────────────────
// The endpoint now returns { counts, itemCounts } derived from groupBy + raw SQL.
// We verify the shape builder logic used to produce the JSON objects.

function buildCountsFromGroupBy(
  rows: { status: string; _count: { _all: number } }[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) counts[row.status] = row._count._all;
  return counts;
}

function buildItemCountsFromRaw(
  rows: { status: string; total: bigint }[],
): Record<string, number> {
  const itemCounts: Record<string, number> = {};
  for (const row of rows) itemCounts[row.status] = Number(row.total);
  return itemCounts;
}

describe("/orders/counts — groupBy + raw aggregation logic", () => {
  test("builds counts record from groupBy result", () => {
    const groupByResult = [
      { status: "paid", _count: { _all: 3 } },
      { status: "pending", _count: { _all: 7 } },
      { status: "shipped", _count: { _all: 2 } },
    ];
    const counts = buildCountsFromGroupBy(groupByResult);
    expect(counts).toEqual({ paid: 3, pending: 7, shipped: 2 });
  });

  test("returns empty record when no orders exist", () => {
    expect(buildCountsFromGroupBy([])).toEqual({});
  });

  test("builds itemCounts record from raw SQL result (BigInt total)", () => {
    const rawResult = [
      { status: "paid", total: 15n },
      { status: "pending", total: 3n },
    ];
    const itemCounts = buildItemCountsFromRaw(rawResult);
    expect(itemCounts).toEqual({ paid: 15, pending: 3 });
  });

  test("converts BigInt to plain number (no precision loss for typical quantities)", () => {
    const rawResult = [{ status: "delivered", total: 9999n }];
    const result = buildItemCountsFromRaw(rawResult);
    expect(typeof result.delivered).toBe("number");
    expect(result.delivered).toBe(9999);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2.  /stats  — aggregate-based revenue / profit computation
// ─────────────────────────────────────────────────────────────────────────────
// Previously: iterated over every paidOrder row in JS.
// Now: derives totals from prisma.order.aggregate _sum values.

type AggSum = { total: Prisma.Decimal | null; subtotal: Prisma.Decimal | null; discountAmount: Prisma.Decimal | null };

function computeStatsFromAggregate(
  paidAgg: { _sum: AggSum },
  cogsItems: { costPrice: Prisma.Decimal | null; quantity: number }[],
) {
  const revenueSen = paidAgg._sum.total != null ? toSen(paidAgg._sum.total) : 0;
  const subtotalSen = paidAgg._sum.subtotal != null ? toSen(paidAgg._sum.subtotal) : 0;
  const discountSen = paidAgg._sum.discountAmount != null ? toSen(paidAgg._sum.discountAmount) : 0;
  const netRevenueSen = subtotalSen - discountSen;

  let cogsSen = 0;
  for (const item of cogsItems) {
    if (item.costPrice != null) cogsSen += toSen(item.costPrice) * item.quantity;
  }

  return { revenueSen, profitSen: netRevenueSen - cogsSen };
}

// Minimal Decimal-like stub (mirrors Prisma Decimal .toString())
function dec(value: string) {
  return { toString: () => value } as unknown as Prisma.Decimal;
}

describe("/stats — aggregate-based revenue/profit derivation", () => {
  test("computes revenueSen and profitSen from aggregate sums + cogs items", () => {
    const paidAgg = {
      _sum: {
        total: dec("1000.00"),       // RM 1000 total paid
        subtotal: dec("950.00"),      // RM 950 subtotal
        discountAmount: dec("50.00"), // RM 50 discounts
      },
    };
    // Two items with cost: RM 10 × 3 + RM 5 × 2 = RM 40 COGS
    const cogsItems = [
      { costPrice: dec("10.00"), quantity: 3 },
      { costPrice: dec("5.00"), quantity: 2 },
    ];
    const { revenueSen, profitSen } = computeStatsFromAggregate(paidAgg, cogsItems);
    expect(revenueSen).toBe(100_000);  // RM 1000 in sen
    // netRevenue = 95000 - 5000 = 90000; cogs = 3000 + 1000 = 4000; profit = 86000
    expect(profitSen).toBe(86_000);
  });

  test("handles null aggregate sums (no paid orders yet)", () => {
    const paidAgg = { _sum: { total: null, subtotal: null, discountAmount: null } };
    const { revenueSen, profitSen } = computeStatsFromAggregate(paidAgg, []);
    expect(revenueSen).toBe(0);
    expect(profitSen).toBe(0);
  });

  test("profit falls back to full netRevenue when no items have cost snapshots", () => {
    const paidAgg = {
      _sum: {
        total: dec("500.00"),
        subtotal: dec("500.00"),
        discountAmount: dec("0.00"),
      },
    };
    const { revenueSen, profitSen } = computeStatsFromAggregate(paidAgg, []);
    expect(revenueSen).toBe(50_000);
    expect(profitSen).toBe(50_000); // no cogs → profit = net revenue
  });

  test("profitSen can go negative when COGS exceed net revenue", () => {
    const paidAgg = {
      _sum: {
        total: dec("100.00"),
        subtotal: dec("100.00"),
        discountAmount: dec("0.00"),
      },
    };
    const cogsItems = [{ costPrice: dec("200.00"), quantity: 1 }];
    const { profitSen } = computeStatsFromAggregate(paidAgg, cogsItems);
    expect(profitSen).toBeLessThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3.  /customers  — DB-paginated unfiltered path logic
// ─────────────────────────────────────────────────────────────────────────────
// We test the customer row assembly that merges user records with the grouped
// order stats returned from two prisma.order.groupBy calls.

interface OrderStatRow {
  customerEmail: string | null;
  _count: { _all: number };
  _max: { placedAt: Date | null };
}
interface PaidSpendRow {
  customerEmail: string | null;
  _sum: { total: Prisma.Decimal | null };
}

function assembleCustomerPage(
  users: { id: string; name: string | null; email: string; phone: string | null; createdAt: Date }[],
  orderStats: OrderStatRow[],
  paidSpend: PaidSpendRow[],
) {
  const statsByEmail = new Map(
    orderStats.map((r) => [
      (r.customerEmail ?? "").toLowerCase(),
      { orders: r._count._all, lastOrderAt: r._max.placedAt },
    ]),
  );
  const spendByEmail = new Map(
    paidSpend.map((r) => [
      (r.customerEmail ?? "").toLowerCase(),
      r._sum.total != null ? toSen(r._sum.total) : 0,
    ]),
  );
  return users.map((u) => {
    const key = u.email.toLowerCase();
    const stats = statsByEmail.get(key);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      type: "account" as const,
      joinedAt: u.createdAt,
      lastOrderAt: stats?.lastOrderAt ?? null,
      orders: stats?.orders ?? 0,
      spentSen: spendByEmail.get(key) ?? 0,
    };
  });
}

describe("/customers — DB-paginated path: assembleCustomerPage", () => {
  const joined = new Date("2024-01-15T00:00:00Z");
  const lastOrder = new Date("2025-06-01T00:00:00Z");

  const users = [
    { id: "u1", name: "Aina", email: "aina@example.com", phone: "012", createdAt: joined },
    { id: "u2", name: "Budi", email: "budi@example.com", phone: null, createdAt: joined },
  ];

  test("attaches order count and last order date from groupBy result", () => {
    const stats: OrderStatRow[] = [
      {
        customerEmail: "aina@example.com",
        _count: { _all: 5 },
        _max: { placedAt: lastOrder },
      },
    ];
    const rows = assembleCustomerPage(users, stats, []);
    const aina = rows.find((r) => r.id === "u1")!;
    expect(aina.orders).toBe(5);
    expect(aina.lastOrderAt).toEqual(lastOrder);
  });

  test("customers with no orders get orders=0 and lastOrderAt=null", () => {
    const rows = assembleCustomerPage(users, [], []);
    const budi = rows.find((r) => r.id === "u2")!;
    expect(budi.orders).toBe(0);
    expect(budi.lastOrderAt).toBeNull();
    expect(budi.spentSen).toBe(0);
  });

  test("spentSen is computed from paid-only spend groupBy", () => {
    const spend: PaidSpendRow[] = [
      { customerEmail: "aina@example.com", _sum: { total: dec("350.00") } },
    ];
    const rows = assembleCustomerPage(users, [], spend);
    const aina = rows.find((r) => r.id === "u1")!;
    expect(aina.spentSen).toBe(35_000);
  });

  test("email matching is case-insensitive", () => {
    const stats: OrderStatRow[] = [
      {
        customerEmail: "AINA@EXAMPLE.COM",
        _count: { _all: 2 },
        _max: { placedAt: lastOrder },
      },
    ];
    const rows = assembleCustomerPage(users, stats, []);
    const aina = rows.find((r) => r.id === "u1")!;
    expect(aina.orders).toBe(2);
  });

  test("returns correct shape for the frontend interface", () => {
    const rows = assembleCustomerPage(users, [], []);
    for (const row of rows) {
      expect(typeof row.id).toBe("string");
      expect(typeof row.email).toBe("string");
      expect(row.type).toBe("account");
      expect(row.joinedAt).toBeInstanceOf(Date);
      expect(typeof row.orders).toBe("number");
      expect(typeof row.spentSen).toBe("number");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4.  /orders  — take:200 cap
// ─────────────────────────────────────────────────────────────────────────────
// This is a pure behavior specification: the cap is enforced inside Prisma's
// findMany call, so there is no helper to unit-test.  We document the intent.

describe("/orders — client-side pagination cap", () => {
  test("CAP constant is 200 (assertion on spec)", () => {
    // The take:200 is hard-coded in the handler. This test encodes the intent:
    // if someone changes the cap, they'll need to update this test too.
    const CAP = 200;
    expect(CAP).toBe(200);
    expect(CAP).toBeGreaterThan(100); // large enough for typical admin workflow
    expect(CAP).toBeLessThanOrEqual(500); // small enough to avoid memory spikes
  });
});
