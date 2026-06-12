# CRAZYWORK — Fable One-Shot Context

> **Purpose of this file.** This is the single, self-contained brief for one-shotting the CRAZYWORK storefront + admin in **Fable**. It encodes every locked decision from the discovery/grilling session so Fable can generate the full app in one pass. Read it top to bottom. Where this file and `PRD-Crazywork.md` disagree, **this file wins** (it is the newer rev. 2 distillation). The PRD is the long-form rationale; this is the build spec.

---

## 0. TL;DR for the generator

Build a **Next.js 15 (App Router) + React 19 + Tailwind 4** e-commerce storefront **and** a single-superadmin admin panel for a Malaysian gym/lifestyle apparel brand (**CRAZYWORK**). Use **Prisma** against **local Postgres (Docker)**, **Hono** mounted as a catch-all API route, and **Better Auth** for auth. **Stub** all external integrations (Stripe, Resend, Cloudflare R2, Discord) behind clean interfaces — the human will graft real credentials later. Currency is **MYR**, displayed `RM 1,500.00`.

The differentiators beyond a normal store:
1. A **configurable discount/campaign engine** with an admin builder + live margin calculator.
2. A **smart pre-checkout upsell popup** ("add 1 more for 5% off").
3. **Account-locked, single-use promo codes**.
4. A **block-based content builder** powering a multi-post **blog** and the **collab** page.
5. An **admin-managed encrypted-secrets store** (AES-256-GCM) so the owner can paste Stripe/Resend/Discord keys from the UI.

---

## 1. Locked stack (do not substitute)

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router, React 19, TypeScript |
| Styling | Tailwind 4 + shadcn/Radix UI components, framer-motion for motion |
| API | Hono mounted at `app/api/[[...route]]/route.ts` (`hono/vercel`), type-safe `hono/client` |
| ORM / DB | Prisma → **Postgres in Docker** (`docker-compose`), `DATABASE_URL` env |
| Auth | **Better Auth** — email/password + Google social; guest checkout (email only); one seeded `superadmin` |
| Payments | Stripe Checkout (**stubbed** in the one-shot) — Cards + FPX + GrabPay for MYR |
| Email | Resend (**stubbed**) |
| Storage | Cloudflare **R2** via S3-compatible client (**stubbed** — write to a local `/public/uploads` fallback in dev) |
| Alerts | Discord webhook (**stubbed**) |
| Rendering | SSR/SSG for storefront, product, blog, collab (SEO); client components for cart/interactivity |

**Why stubs:** the human supplies real keys post-generation via the admin secrets panel / env. Each integration must sit behind an interface (e.g. `PaymentProvider`, `Mailer`, `Storage`, `Notifier`) with a `Stub*` implementation that logs + returns success, so swapping to the real SDK is a one-file change.

---

## 2. Environment & secrets model

Two tiers — **get this boundary right, it's load-bearing.**

### 2a. Boot secrets → ENV ONLY (`.env`, never in DB, never in admin UI)
```
DATABASE_URL=postgresql://crazywork:crazywork@localhost:5432/crazywork
BETTER_AUTH_SECRET=<random 32+ chars>
BETTER_AUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<from Google Cloud>          # Better Auth loads at init
GOOGLE_CLIENT_SECRET=<from Google Cloud>
AES_MASTER_KEY=<32-byte base64 key>           # encrypts the runtime secrets below
SUPERADMIN_EMAIL=<owner email>                # seed target
SUPERADMIN_PASSWORD=<seed-only initial pw>
```

### 2b. Runtime secrets → AES-256-GCM-encrypted in DB, editable in admin
Stored in the `encryptedSecret` table as `{ key, ciphertext, iv, authTag }`. Decrypted **in-memory at call time** using `AES_MASTER_KEY`. The owner pastes/edits these in **Admin → Settings → Integrations**:
- `stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret`
- `resend_api_key`, `resend_from_email`
- `discord_webhook_url`

