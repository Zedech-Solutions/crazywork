# Shared Quota Discount Codes — Design

**Date:** 2026-06-23
**Status:** Approved for planning

## Problem

Today, an admin campaign means generating N distinct single-use codes (e.g. 50 rows like
`SUMMER4KQ9P2`) via `generateCampaignBatch` in `lib/codes.ts`. Each `DiscountCode` row has a
`used: boolean` and is consumed once.

We want a second style: **one shared code where the prefix IS the code** (e.g. `SUMMER`), with a
**redemption quota**. Instead of 50 codes, there is one code `SUMMER` that can be redeemed up to 50
times. The central concern is correctness under concurrency — no overselling the quota and no
single customer draining it.

## Decisions (confirmed with user)

1. **Add as a new type.** Keep the existing multi-code batch flow untouched. Add shared-quota codes
   alongside it. Admin picks the style per campaign.
2. **Once per customer.** Each customer may redeem a shared code one time; the quota counts distinct
   customers. Keyed on `userId` (checkout already forces sign-in before a code can be applied, so the
   account is always known and harder to game than email).
3. **Reject when fully redeemed.** Once the quota is reached, the code stops working and shows a clear
   "fully redeemed" message at checkout.
4. **Honor paid orders (count at payment), and surface any overage.** Consume the slot at payment time,
   consistent with how this app already commits stock (`lib/orders.ts` — stock deducts in
   `markOrderPaid`, not at placement). Pending orders reserve nothing. Worst case: orders already
   charged by Stripe when the last slot fills are honored rather than refunded, so the counter can land
   slightly above quota (bounded by the number of simultaneously in-flight payments). No new
   reservation/release machinery. We do **not** hide this: `redeemedCount` is never clamped, the admin
   campaign view shows the true count against quota and flags any overage, and the admin create form
   carries a short disclaimer explaining that a few simultaneous payments may push redemptions slightly
   past the quota.

## Schema changes

`prisma/schema.prisma`

Extend `DiscountCode` (reused rather than a parallel model, so the existing one-to-many
`Order → DiscountCode` FK and all pricing/order code keep working):

```prisma
model DiscountCode {
  // ...existing fields...
  used            Boolean  @default(false)   // legacy single-use only; ignored when maxRedemptions is set
  maxRedemptions  Int?                        // null = legacy single-use; set = shared quota code
  redeemedCount   Int      @default(0)        // atomic counter for shared codes
  redemptions     DiscountRedemption[]
}

model DiscountRedemption {
  id             String       @id @default(cuid())
  discountCodeId String
  discountCode   DiscountCode @relation(fields: [discountCodeId], references: [id], onDelete: Cascade)
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  orderId        String?
  createdAt      DateTime     @default(now())

  @@unique([discountCodeId, userId])   // once-per-customer guard
  @@index([discountCodeId])
}
```

A shared code is a single `DiscountCode` row: `code` = the literal text (`SUMMER`), `issuedEmail` =
null (open to anyone), `maxRedemptions` = quota, `source` = `campaign`. `batchLabel` may carry the
campaign name for display/grouping.

**Identifying a shared code:** `maxRedemptions != null`. When null, behavior is exactly as today.

## Concurrency model

Two independent database-level guards, both executed inside the existing `markOrderPaid`
`$transaction`. Neither uses read-then-write application logic, so there is no race window.

### Guard A — quota cap (prevents oversell)

A single atomic conditional update:

```sql
UPDATE "DiscountCode"
SET "redeemedCount" = "redeemedCount" + 1
WHERE id = $1 AND "redeemedCount" < "maxRedemptions"
```

Via Prisma `updateMany({ where: { id, redeemedCount: { lt: maxRedemptions } }, data: { redeemedCount: { increment: 1 } } })`.
Postgres serializes row updates: if 100 payments land at once on a quota of 50, exactly 50 updates
return `count: 1` and the rest return `count: 0`. The DB enforces the cap; we write no locking code.
This generalizes the pattern already trusted for single-use codes (`updateMany ... where used:false`).

### Guard B — once per customer

The `@@unique([discountCodeId, userId])` index. The `DiscountRedemption` insert throws `P2002` if a
row for that (code, user) already exists. Two concurrent orders from the same account → exactly one
insert wins atomically.

