# Crazywork Store — Diagnosis Fixes Implementation Plan (real app)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the PDP mobile UX changes (back button, swipeable gallery, image counter) and fix the security, DB-integrity, and performance findings from the 2026-07-09 diagnosis.

**Architecture:** Next.js App Router + Hono API (`server/routes/`) + Prisma/Neon + better-auth + R2 + Stripe, deployed on Vercel. Fixes are surgical: no restructuring of god files in this pass.

**Tech Stack:** TypeScript, Prisma, Hono, Next.js 15, Tailwind v4, Vitest, bun.

## Global Constraints

- **NEVER commit or push.** All changes stay uncommitted in the working tree; the user reviews and approves commits personally.
- Package manager: **bun** (`bun install`, `bunx`). Do not touch pnpm-lock.yaml / package-lock.json.
- Run `bunx tsc --noEmit` and `bun run test` (vitest) after every task; record pre-existing failures before starting.
- Never print values from `.env`. Never run destructive DB commands. Do NOT run `prisma migrate dev` / `db push` unless the task explicitly says so.
- Do NOT add new dependencies — every task below is achievable with what's installed.
- Follow existing code style: Tailwind theme tokens (`peach`, `ink`, `ember`, `sand`, `warmgrey`, `brown`), CVA button variants, existing test patterns in the repo's *.test.ts files.
- Currency fields are integer sen (`*Sen`). IDs are cuid strings.

## User actions (not code — cannot be fixed by agents)

1. **CRITICAL: Vercel image optimization quota is exhausted** — every `/_next/image` request returns `OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED` in production. Upgrade the Vercel plan or enable on-demand billing. Until then images bypass optimization.
2. **R2 public dev domain** (`pub-*.r2.dev`) is rate-limited and uncacheable — attach a custom domain to the R2 bucket in Cloudflare and update image URLs/remotePatterns (separate follow-up once the domain exists).

---

### Task 1: PDP — swipeable gallery, image counter, back button

**Files:**
- Modify: `components/product/pdp-client.tsx` (gallery block lines 109-201, state line 62)

**Interfaces:** No prop changes. `imageIndex` state already exists.

- [ ] **Step 1:** Add imports: `useRouter` from `next/navigation`; `ChevronLeft` is already imported.
- [ ] **Step 2:** Back button — render ABOVE the `grid gap-10 lg:grid-cols-[7fr_5fr]` div:

```tsx
const router = useRouter();
// ...
<button
  type="button"
  onClick={() => (window.history.length > 1 ? router.back() : router.push("/shop"))}
  className="mb-4 inline-flex cursor-pointer items-center gap-1 text-xs uppercase tracking-[0.2em] text-brown transition hover:text-ink"
>
  <ChevronLeft size={14} /> Back
</button>
```

- [ ] **Step 3:** Swipe support on the main image container (`div.group.relative.aspect-[4/5]`). Touch-only (desktop keeps hover arrows). Horizontal-dominant detection so vertical page scroll is untouched:

```tsx
const touchStart = useRef<{ x: number; y: number } | null>(null);

function onTouchStart(e: React.TouchEvent) {
  touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}

function onTouchEnd(e: React.TouchEvent) {
  if (!touchStart.current || product.images.length < 2) return;
  const dx = e.changedTouches[0].clientX - touchStart.current.x;
  const dy = e.changedTouches[0].clientY - touchStart.current.y;
  touchStart.current = null;
  if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy)) return;
  setImageIndex((prev) =>
    dx < 0 ? (prev + 1) % product.images.length
           : (prev - 1 + product.images.length) % product.images.length,
  );
}
```

Attach `onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}` to the main image container div.
- [ ] **Step 4:** Counter — between the main image and the thumbnail strip (only when `product.images.length > 1`):

```tsx
<p className="mt-2 text-center text-xs tracking-[0.2em] text-warmgrey">
  {imageIndex + 1} / {product.images.length}
</p>
```