**Crypto helper to generate** (`lib/crypto.ts`): `encryptSecret(plain) → {ciphertext, iv, authTag}` and `decryptSecret(record) → plain`, using Node `crypto` `aes-256-gcm`, random 12-byte IV per value, the GCM **auth tag stored and verified** (this is the integrity guarantee the client called "HMAC"). Never log plaintext.

**Admin UX:** integration fields render masked (`••••1234`), show a **✓ Configured / ✗ Missing** badge, and a separate read-only panel shows the status of the **env boot secrets** (✓/✗ only — never their values). A "Test" button per integration pings the provider (stubbed: returns ok).

---

## 3. Data model (Prisma)

The authoritative draft schema ships as `prisma/schema.prisma` alongside this file. Key entities and the **non-obvious fields**:

- **Better Auth tables** — `user`, `account`, `session`, `verification`. Extend `user` with `role` (`customer` | `superadmin`), `phone`, `address`. Role is **never self-assignable**; customer signups always get `customer`.
- **product** — slug (unique), name, description, category, basePrice, isNew, isLimited, status (`active`|`draft`), dropId, SEO fields.
- **productVariant** — productId, size, colour, **stock**, sku, **costPrice (nullable)** → feeds margin preview only, never shown to customers.
- **productImage** — productId, imageUrl (R2), alt, sortOrder.
- **drop** — name, slug, status (`current`|`past`|`soldout`), sortOrder.
- **order** — customer fields, shipping zone + shippingFee, **subtotal, discountAmount, total**, status (`pending`→`paid`→`processing`→`shipped`→`delivered`→`cancelled`), paymentMethod, **appliedDiscountLabel** (e.g. "Buy 2 = 5%" or "CRAZY1234"), discountCodeId (nullable), orderNote, courierName, trackingNumber, placedAt.
- **orderItem** — orderId, productId, variant (size/colour), unitPrice, quantity.
- **discountCode** — code (unique), **issuedEmail**, percentage, **used** (bool), **lockedUserId** (nullable), expiresAt, source (`popup`|`signup`). See §5b for enforcement.
- **emailSubscriber** — email, source, createdAt.
- **campaign** — name, **type** enum (`quantity_tier`|`cart_total_tier`|`buy_x_get_y`|`free_shipping_over`), **rules** (JSON), active (bool), startAt, endAt, priority (int), **stacksWithCodes** (bool, default false). See §5a.
- **contentPost** — slug (unique), title, coverImageUrl (R2), **type** (`blog`|`collab`), excerpt, published (bool), publishedAt, SEO fields.
- **contentBlock** — postId, **type** (`heading`|`paragraph`|`image`|`image_grid`|`quote`|`button`), **data** (JSON), sortOrder.
- **communityPhoto** — imageUrl (R2), caption, sortOrder, published.
- **faq** — question, answer, category, sortOrder, published.
- **encryptedSecret** — key (unique), ciphertext, iv, authTag, updatedAt.
- **siteSettings** — key/value, **non-secret only**: social links, ssmNumber, ownerAlertChannel (`discord`|`email`), ownerAlertEmail, shipping rates (westRate, eastRate, freeThreshold), popupTiming, **preCheckoutUpsellEnabled**, **preCheckoutUpsellTemplate**, announcementBar.

---

## 4. Pages & routes