### Consumption sequence in `markOrderPaid` (shared codes)

For an order whose discount code has `maxRedemptions != null`:

1. Attempt the atomic increment (Guard A).
2. If `count === 1` (slot won): insert the `DiscountRedemption` row (Guard B) with `userId` and
   `orderId`. If that insert throws `P2002`, this customer already has a redemption (a concurrent
   second order slipped past the quote-time check) — decrement the counter back so the repeat does
   not consume a second slot, then mark the order paid normally (honor the already-charged order).
3. If `count === 0` (quota gone): the order was already charged the discounted amount, so **honor it**
   — mark paid normally. The counter is already at/over quota; we do not increment further.

Because the discount was already applied to the charged total, payment-time rejection never means a
refund — it only means the global counter has reached quota and no *new* checkouts will be quoted the
discount.

Legacy single-use codes keep their existing path (`updateMany ... where used:false`) unchanged.

## Validation (quote + checkout)

`lib/promoCode.ts` — `validatePromoCode` gains a shared-code branch when `maxRedemptions != null`:

- Skip the `used` boolean check (irrelevant for shared codes).
- Check expiry as today.
- Reject `fully_redeemed` when `redeemedCount >= maxRedemptions`.
- Reject `already_used` when a `DiscountRedemption` row exists for this `userId`.

These run at quote time for clean UX ("This code is fully redeemed" / "You've already used this code").
They are advisory for the user experience; Guards A and B are the authoritative enforcement. The
existing `priceCart` call sites pass the user context needed for the redemption lookup.

## Admin

New endpoints under `/api/admin/shared-codes` (batch endpoints under `/api/admin/code-batches` stay
untouched):

- `POST /api/admin/shared-codes` — create one shared code: `code`, `quota`, `discountType`
  (percent/fixed), `value`, optional `expiresAt`, optional `label`. Validates the code is unique,
  quota ≥ 1, value > 0.
- `GET /api/admin/shared-codes` — list shared codes with `redeemedCount / maxRedemptions` and % used.
- `PATCH /api/admin/shared-codes/:id` — edit discount/expiry/quota. Lowering quota below
  `redeemedCount` is allowed (just stops further redemptions); past orders keep their snapshot.
- `DELETE /api/admin/shared-codes/:id` — delete. Cascade removes `DiscountRedemption` rows; orders
  keep their FK behavior (history survives).

Admin UI (`app/admin/(panel)/codes/page.tsx`): add a "Shared code" creation form next to the existing
batch form, and a list section reusing the current batch-card layout (label, code, redeemed/quota,
% used, discount, expiry, edit/delete).

**Surfacing overage:**
- The list shows the true `redeemedCount / maxRedemptions` (never clamped). When
  `redeemedCount > maxRedemptions`, render an "over quota" badge and the overage amount
  (e.g. `52 / 50 — 2 over`), so the admin sees exactly what happened rather than a silently capped `50 / 50`.
- The create form carries a one-line disclaimer: quota is enforced at payment, and a few simultaneous
  in-flight payments may push redemptions slightly past the quota (those orders are honored, not refunded).

## Checkout UI

No structural change. The existing discount-code input already forces sign-in before applying a code,
which gives us the `userId` for once-per-customer. New rejection reasons (`fully_redeemed`,
shared-code `already_used`) map to friendly messages.

## Out of scope

- Strict never-exceed reservation (reserve-at-placement + release machinery). Explicitly rejected in
  favor of count-at-payment consistency with stock.
- Per-customer multi-use shared codes (chose once-per-customer).
- Migrating existing multi-code batches into shared codes.

## Testing

- **Unit:** `validatePromoCode` shared-code branch — expired, fully redeemed, already-used-by-user,
  happy path.
- **Concurrency (integration, real DB):** fire N concurrent `markOrderPaid` calls against a quota-K
  shared code; assert exactly K succeed and `redeemedCount === K`. Fire two concurrent payments for
  the same `userId`; assert exactly one `DiscountRedemption` row and no double count.
- **Admin:** create/list/patch/delete shared code; quota/value validation.
- Per the project's Neon branching standard, integration tests hit a real Postgres branch, not mocks.