- [ ] **Step 5:** Verify: `bunx tsc --noEmit`; run dev server (`bun run dev`, port 3007) and check a product page renders with back button + counter; swipe can be spot-checked via devtools device mode. Report what was and wasn't manually verified.

### Task 2: Fix `/api/subscribe` discount-code disclosure

**Files:**
- Modify: `server/routes/storefront.ts:181-205`
- Test: extend the existing storefront route test file (locate `*.test.ts` covering storefront; create `server/routes/storefront.subscribe.test.ts` if none)

- [ ] **Step 1:** Write failing test: POSTing an email that already has a code returns success WITHOUT the `code` field in the body.
- [ ] **Step 2:** Run it — expect FAIL (current handler returns `record.code` for existing emails).
- [ ] **Step 3:** Implement: when the subscriber/code already exists, return `{ ok: true, alreadySubscribed: true }` (no code). Only include the code for newly created signups (the code is also delivered by email — keep that path).
- [ ] **Step 4:** Tests pass; typecheck passes.

### Task 3: Rate-limit unauthenticated storefront POSTs

**Files:**
- Create: `server/rate-limit.ts`
- Modify: `server/routes/storefront.ts` (apply to POST `/subscribe`, `/drops/:id/notify`, `/checkout/quote`, `/checkout`, `/orders/lookup`)
- Test: `server/rate-limit.test.ts`

**Interfaces:**
- Produces: Hono middleware `rateLimit(opts: { key: string; max: number; windowSec: number })` that identifies callers by IP (`x-forwarded-for` first value, fallback `x-real-ip`, fallback "unknown"), persists counters in the existing better-auth `RateLimit` Prisma model (`key` = `${opts.key}:${ip}`, reuse its `count`/`lastRequest` columns), and returns 429 JSON `{ error: "Too many requests" }` when exceeded.

- [ ] **Step 1:** Read `prisma/schema.prisma` RateLimit model and better-auth's usage to match column semantics (`lastRequest` is epoch ms).
- [ ] **Step 2:** Failing tests: allows `max` requests in window, 429s the next, resets after window (mock Date or inject `now`).
- [ ] **Step 3:** Implement middleware with an atomic upsert pattern: read row → if window expired, reset count via `updateMany` conditioned on the old `lastRequest`; else `updateMany` with `count: { increment: 1 }` and reject when the read count ≥ max. Exact-once semantics are NOT required — approximate limiting is fine; note this in a code comment only if the logic looks wrong otherwise.
- [ ] **Step 4:** Apply per-route budgets: `/subscribe` 5/hour, `/drops/:id/notify` 10/hour, `/checkout/quote` 30/min, `/checkout` 10/min, `/orders/lookup` 20/min.
- [ ] **Step 5:** Tests + typecheck pass.

### Task 4: Security headers

**Files:**
- Modify: `next.config.ts`

- [ ] **Step 1:** Add a `headers()` block applying to `/(.*)`:
  - `Strict-Transport-Security: max-age=63072000; includeSubDomains`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
  - `Content-Security-Policy: frame-ancestors 'self'` (NOT `X-Frame-Options: DENY` — the admin pages-builder preview iframes the site itself)
- [ ] **Step 2:** `bun run build` compiles (or `bunx tsc --noEmit` if build is too slow locally) — report which was run.

### Task 5: Order payment race — idempotent status flip + guarded stock decrement

**Files:**
- Modify: `lib/orders.ts` (`markOrderPaid` ~505-599, `createManualOrder` ~414-449)
- Test: extend the existing orders test file (find `*.test.ts` covering lib/orders; follow its mocking pattern)

