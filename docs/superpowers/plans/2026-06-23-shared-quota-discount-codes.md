# Shared Quota Discount Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second campaign-code style where one shared code (the prefix itself, e.g. `SUMMER`) carries a redemption quota and is redeemable once per customer, enforced safely under concurrency.

**Architecture:** Reuse the existing `DiscountCode` model (so the `Order → DiscountCode` FK and all pricing/order code stay intact). A shared code is one row with `maxRedemptions` set and a `redeemedCount` counter. Concurrency is enforced by two database-level guards inside the existing `markOrderPaid` transaction: an atomic conditional increment caps the quota, and a `@@unique(discountCodeId, userId)` index on a new `DiscountRedemption` table enforces once-per-customer. Consumption happens at payment (matching how stock already commits), so the quota counts paid orders; already-charged orders that lose the last-slot race are honored, and any overage is surfaced in the admin UI.

**Tech Stack:** TypeScript, Prisma 6 + Postgres (Neon), Hono (API), Next.js (admin UI), Vitest (tests), Bun.

## Global Constraints

- Package manager: **Bun** (`bun run`, `bunx`) — never npm/yarn.
- Conventional commits: `type(scope): description`.
- Identity for once-per-customer is **`userId`** (checkout forces sign-in before a code can be applied).
- A shared code is identified by `maxRedemptions != null`. When null, behavior must be byte-for-byte the existing single-use path.
- Quota is enforced at **payment** (`markOrderPaid`), not at order placement. No reservation/release machinery.
- `redeemedCount` is **never clamped** — admin surfaces true count and any overage.
- Integration tests hit the real Postgres branch (per the project's Neon-branch-per-git-branch standard), never mocks.

---

### Task 1: Schema — quota fields + redemption table

**Files:**
- Modify: `prisma/schema.prisma` (the `DiscountCode` model, the `User` model, and add a new `DiscountRedemption` model)
- Migration: generated under `prisma/migrations/`

**Interfaces:**
- Produces: `DiscountCode.maxRedemptions: Int?`, `DiscountCode.redeemedCount: Int @default(0)`, `DiscountCode.redemptions: DiscountRedemption[]`; new model `DiscountRedemption { id, discountCodeId, userId, orderId, createdAt }` with `@@unique([discountCodeId, userId])`; `User.redemptions: DiscountRedemption[]`.

- [ ] **Step 1: Add the two fields and the relation to `DiscountCode`**

In `prisma/schema.prisma`, inside `model DiscountCode { ... }`, add these three lines (place `maxRedemptions` and `redeemedCount` next to `used`, and `redemptions` next to `orders`):

```prisma
  used           Boolean        @default(false) // legacy single-use only; ignored when maxRedemptions is set
  maxRedemptions Int? // null = legacy single-use code; set = shared quota code
  redeemedCount  Int            @default(0) // atomic counter for shared quota codes
  redemptions    DiscountRedemption[]
```

- [ ] **Step 2: Add the back-relation to `User`**

In `model User { ... }`, below the `lockedCodes` line, add:

```prisma
  redemptions   DiscountRedemption[]
```

- [ ] **Step 3: Add the `DiscountRedemption` model**

Append after the `DiscountCode` model (before or after the `DiscountSource` enum):

```prisma
model DiscountRedemption {
  id             String       @id @default(cuid())
  discountCodeId String
  discountCode   DiscountCode @relation(fields: [discountCodeId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  orderId        String?
  createdAt      DateTime     @default(now())

  @@unique([discountCodeId, userId])
  @@index([discountCodeId])
}
```

- [ ] **Step 4: Validate the schema**

Run: `bunx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Create and apply the migration (also regenerates the client)**

Run: `bunx prisma migrate dev --name shared_quota_discount_codes`
Expected: migration created under `prisma/migrations/<timestamp>_shared_quota_discount_codes/`, applied to the dev Neon branch, and `✔ Generated Prisma Client`.

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add shared quota fields + DiscountRedemption table"
```

---

### Task 2: Validation branch for shared codes

**Files:**
- Modify: `lib/promoCode.ts`
- Test: `tests/promoCode.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `DiscountCodeRecord` gains `maxRedemptions: number | null` and `redeemedCount: number`. `validatePromoCode` input gains `alreadyRedeemedByUser?: boolean`. `PromoRejection` gains `"fully_redeemed"`. Shared codes (`maxRedemptions != null`) skip the `used`/email/lock logic; they reject `expired`, then `fully_redeemed` when `redeemedCount >= maxRedemptions`, then `already_used` when `alreadyRedeemedByUser`, else `{ ok: true, lockToUserId: null }`.

- [ ] **Step 1: Write the failing tests**

In `tests/promoCode.test.ts`, update the `code()` helper to include the two new fields, then add a new describe block. Add the fields to the helper's return object (after `expiresAt: null,`):

```typescript
    maxRedemptions: null,
    redeemedCount: 0,
```

Add this block after the existing `describe("validatePromoCode", ...)` block (or inside it, at the end):

```typescript
describe("validatePromoCode — shared quota codes", () => {
  const shared = (overrides: Partial<DiscountCodeRecord> = {}) =>
    code({ issuedEmail: null, maxRedemptions: 50, redeemedCount: 0, ...overrides });

  test("valid for any signed-in customer with quota remaining", () => {
    const result = validatePromoCode({
      record: shared(),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: false,
      now: NOW,
    });
    expect(result).toEqual({ ok: true, lockToUserId: null });
  });

  test("rejected when the quota is fully redeemed", () => {
    const result = validatePromoCode({
      record: shared({ maxRedemptions: 50, redeemedCount: 50 }),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: false,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "fully_redeemed" });
  });

  test("rejected when this customer already redeemed it", () => {
    const result = validatePromoCode({
      record: shared(),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: true,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "already_used" });
  });

  test("respects expiry before quota", () => {
    const result = validatePromoCode({
      record: shared({ expiresAt: new Date("2026-06-01T00:00:00Z") }),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: false,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  test("a used=true flag is ignored for shared codes (counter is the source of truth)", () => {
    const result = validatePromoCode({
      record: shared({ used: true, redeemedCount: 1, maxRedemptions: 50 }),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: false,
      now: NOW,
    });
    expect(result).toEqual({ ok: true, lockToUserId: null });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -- promoCode`
Expected: FAIL — `maxRedemptions`/`redeemedCount` not assignable to `DiscountCodeRecord`, and `fully_redeemed` cases not handled.

- [ ] **Step 3: Update the interface, rejection type, messages, and validation logic**

In `lib/promoCode.ts`:

Add the two fields to `DiscountCodeRecord` (after `expiresAt`):

```typescript
  expiresAt: Date | string | null;
  maxRedemptions: number | null; // null = legacy single-use; set = shared quota code
  redeemedCount: number;
```

Add `"fully_redeemed"` to `PromoRejection`:

```typescript
export type PromoRejection =
  | "not_found"
  | "wrong_email"
  | "expired"
  | "already_used"
  | "fully_redeemed"
  | "locked_to_other_account";
```

Add its message to `PROMO_REJECTION_MESSAGES`:

```typescript
  fully_redeemed: "This code has been fully redeemed.",
```

Add `alreadyRedeemedByUser` to the input signature and a shared-code branch at the top of the function body (right after the `if (!record) return ...` line):

```typescript
export function validatePromoCode(input: {
  record: DiscountCodeRecord | null;
  email: string;
  userId?: string | null;
  alreadyRedeemedByUser?: boolean;
  now?: Date;
}): PromoValidation {
  const { record } = input;
  const now = input.now ?? new Date();
  const userId = input.userId ?? null;

  if (!record) return { ok: false, reason: "not_found" };

  // Shared quota code: open to anyone, capped by a redemption count and limited
  // to one redemption per customer. The `used` boolean and email/account locks
  // do not apply — the counter and the per-customer guard are authoritative.
  if (record.maxRedemptions != null) {
    if (record.expiresAt && now > new Date(record.expiresAt)) {
      return { ok: false, reason: "expired" };
    }
    if (record.redeemedCount >= record.maxRedemptions) {
      return { ok: false, reason: "fully_redeemed" };
    }
    if (input.alreadyRedeemedByUser) {
      return { ok: false, reason: "already_used" };
    }
    return { ok: true, lockToUserId: null };
  }

  // ...existing single-use logic unchanged (issuedEmail / expiry / used / lock)...
```

Leave the rest of the function exactly as-is.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test -- promoCode`
Expected: PASS (all existing + new shared-code tests).

- [ ] **Step 5: Commit**

```bash
git add lib/promoCode.ts tests/promoCode.test.ts
git commit -m "feat(codes): validate shared quota codes (cap + once-per-customer)"
```

---

### Task 3: priceCart looks up per-customer redemption

**Files:**
- Modify: `lib/orders.ts:156-181` (the `if (input.code?.trim())` block inside `priceCart`)
- Test: `tests/checkout.test.ts`

**Interfaces:**
- Consumes: `validatePromoCode` with `alreadyRedeemedByUser` (Task 2); `prisma.discountRedemption` (Task 1).
- Produces: `priceCart` rejects a shared code with `error: "invalid_code"`, `reason: "fully_redeemed"` when quota is gone, and `reason: "already_used"` when the signed-in user already redeemed it.

- [ ] **Step 1: Write the failing integration tests**

In `tests/checkout.test.ts`, add this describe block (after the existing `priceCart` block). It creates its own shared code + user and cleans them up:

```typescript
describe("priceCart — shared quota codes", () => {
  const SHARED = `${RUN}-SHARED`;
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
    await prisma.discountRedemption.create({
      data: { discountCodeId: (await prisma.discountCode.findUniqueOrThrow({ where: { code: SHARED } })).id, userId },
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
```

Also extend the `afterAll` cleanup (top of file) to remove redemptions and the shared user/code — add these two lines inside `afterAll`, before the `prisma.user.deleteMany` line:

```typescript
  await prisma.discountRedemption.deleteMany({
    where: { user: { email: { contains: RUN } } },
  });
```

(The existing `prisma.order.deleteMany`, `prisma.discountCode.deleteMany where issuedEmail contains RUN`, and `prisma.user.deleteMany` lines remain. Add `await prisma.discountCode.deleteMany({ where: { batchLabel: { contains: RUN } } });` as well so the shared code is removed.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -- checkout`
Expected: FAIL — `priceCart` does not yet compute `alreadyRedeemedByUser`, so the already-used case passes through as a valid discount.

- [ ] **Step 3: Compute `alreadyRedeemedByUser` and pass it through**

In `lib/orders.ts`, replace the body of the `if (input.code?.trim()) { ... }` block in `priceCart` so it looks up the redemption for shared codes:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test -- checkout`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/orders.ts tests/checkout.test.ts
git commit -m "feat(checkout): reject shared codes that are full or already redeemed"
```

---

### Task 4: markOrderPaid consumes shared codes (the concurrency guards)

**Files:**
- Modify: `lib/orders.ts:502-512` (the discount-consumption block inside the `markOrderPaid` transaction)
- Test: `tests/checkout.test.ts`

**Interfaces:**
- Consumes: `DiscountRedemption` (Task 1), the `maxRedemptions`/`redeemedCount` fields.
- Produces: on payment, shared codes increment `redeemedCount` atomically (capped at `maxRedemptions`) and insert one `DiscountRedemption` per (code, user); legacy codes keep the `used`-flag path.

- [ ] **Step 1: Write the failing integration tests**

Add this describe block to `tests/checkout.test.ts`. It exercises the two guards under real concurrency:

```typescript
describe("markOrderPaid — shared quota concurrency", () => {
  async function makeSharedCode(quota: number) {
    const code = `${RUN}-Q${quota}-${Math.floor(quota * 7)}`;
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
    expect(results.every((r) => r.ok)).toBe(true); // every paid order honored

    const dc = await prisma.discountCode.findUniqueOrThrow({ where: { id } });
    expect(dc.redeemedCount).toBe(3); // never exceeds the quota

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -- checkout`
Expected: FAIL — `markOrderPaid` still runs the single-use `used:true` path, so `redeemedCount` stays 0 and no `DiscountRedemption` rows are created.

- [ ] **Step 3: Branch the consumption logic on shared vs single-use**

In `lib/orders.ts`, replace the existing discount-consumption block inside the `markOrderPaid` transaction (currently:)

```typescript
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
```

with:

```typescript
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test -- checkout`
Expected: PASS — cap test asserts `redeemedCount === 3` with all 5 orders `ok`, once-per-customer test asserts `redeemedCount === 1` with one redemption row.

- [ ] **Step 5: Run the full suite to confirm no regressions in the single-use path**

Run: `bun run test`
Expected: PASS (existing single-use code tests in `checkout.test.ts` / `promoCode.test.ts` still green).

- [ ] **Step 6: Commit**

```bash
git add lib/orders.ts tests/checkout.test.ts
git commit -m "feat(orders): atomically consume shared quota codes at payment"
```

---

### Task 5: Admin API for shared codes

**Files:**
- Modify: `server/routes/admin.ts` (add a new endpoint group after the `code-batches` routes, near line 1310)
- Test: `tests/api.test.ts`

**Interfaces:**
- Consumes: `prisma.discountCode`, `prisma.discountRedemption`.
- Produces: `POST /api/admin/shared-codes`, `GET /api/admin/shared-codes`, `PATCH /api/admin/shared-codes/:id`, `DELETE /api/admin/shared-codes/:id`. List items shape: `{ id, code, label, quota, redeemed, over, percentage, amountOffSen, expiresAt, createdAt }` where `over = max(0, redeemed - quota)`.

- [ ] **Step 1: Write the failing test**

Inspect `tests/api.test.ts` for the existing admin-route test helper (how it builds an authenticated admin request — reuse that exact helper). Add a test that creates a shared code via the route and reads it back. Use the file's existing request helper (named `adminRequest` or similar — match what the file already uses); the assertion shape is:

```typescript
describe("admin shared codes", () => {
  test("creates a shared code and lists it with quota + overage", async () => {
    const create = await adminRequest("POST", "/api/admin/shared-codes", {
      code: "APITEST-SHARE",
      label: "API Test Share",
      quota: 25,
      discountType: "percent",
      value: 15,
    });
    expect(create.status).toBe(200);
    const created = await create.json();
    expect(created.ok).toBe(true);

    const list = await adminRequest("GET", "/api/admin/shared-codes");
    const body = await list.json();
    const row = body.codes.find((r: { code: string }) => r.code === "APITEST-SHARE");
    expect(row).toMatchObject({
      code: "APITEST-SHARE",
      quota: 25,
      redeemed: 0,
      over: 0,
      percentage: 15,
    });

    await adminRequest("DELETE", `/api/admin/shared-codes/${created.id}`);
  });
});
```

If `tests/api.test.ts` has no reusable admin-request helper, instead add this test to the file that already exercises admin routes (search: `grep -rn "api/admin/code-batches" tests/`), reusing its helper verbatim.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- api`
Expected: FAIL — route returns 404 (not yet defined).

- [ ] **Step 3: Implement the four endpoints**

In `server/routes/admin.ts`, add after the `code-batches` route group (after the existing `admin.get("/code-batches/:label/export.csv", ...)` handler):

```typescript
// ───────── shared quota codes (one code, many redemptions) ─────────

admin.post("/shared-codes", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const code =
    typeof body.code === "string"
      ? body.code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "")
      : "";
  const label = typeof body.label === "string" ? body.label.trim() : "";
  const quota = Math.floor(Number(body.quota));
  const discountType = body.discountType === "fixed" ? "fixed" : "percent";
  const value = Number(body.value);
  const expiresAt =
    typeof body.expiresAt === "string" && body.expiresAt
      ? new Date(body.expiresAt)
      : null;

  if (!code) return c.json({ ok: false, message: "Code needs letters or numbers." }, 400);
  if (!Number.isFinite(quota) || quota < 1) {
    return c.json({ ok: false, message: "Quota must be at least 1." }, 400);
  }
  if (!Number.isFinite(value) || value <= 0) {
    return c.json({ ok: false, message: "Enter a discount value." }, 400);
  }
  if (discountType === "percent" && value > 100) {
    return c.json({ ok: false, message: "Percentage can't exceed 100." }, 400);
  }

  const existing = await prisma.discountCode.findUnique({ where: { code } });
  if (existing) return c.json({ ok: false, message: "That code already exists." }, 409);

  const created = await prisma.discountCode.create({
    data: {
      code,
      issuedEmail: null,
      percentage: discountType === "percent" ? Math.round(value) : 0,
      amountOffSen: discountType === "fixed" ? Math.round(value * 100) : null,
      source: "campaign",
      batchLabel: label || code,
      maxRedemptions: quota,
      expiresAt,
    },
  });
  return c.json({ ok: true, id: created.id });
});

admin.get("/shared-codes", async (c) => {
  const rows = await prisma.discountCode.findMany({
    where: { maxRedemptions: { not: null } },
    orderBy: { createdAt: "desc" },
  });
  return c.json({
    codes: rows.map((r) => ({
      id: r.id,
      code: r.code,
      label: r.batchLabel,
      quota: r.maxRedemptions ?? 0,
      redeemed: r.redeemedCount,
      over: Math.max(0, r.redeemedCount - (r.maxRedemptions ?? 0)),
      percentage: r.percentage,
      amountOffSen: r.amountOffSen,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    })),
  });
});

admin.patch("/shared-codes/:id", async (c) => {
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data: Record<string, unknown> = {};

  if (typeof body.label === "string") data.batchLabel = body.label.trim() || null;
  if (body.quota !== undefined) {
    const quota = Math.floor(Number(body.quota));
    if (!Number.isFinite(quota) || quota < 1) {
      return c.json({ ok: false, message: "Quota must be at least 1." }, 400);
    }
    data.maxRedemptions = quota;
  }
  if (body.discountType === "percent" && body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      return c.json({ ok: false, message: "Enter a percentage 1–100." }, 400);
    }
    data.percentage = Math.round(value);
    data.amountOffSen = null;
  }
  if (body.discountType === "fixed" && body.value !== undefined) {
    const value = Number(body.value);
    if (!Number.isFinite(value) || value <= 0) {
      return c.json({ ok: false, message: "Enter a discount value." }, 400);
    }
    data.amountOffSen = Math.round(value * 100);
    data.percentage = 0;
  }
  if ("expiresAt" in body) {
    data.expiresAt =
      typeof body.expiresAt === "string" && body.expiresAt
        ? new Date(body.expiresAt)
        : null;
  }

  await prisma.discountCode.update({ where: { id }, data });
  return c.json({ ok: true });
});

admin.delete("/shared-codes/:id", async (c) => {
  const id = c.req.param("id");
  await prisma.discountCode.delete({ where: { id } });
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- api`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/routes/admin.ts tests/api.test.ts
git commit -m "feat(admin): shared quota code CRUD endpoints"
```

---

### Task 6: Admin UI — create form, list, overage badge, disclaimer

**Files:**
- Modify: `app/admin/(panel)/codes/page.tsx`

**Interfaces:**
- Consumes: `/api/admin/shared-codes` endpoints (Task 5).
- Produces: a "Shared code" section in the admin codes page. No new exported symbols.

This task is UI; the project has no component test harness, so verification is manual in the browser.

- [ ] **Step 1: Add a shared-codes data section to the page**

In `app/admin/(panel)/codes/page.tsx`, mirror the existing batch section. Add state and a fetch for shared codes:

```typescript
type SharedCode = {
  id: string;
  code: string;
  label: string | null;
  quota: number;
  redeemed: number;
  over: number;
  percentage: number;
  amountOffSen: number | null;
  expiresAt: string | null;
  createdAt: string;
};

const [sharedCodes, setSharedCodes] = useState<SharedCode[]>([]);

async function loadSharedCodes() {
  const res = await fetch("/api/admin/shared-codes");
  const body = await res.json();
  setSharedCodes(body.codes ?? []);
}
// call loadSharedCodes() in the same effect/refresh path that loads batches
```

- [ ] **Step 2: Add the create form**

Reuse the existing batch form's field components (Label/Input/Button already imported in this file). Add a "Shared code" form with inputs for `code`, `label`, `quota`, `discountType` (percent/fixed), `value`, optional `expiresAt`. On submit, POST to `/api/admin/shared-codes` and call `loadSharedCodes()`. Below the form, render this disclaimer verbatim:

```tsx
<p className="mt-2 text-xs text-muted-foreground">
  Quota is enforced when an order is paid. If several customers are paying at the
  exact moment the last slot is taken, those already-charged orders are honored,
  so redemptions can land slightly over the quota. Any overage is shown below.
</p>
```

- [ ] **Step 3: Add the list with the overage badge**

Render each shared code as a card (reuse the batch-card markup). Show `code`, `label`, discount (`{percentage}% off` or `RM{(amountOffSen/100).toFixed(2)} off`), expiry, and usage as `{redeemed} / {quota}`. When `over > 0`, render a badge:

```tsx
{c.over > 0 && (
  <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
    {c.over} over quota
  </span>
)}
```

Add Edit (PATCH) and Delete (DELETE) controls matching the batch card's pattern, each refreshing via `loadSharedCodes()`.

- [ ] **Step 4: Manual verification in the browser**

Run: `bun run dev`
Then, signed in as admin at `/admin/codes`:
1. Create a shared code `SUMMER`, quota 3, 10% off. Confirm it appears as `0 / 3`.
2. Place 3 paid test orders as 3 different accounts using `SUMMER` (via the storefront checkout / test payment path). Confirm the card shows `3 / 3`.
3. Trigger one more paid order that was quoted before the cap filled; confirm it’s honored and the card shows e.g. `4 / 3` with the **"1 over quota"** badge.
4. Confirm a fresh checkout with `SUMMER` now shows "This code has been fully redeemed."
5. Confirm the same account cannot redeem `SUMMER` twice ("This code has already been used.").
6. Edit the quota and discount; delete the code and confirm it disappears.

Record the outcome of each step. If any step fails, do not mark the task complete — debug with superpowers:systematic-debugging.

- [ ] **Step 5: Commit**

```bash
git add "app/admin/(panel)/codes/page.tsx"
git commit -m "feat(admin): shared quota code UI with overage badge + disclaimer"
```

---

## Self-Review

**Spec coverage:**
- Schema (extend `DiscountCode` + `DiscountRedemption`) → Task 1. ✓
- Add-as-new-type (batches untouched) → Tasks 1, 5 keep `code-batches` paths intact; `maxRedemptions == null` preserves legacy path (Task 2/4). ✓
- Once-per-customer on `userId` → `@@unique([discountCodeId, userId])` (Task 1), lookup in `priceCart` (Task 3), Guard B in `markOrderPaid` (Task 4). ✓
- Reject when fully redeemed → `fully_redeemed` (Task 2), surfaced via `priceCart` (Task 3). ✓
- Honor paid orders / count at payment → Task 4 `inc.count === 0` branch. ✓
- Concurrency Guard A (atomic conditional increment) → Task 4 + concurrency test. ✓
- Surface overage (never clamp, badge, disclaimer) → Task 5 (`over` field) + Task 6 (badge + disclaimer). ✓
- Admin endpoints under `/api/admin/shared-codes` → Task 5. ✓
- Checkout UI rejection messages → flow automatically through `PROMO_REJECTION_MESSAGES` (Task 2) since the checkout page renders the API `message`; no separate task needed. ✓
- Tests against real DB → Tasks 3, 4 use `tests/checkout.test.ts` (real Postgres). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. The one helper-name uncertainty (admin request helper in Task 5) includes an explicit `grep` fallback instruction. ✓

**Type consistency:** `maxRedemptions: number | null` and `redeemedCount: number` used consistently across `DiscountCodeRecord` (Task 2), `priceCart` (Task 3), and `markOrderPaid` (Task 4). Compound unique key referenced as `discountCodeId_userId` in both Task 3 lookup and the schema's `@@unique([discountCodeId, userId])` (Prisma's generated name). Rejection reason `fully_redeemed` defined in Task 2 and consumed in Task 3. ✓