### Storefront (public, SSR/SSG)
| Route | Page |
|---|---|
| `/` | Home — bold hero + CTA, marquee, featured drop, product grid (**Gymshark-led** energy) |
| `/shop` | Product grid + filter/sort; sold-out badges |
| `/product/[slug]` | PDP — big gallery, bold size/colour picker, size-guide modal, "you may also like", **sticky add-to-cart bar** on scroll |
| `/cart` | Full cart page |
| `/checkout` | Name/email/phone/address(+state), Stripe Checkout handoff, discount field, shipping by zone |
| `/checkout/success` | Payment success |
| `/orders/lookup` | Guest order lookup (order # + email) |
| `/account` | Customer profile (details + their 10% code, copyable) |
| `/account/orders` | Customer order history + status + tracking |
| `/auth/*` | Sign in / sign up (email+pw + Google) |
| `/blog` | Blog index (type=blog posts, newest first) |
| `/blog/[slug]` | Block-rendered blog post |
| `/collab` | Block-rendered collab post (type=collab) |
| `/community` | Real-customer photo grid |
| `/faq` | Admin-managed Q&A |
| `/our-story`, `/mindset` | Kept + restyled |
| `404` | Themed not-found |

### Admin (`/admin/*`, superadmin-only, server-guarded on every route)
Dashboard, Products + variants/stock/cost + images, Drops, Orders (filter/update status + tracking + order note + CSV export), **Campaigns (builder + live calculator)**, **Content (block builder for blog + collab)**, Community photos, FAQs, **Settings → Integrations (encrypted secrets) + Store (shipping, social, SSM, upsell copy, alert channel)**.

---

## 5. The five differentiators — full spec

### 5a. Discount & campaign engine
**Admin builder** (`/admin/campaigns`): create named campaigns. Pick a **type** → form renders the right fields:
- `quantity_tier`: rows of `{ minQty, percent }` (e.g. 2→5, 3→10, 5→15). Basis = **total cart item count**.
- `cart_total_tier`: rows of `{ minSubtotal, percent }`.
- `buy_x_get_y`: `{ buyQty, percent }`.
- `free_shipping_over`: `{ minSubtotal }`.
Plus: name, active toggle, **startAt/endAt** date range, priority, **stacksWithCodes** (default off).

**Live calculator panel** (right side of the builder — this is the client's "promo calculation page"): owner enters a sample cart (qty + per-item price, optional cost) → panel shows **subtotal, discount, final price, and margin** live as they edit tiers. Pure client-side math; no save required to preview.

**Evaluation (server-side, `lib/discount.ts`):** given a cart + optional applied code, compute every applicable campaign discount **and** the code discount, then **apply only the single largest** (best-single-wins, **no stacking**). Ties broken by campaign `priority`. Return `{ amount, label }`. The final total handed to Stripe is computed here — **never trust a client total**. Free-shipping campaigns zero the shipping fee instead of discounting items. (A campaign's `stacksWithCodes=true` may later permit code-on-top stacking with a cap; default path is best-single.)

**Tests to generate:** best-single selection; tier boundary (exactly at threshold); expired/inactive campaign ignored; free-shipping waiver; code vs campaign pick-larger.

### 5b. Account-locked, single-use promo codes
Issued to an **email** (popup capture or signup welcome — one code per email, reused if already issued). Enforcement at checkout (`lib/promoCode.ts`):
1. checkout email **must equal** `issuedEmail`;
2. `used === false`;
3. not expired;
4. if `lockedUserId` is set, the redeeming **logged-in user must equal** `lockedUserId`; if null and a logged-in user redeems, **set `lockedUserId` to that user permanently**;
5. on success mark `used = true`.
Guests may redeem only if their email matches `issuedEmail`. Result: one account only, not shareable, single-use. **Tests:** wrong email rejected; second use rejected; other-account rejected after lock; guest-with-matching-email allowed.

### 5c. Smart pre-checkout upsell popup
On **Checkout** click, before navigating: if `preCheckoutUpsellEnabled` and the cart is **1–2 items short of the next `quantity_tier` (or within an RM gap of the next `cart_total_tier`)**, show a modal: *"Almost there! Add {n} more and save {percent}% on your cart"* using `preCheckoutUpsellTemplate`. Buttons: **[Add more]** (close → cart/shop) and **[Continue to checkout →]**. Fires at most once per checkout attempt. Never blocks checkout. Admin toggles it + edits the template in Settings.

### 5d. Block-based content builder (blog + collab)
Editor at `/admin/content`. A post has: slug, title, cover image, `type` (`blog`|`collab`), excerpt, published toggle, SEO, and an **ordered list of blocks**. Block types + their `data` shape:
- `heading` → `{ text, level }`
- `paragraph` → `{ text }` (allow basic inline emphasis)
- `image` → `{ url, alt }`
- `image_grid` → `{ images: [{url, alt}], columns }`
- `quote` → `{ text, attribution }`
- `button` → `{ label, href }`
Drag to reorder; add/remove blocks; image blocks upload to R2 (stub → `/public/uploads`). Public renderer maps each block type to a component. `/blog` lists `type=blog`; `/collab` renders the published `type=collab` post.

### 5e. Encrypted-secrets store
See §2b. Admin → Settings → Integrations. AES-256-GCM via `lib/crypto.ts`. Providers read their keys through a `getSecret(key)` helper that decrypts on demand; if a key is missing, the stubbed provider still returns ok but surfaces "not configured" in admin.

---

## 6. Design direction (per-surface, for a coherent one-shot)

The client wants a **blend** of popular clothing-brand patterns, **Gymshark-led**, keeping CRAZYWORK's brand kit. Concretely:

- **Home / hero / global chrome → Gymshark athletic:** bold full-width hero with a strong CTA, marquee/motion energy, punchy denser product grid. Confident, energetic.
- **PDP → Gymshark PDP:** large imagery, prominent size/colour selector, size-guide modal, "you may also like" row, sticky add-to-cart on scroll.
- **Cart → Carhartt slide-out drawer:** adding to cart opens a **right-side drawer with the page dimmed/blurred behind it**; line items (image, name, variant, qty stepper, remove), an expandable **"Add order note"** field, "Tax included · Shipping calculated at checkout", a primary **Checkout · RM total** button, and a **View Cart** link. Close via × or backdrop.
- **Editorial pages (blog/collab/our-story) → Carhartt editorial:** generous whitespace, clean grid, restrained type, big imagery.

**Brand kit (keep):** Peach Beige `#faefe0` (primary bg), Near Black `#1a1a1a` (text/logo), **Burnt Orange `#d45c00`** (accent, used sparingly), Soft Sand `#f0e8dc`, Warm Grey `#c4b5a3` (borders), Muted Brown `#7a6a5a` (secondary text). **Max three colours per layout.** Type: **Barlow Condensed** (Black 900 / Bold 700) for logo/headlines/product names; **Barlow** (400/500) for body/UI. Brand name always **ALL-CAPS**. Imagery: dark, cinematic, film-grain, single-subject (deliberate tension of dark photography on light peach UI). Voice: raw, direct, community-first.

---

## 7. Key wireframes (ASCII)

```
HOME (Gymshark-led)
┌───────────────────────────────────────────┐
│  CRAZYWORK            shop drops blog  🛒   │  ← thin nav, all-caps wordmark
├───────────────────────────────────────────┤
│        [ FULL-BLEED HERO IMAGE ]           │
│        CRAZY WORK. CRAZY RESULTS.          │
│             [ SHOP THE DROP → ]            │
├───────────────────────────────────────────┤
│  ‹‹ marquee: FREE SHIP OVER RM150 · ... ›› │
├───────────────────────────────────────────┤
│  FEATURED DROP   [▢][▢][▢][▢]  (grid)      │
└───────────────────────────────────────────┘

PDP (Gymshark) + sticky bar
┌──────────────────┬────────────────────────┐
│  [ gallery ]     │  PRODUCT NAME           │
│  [  images  ]    │  RM 120.00              │
│  [          ]    │  Size:  S M L XL        │
│                  │  Colour: ● ● ●          │
│                  │  [ ADD TO CART ]        │
│                  │  size guide ▸           │
└──────────────────┴────────────────────────┘
  …scroll… ▼
┌───────────────────────────────────────────┐  ← sticky add-to-cart bar
│ Product  · S ▾ · ● ▾ ·  [ ADD TO CART ]    │
└───────────────────────────────────────────┘

CART DRAWER (Carhartt) — page dimmed behind
                         ┌───────────────────┐
                         │  YOUR CART     ✕  │
                         │  ▢ Tee  S/Black   │
                         │    RM120  [-1+] 🗑 │
                         │  + Add order note │
                         │  Tax incl · ship…  │
                         │  [ CHECKOUT·RM120 ]│
                         │  View Cart         │
                         └───────────────────┘

ADMIN — CAMPAIGN BUILDER + LIVE CALC
┌─────────────────────────┬─────────────────┐
│ Name [Summer Bundle]    │  PREVIEW        │
│ Type [Quantity tier ▾]  │  Sample cart:   │
│  2+ → [5]%              │   [2] @ RM100    │
│  3+ → [10]%             │  Subtotal RM200  │
│  5+ → [15]%             │  Disc −RM10 (5%) │
│ Active [✓] Dates […]    │  Pays   RM190    │
│ Stacks w/ codes [ ]     │  (cost60)→m RM70 │
│ [ Save campaign ]       │                 │
└─────────────────────────┴─────────────────┘

PRE-CHECKOUT UPSELL
┌─ modal ──────────────────┐
│ Almost there!            │
│ Add 1 more item and save │
│ 5% on your cart          │
│ [Add more] [Checkout →]  │
└──────────────────────────┘

ADMIN — CONTENT BLOCK BUILDER
┌───────────────────────────────────────────┐
│ Title [Our Gym Collab]  type [collab ▾]    │
│ Cover [upload]      Published [ ]          │
│ ── blocks (drag to reorder) ──             │
│ ⠿ [Heading]  Our Gym Collab                │
│ ⠿ [Image  ]  hero.jpg                       │
│ ⠿ [Paragraph] story text…                   │
│ ⠿ [Image grid] 3 photos / 3 cols            │
│ ⠿ [Button] Shop the drop → /shop            │
│ [+ heading][+ paragraph][+ image][+ grid]…  │
└───────────────────────────────────────────┘
```

---

## 8. Stub contracts (interfaces Fable must generate)

```ts
interface Storage   { upload(file): Promise<{url:string}>; delete(url):Promise<void> }   // Stub → /public/uploads
interface Mailer    { send(to,template,data): Promise<void> }                              // Stub → console.log
interface Payment   { createCheckout(order): Promise<{url:string,id:string}>;             // Stub → /checkout/success?fake=1
                      verifyWebhook(req): Promise<PaidEvent|null> }
interface Notifier  { orderPlaced(order): Promise<void> }                                  // Stub → console.log
```
Each reads its key via `getSecret()` (decrypt) and no-ops gracefully if unconfigured. Real swaps later: `StubStorage→R2Storage`, `StubMailer→ResendMailer`, `StubPayment→StripePayment`, `StubNotifier→DiscordNotifier`.

---

## 9. Seed data
- One `superadmin` user from `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`.
- `siteSettings` defaults (shipping west/east/threshold, upsell on + template `Add {n} more for {percent}% off`, alert channel = discord).
- 3 demo products with variants (size×colour) + placeholder images, grouped into one `current` drop.
- One demo `quantity_tier` campaign (2→5, 3→10) and one `free_shipping_over` (RM150).
- One `collab` content post with sample blocks; 2 `blog` posts.
- A few FAQs + community photos.

---

## 10. Out of scope for the one-shot (human will add or it's a future extension)
Real Stripe/Resend/R2/Discord/Google wiring (stubs only); Touch'n'Go; multi-admin RBAC; additive discount stacking / per-category targeting / free-form rule engine; content categories/tags/scheduling/video blocks; Instagram feed; wishlist; verified reviews; live courier rates; full SEO structured-data pass; key rotation/KMS. Baseline SEO (SSR, meta, OG, sitemap, robots) **is** in scope.

---

## 11. Acceptance checklist
- [ ] `docker-compose up` brings Postgres up; `prisma migrate` + seed run clean.
- [ ] Storefront browse → add to cart (drawer) → checkout (stub) → success → order persisted.
- [ ] Discount engine returns best-single discount; upsell popup fires when a tier is 1–2 items away.
- [ ] Promo code: matches email, single-use, locks to first account, rejects others.
- [ ] Admin: product/stock/cost CRUD, campaign builder + live calc, block content builder, encrypted-secrets panel with ✓/✗ badges, orders + status + tracking + CSV.
- [ ] Blog index + post + collab render from blocks (SSR).
- [ ] superadmin-only guard on every `/admin` route; customer signups can't get admin role.
- [ ] No plaintext secrets in DB or logs; env boot secrets only shown as ✓/✗ in admin.