- [ ] **Step 1:** Failing test: calling `markOrderPaid` twice for the same order performs stock deduction and email side-effects exactly once (assert the second call short-circuits after the status flip fails).
- [ ] **Step 2:** Implement: FIRST operation inside the transaction becomes `tx.order.updateMany({ where: { id: order.id, status: "pending" }, data: { status: <paidStatus> } })`; if `count === 0`, return early (already processed). Remove the later unconditional status update or make it update the remaining fields only.
- [ ] **Step 3:** Stock deduction: replace read-then-write with `tx.productVariant.updateMany({ where: { id: variant.id, stock: { gte: item.quantity } }, data: { stock: { decrement: item.quantity } } })`; when `count === 0`, decrement whatever remains via a clamped fallback (`stock: 0`) and log an oversell warning through the existing notifier/logging pattern in the file. Batch the per-item work with `Promise.all` inside the transaction (no sequential await-per-item loops).
- [ ] **Step 4:** Apply the same guarded-decrement to `createManualOrder`'s loop and batch it.
- [ ] **Step 5:** Full test suite + typecheck pass.

### Task 6: Prisma schema — missing indexes (+ scripts env guard)

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `scripts/reset-store.ts`, `scripts/clean-test-data.ts`
- DO NOT run `prisma migrate dev` — generate the migration SQL only when the controller says the target DB is confirmed.

- [ ] **Step 1:** Add `@@index` entries: `Order`: `[userId]`, `[status]`, `[placedAt]`, `[customerEmail]`, `[discountCodeId]`; `OrderItem`: `[orderId]`; `Session`: `[userId]`; `Account`: `[userId]`; `ProductImage`: `[productId]`; `Product`: `[status]`, `[dropId]`; `Verification`: `[identifier]`. Skip any already covered by an existing `@@unique`/`@@index` prefix — check each.
- [ ] **Step 2:** Env guard at the top of both scripts, before any Prisma call:

```ts
const url = process.env.DATABASE_URL ?? "";
if (!/localhost|127\.0\.0\.1/.test(url) && process.env.ALLOW_REMOTE_RESET !== "yes") {
  console.error("Refusing to run against a remote database. Set ALLOW_REMOTE_RESET=yes to override.");
  process.exit(1);
}
```

- [ ] **Step 3:** `bunx prisma validate` passes; typecheck passes. Migration creation is a controller-level follow-up (needs DB confirmation), not part of this task.

### Task 7: Admin queries — pagination and aggregation

**Files:**
- Modify: `server/routes/admin.ts` (`/stats` ~72, `/customers` ~239-252, `/orders` ~668, `/orders/counts` ~855)
- Test: extend existing admin route tests if present for these endpoints; otherwise cover the changed query helpers with focused tests only where the file's existing test pattern makes it cheap.

- [ ] **Step 1:** `/orders/counts`: replace fetch-all with `prisma.order.groupBy({ by: ["status"], _count: true, where: <existing archived filter> })`.
- [ ] **Step 2:** `/orders`: add `take: 200` + `orderBy placedAt desc` (admin UI shows recent orders; confirm the frontend doesn't paginate — if it sends page params, honor them instead).
- [ ] **Step 3:** `/customers`: push pagination into Prisma (`skip`/`take` from the existing query params) and replace the load-all-orders join with a `groupBy(["userId"], _sum, _count)` over orders for just the returned page's user ids.
- [ ] **Step 4:** `/stats`: replace load-every-paid-order with Prisma `aggregate`/`groupBy` where the shape allows; where item-level breakdown is genuinely needed, constrain to the dashboard's time window (check what the dashboard actually displays before rewriting).
- [ ] **Step 5:** Verify each endpoint's response shape is unchanged (the admin UI consumes them) — compare against the frontend fetchers in `components/admin/` / `app/admin/`. Tests + typecheck pass.

### Task 8: ISR for storefront pages + PDP query fixes

**Files:**
- Modify: `app/(store)/page.tsx:21`, `shop/page.tsx:9`, `drops/page.tsx:13`, `faq/page.tsx:4`, `community/page.tsx:7`, `mindset/page.tsx:11`, `collab/[slug]/page.tsx:8`, `our-story/page.tsx:10`, `product/[slug]/page.tsx:11`, `app/sitemap.ts:5`
- Modify: `app/(store)/product/[slug]/page.tsx` (dedupe + parallelize), `lib/catalog.ts:70-73`, `app/(store)/shop/page.tsx:30-40`

- [ ] **Step 1:** For each listed page: confirm it does NOT read `cookies()`/`headers()`/session server-side (grep the page + its direct server imports). For pages that don't: replace `export const dynamic = "force-dynamic"` with `export const revalidate = 60`. Pages that DO read request state: leave as-is and list them in the report.
- [ ] **Step 2:** PDP: wrap `getProduct` in `React.cache()` so `generateMetadata` + page share one query; combine the follow-up queries (size guide, setting, related products) with `Promise.all`. Keep the related-products fallback logic.
- [ ] **Step 3:** Shop page: `Promise.all` the two queries.
- [ ] **Step 4:** `lib/catalog.ts` `activeProducts()`: keep API but stop over-fetching — `include` → explicit `select` of card-level fields; images limited to `take: 1, orderBy: { sortOrder: "asc" }`, variants reduced to the fields price/stock display needs. FIRST check all call sites (`git grep -n "activeProducts("`) and preserve every field they consume — if the PDP related-products or shop cards need more, select exactly that.
- [ ] **Step 5:** `app/sitemap.ts`: `export const revalidate = 3600`.
- [ ] **Step 6:** `bun run build` succeeds and the build output marks the converted routes as ISR (revalidate) not ƒ dynamic. Report the route table. Caveat for report: admin edits now take ≤60s to appear on the storefront.

### Task 9: R2 upload cache headers + AVIF

**Files:**
- Modify: `server/routes/admin.ts:401-415` (presign) and/or `lib/integrations/media.ts` (wherever PutObject/presign params live)
- Modify: `next.config.ts` (images)

- [ ] **Step 1:** Presigned PUT: include `CacheControl: "public, max-age=31536000, immutable"` in the `PutObjectCommand` params (uploaded keys are content-unique timestamp-random names, so immutable is safe). Verify the client-side upload fetch doesn't need a matching `Cache-Control` header sent with the PUT — with presigned URLs the signed param set must match; if the signature covers CacheControl, ensure the browser PUT sends the same header (check how `lib/integrations/media.ts` builds the presign and how the admin uploader sends the file).
- [ ] **Step 2:** `next.config.ts`: `images.formats = ["image/avif", "image/webp"]`.
- [ ] **Step 3:** Typecheck; note in report that existing R2 objects keep their old headers (only new uploads get caching) and that the r2.dev → custom domain move is a pending user action.

### Task 10: Delete dead scaffold directories

**Files:**
- Delete: `client/` (old Vite scaffold, unreferenced), `drizzle/` (old Drizzle migrations; Prisma is the ORM)

- [ ] **Step 1:** Verify unreferenced: `git grep -ln "from ['\"].*client/\|from ['\"].*drizzle" -- app components lib server` returns nothing; check `tsconfig.json` include paths don't reference them.
- [ ] **Step 2:** Delete both directories. `bunx tsc --noEmit` + `bun run test` pass; `bun run build` still compiles.

---

## Deferred / recommendations (not in this pass)

- framer-motion on the storefront (~789KB total JS): replace with CSS/IO animations — visual-risk change, do separately.
- Split `server/routes/admin.ts` (1,650 lines) and `lib/orders.ts` (742 lines) into feature modules.
- `OrderItem.variantId` column (more robust stock deduction) — schema+backfill, bundle with the index migration when DB target is confirmed.
- Cleanup cron for `RateLimit`/`Session`/`Verification` rows (Vercel cron) — growth is slow; revisit.
- Move `prisma migrate deploy` out of `bun run build` into a controlled deploy step.

## Execution notes

- Order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 (3 and 5 both touch order flow; keep sequential; all tasks touch distinct files except 6/7 vs 9 in admin.ts — sequential anyway).
- Implementers: Sonnet. Task-scoped reviews after each. NOTHING committed.
- Migration for Task 6 indexes: controller asks the user which DB `.env` points at before generating/applying anything.
