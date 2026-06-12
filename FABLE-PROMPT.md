# CRAZYWORK — Fable one-shot prompt

> Copy everything inside the rule below into Fable as a single prompt. It is self-contained; `FABLE-ONESHOT-CONTEXT.md` and `prisma/schema.prisma` in this repo are the long-form companions if Fable can read files.

---

Build a complete, production-shaped e-commerce **storefront + single-admin panel** for a Malaysian gym/lifestyle apparel brand called **CRAZYWORK**. Generate the full app in one pass. Currency is Malaysian Ringgit, displayed as `RM 1,500.00`. All external integrations must be **stubbed behind interfaces** (no real API keys) — a developer will wire them later.

## Reference the existing site for layout & context (re-skin, don't reinvent)
This is a **migration/rebuild** of an existing CRAZYWORK store, not a greenfield concept. **Study the current site first and preserve its information architecture, page set, content, and product structure — then restyle it cleaner per the design direction below.** Keep what works; fix the known issues listed.
- **Live site to study:** `https://crazywear-jioq6vwp.manus.space` — mirror its navigation, page set, hero/marquee idea, product layout, drops concept, and copy/tone.
- **Brand assets in `reference/`:** `brand_kit_Barlow font.html` (typography + colour system) and `crazywork_peach_split_variants.html` (peach theme layout exploration) — match these.
- **Existing pages to recreate (and restyle):** Home, Shop, Product Detail, Cart, Checkout, Payment Success, Customer Auth, Customer Orders, Drops, Mindset, Our Story, Blog/Collab, Admin Orders, 404. Add the new ones called out later (FAQ, Community, multi-post Blog, full admin).
- **Existing components to carry forward (restyled):** Navbar, Footer, ProductCard, CountdownTimer (reuse on the current drop), EmailPopup (the 10% capture). Drop Manus-specific bits (AIChatBox, Map, ManusDialog).
- **Known issues from the current site to FIX in this build:** clicking a product must open straight on its detail view (no scroll-up); replace "quick view" with "Add to Cart"; add sold-out tabs for previous drops; add the slide-out cart drawer; add a size guide; remove COD.

Use the existing site as the **structural and content reference**; use the design direction below for the **visual upgrade**.

## Development method — Test-Driven Development (required)
Build this **test-first, in vertical slices** (tracer bullets), not big-bang. For each behavior below: **RED** (write one failing test against the public interface) → **GREEN** (write the minimal code to pass) → **refactor** → next test. Do **not** write all tests up front then all code, and do **not** mock internal collaborators — tests must exercise real code paths and assert observable behavior so they survive refactors. Use **Vitest**. Prioritise business logic over UI. Drive these modules with tests first:
- **`lib/discount.ts`** — best-single-discount selection; quantity_tier boundary (exactly at threshold vs one below); cart_total_tier; buy_x_get_y; free_shipping_over zeroes the shipping fee; expired/inactive campaign ignored; priority breaks ties; campaign vs code → larger wins; never trust a client total.
- **`lib/promoCode.ts`** — wrong email rejected; expired rejected; second use rejected; locks to first authenticated user; other account rejected after lock; guest with matching email allowed; one-code-per-email reuse.
- **`lib/crypto.ts`** — encrypt→decrypt round-trips; tampered ciphertext/auth-tag fails verification; no plaintext leaks.
- **Stock/variant logic** — add-to-cart blocked at zero stock; stock decrements on paid order; sold-out state derived correctly.
- **Pricing/checkout total** — line items + shipping by zone + discount computed correctly server-side before payment.
- **Order + (stub) webhook** — order persists with correct items/variants/total; status transitions; confirmation + owner alert fire on paid.
- **Auth safeguard** — customer signup always `customer`; admin role not self-assignable; protected `/admin/*` rejects non-superadmin.
Ship the test files alongside the code; `npm test` must pass green.

## Stack (use exactly this)
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS 4 + shadcn/ui (Radix) components + framer-motion
- Hono mounted as a catch-all API route at `app/api/[[...route]]/route.ts`, with a type-safe `hono/client`
- Prisma ORM against **PostgreSQL** (connection via `DATABASE_URL`; a `docker-compose.yml` provides local Postgres)
- **Better Auth** for authentication
- **Vitest** for unit/integration tests (TDD per the method above)
- SSR/SSG for storefront, product, blog, and collab pages (SEO); client components for cart and interactivity

## Brand & design
Blend popular athletic/streetwear store patterns, **Gymshark-led**, keeping the brand kit below.
- **Home + global chrome → Gymshark energy:** bold full-bleed hero with a strong CTA, a moving marquee announcement, a punchy product grid. All-caps wordmark, thin nav.
- **Product detail (PDP) → Gymshark:** large image gallery, prominent size + colour selectors, a size-guide modal, a "you may also like" row, and a **sticky add-to-cart bar** that appears when the user scrolls past the buy box (with size/colour selectors in it).
- **Cart → Carhartt-style slide-out drawer:** clicking add-to-cart or the cart icon opens a **right-side drawer with the page dimmed/blurred behind it**; it shows line items (image, name, variant, qty stepper, remove), an expandable **"Add order note"** field, a "Tax included · Shipping calculated at checkout" line, a primary **Checkout · RM total** button, and a **View Cart** link. Close via × or backdrop.
- **Editorial pages (blog/collab/our-story) → Carhartt editorial:** generous whitespace, clean grid, restrained type, large imagery.
- **Brand kit (use):** backgrounds Peach Beige `#faefe0`; text/logo Near Black `#1a1a1a`; accent Burnt Orange `#d45c00` (sparingly); Soft Sand `#f0e8dc`; borders Warm Grey `#c4b5a3`; secondary text Muted Brown `#7a6a5a`. Max three colours per layout. Fonts: **Barlow Condensed** (900/700) for logo, headlines, product names; **Barlow** (400/500) for body/UI. Brand name always ALL-CAPS. Imagery is dark, cinematic, single-subject on the light peach UI.

## Data model (Prisma — Postgres)
Generate these models (fields summarized; use cuid ids, timestamps, sensible relations and enums):
- **User** (Better Auth) + `role` enum `customer|superadmin` (default customer, never self-assignable to superadmin), `phone`, `address`. Plus **Account**, **Session**, **Verification** (Better Auth).
- **Product**: slug (unique), name, description, category, basePrice, isNew, isLimited, status `active|draft`, externalUrl, dropId, metaTitle, metaDescription.
- **ProductVariant**: productId, size, colour, stock, sku, **costPrice (nullable — margin preview only, never shown to customers)**. Unique (productId,size,colour).
- **ProductImage**: productId, imageUrl, alt, sortOrder.
- **Drop**: name, slug, status `current|past|soldout`, sortOrder.
- **Order**: orderNumber (unique), userId (nullable for guests), customer snapshot (name, email, phone, address, state), shippingZone `west|east`, shippingFee, subtotal, discountAmount, total, appliedDiscountLabel, discountCodeId, status `pending|paid|processing|shipped|delivered|cancelled`, paymentMethod, orderNote, courierName, trackingNumber, placedAt.
- **OrderItem**: orderId, productId, productName (snapshot), size, colour, unitPrice, quantity.
- **DiscountCode**: code (unique), issuedEmail, percentage, used (bool), **lockedUserId (nullable)**, source `popup|signup`, expiresAt.
- **Campaign**: name, type `quantity_tier|cart_total_tier|buy_x_get_y|free_shipping_over`, **rules (JSON)**, active, startAt, endAt, priority, stacksWithCodes (default false).
- **EmailSubscriber**: email (unique), source, createdAt.
- **ContentPost**: slug (unique), title, coverImageUrl, type `blog|collab`, excerpt, published, publishedAt, metaTitle, metaDescription.
- **ContentBlock**: postId, type `heading|paragraph|image|image_grid|quote|button`, **data (JSON)**, sortOrder.
- **CommunityPhoto**: imageUrl, caption, sortOrder, published.
- **Faq**: question, answer, category, sortOrder, published.
- **EncryptedSecret**: key (pk), ciphertext, iv, authTag, updatedAt.
- **SiteSetting**: key (pk), value (JSON), updatedAt.

## Authentication & access control
- Customers sign up / sign in with **email + password** and **Google social** (stub Google with placeholder client id/secret read from env). Guest checkout requires only an email.
- Exactly **one superadmin**, seeded from `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`. **No admin signup route.** Customer signups always get `customer` role. Every `/admin/*` route is server-guarded and rejects non-superadmin requests.
- Password reset via emailed link (stubbed mailer).

## Secrets model (important — two tiers)
- **Boot secrets via env only** (`.env`): `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AES_MASTER_KEY` (32-byte base64), `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`.
- **Runtime secrets entered in the admin panel**, stored **AES-256-GCM encrypted** in `EncryptedSecret` (using `AES_MASTER_KEY`), decrypted in-memory at call time: `stripe_secret_key`, `stripe_publishable_key`, `stripe_webhook_secret`, `resend_api_key`, `resend_from_email`, `discord_webhook_url`.
- Provide `lib/crypto.ts` with `encryptSecret(plain)` / `decryptSecret(record)` using Node `crypto` `aes-256-gcm`, a random 12-byte IV per value, and a stored+verified GCM auth tag. Never log plaintext. A `getSecret(key)` helper decrypts on demand.
- Admin **Settings → Integrations**: masked inputs (`••••1234`), a **✓ Configured / ✗ Missing** badge per secret, a "Test" button (stub → returns ok), and a separate read-only panel showing env boot secrets as ✓/✗ only (never their values).

## Stubbed integrations (interfaces with `Stub*` implementations)
- `Storage` (`upload`, `delete`) → StubStorage writes to `/public/uploads` and returns a local URL. (Real later: Cloudflare R2 via S3 client.)
- `Mailer` (`send(to, template, data)`) → StubMailer logs to console. (Real later: Resend.)
- `Payment` (`createCheckout(order)` → returns a URL that redirects to `/checkout/success?fake=1`; `verifyWebhook(req)`) → StubPayment. (Real later: Stripe Checkout, Cards+FPX+GrabPay.)
- `Notifier` (`orderPlaced(order)`) → StubNotifier logs to console. (Real later: Discord webhook OR owner email — owner picks one in settings.)
Each integration reads its key via `getSecret()` and no-ops gracefully (still returns success) when unconfigured.

## Storefront pages
`/` home · `/shop` (grid + filter/sort, sold-out badges) · `/product/[slug]` (PDP with sticky add-to-cart bar + size-guide modal) · `/cart` · `/checkout` (name/email/phone/address+state, discount field, shipping by zone, hands off to stub payment) · `/checkout/success` · `/orders/lookup` (guest: order# + email) · `/account` (profile + their 10% code, copyable) · `/account/orders` (history + status + tracking) · `/auth/*` (sign in/up + Google) · `/blog` + `/blog/[slug]` · `/collab` · `/community` (photo grid) · `/faq` · `/our-story` · `/mindset` · themed `404`.

## The five differentiating features — build these fully

**1) Discount & campaign engine.** Admin builder at `/admin/campaigns`: create named campaigns; choosing a **type** renders the right form:
- quantity_tier: rows of `{minQty, percent}` (basis = total cart item count)
- cart_total_tier: rows of `{minSubtotal, percent}`
- buy_x_get_y: `{buyQty, percent}`
- free_shipping_over: `{minSubtotal}`
Each campaign has name, active toggle, start/end dates, priority, and a `stacksWithCodes` toggle (default off). Beside the form, a **live calculator panel**: the owner enters a sample cart (qty, per-item price, optional cost) and sees subtotal, discount, final price, and margin update live as they edit tiers (pure client-side math, no save needed). Server-side evaluator `lib/discount.ts`: given a cart + optional applied promo code, compute every applicable campaign discount **and** the code discount, then apply **only the single largest** (best-single-wins, NO stacking; ties broken by campaign priority); free-shipping campaigns zero the shipping fee. The final total handed to checkout is computed server-side — never trust a client total.

**2) Smart pre-checkout upsell popup.** When the shopper clicks **Checkout**, before navigating, if the cart is **1–2 items short of the next quantity_tier (or within an RM gap of the next cart_total_tier)** and the admin toggle is on, show a modal: *"Almost there! Add {n} more and save {percent}% on your cart"* (copy from an editable template in settings). Buttons: **[Add more]** (close, back to cart/shop) and **[Continue to checkout →]**. Fires at most once per checkout attempt; never blocks checkout.

**3) Account-locked, single-use promo codes.** Codes are issued to an **email** (one per email; reused if already issued) via the email-capture popup or the account-signup welcome email — both grant 10% off the first purchase, shown copyable on the customer profile. Enforcement at checkout (`lib/promoCode.ts`): the checkout email must equal `issuedEmail`; `used` must be false; not expired; if `lockedUserId` is set the redeeming logged-in user must match it, and if it's null and a logged-in user redeems, set `lockedUserId` to that user permanently; on success mark `used = true`. Guests may redeem only if their email matches the issued email. Net effect: one account only, not shareable, single use.

**4) Block-based content builder (blog + collab).** Admin editor at `/admin/content`: a post has slug, title, cover image, type `blog|collab`, excerpt, published toggle, SEO, and an **ordered list of blocks** the owner can add, remove, and drag to reorder. Block types and their `data`: `heading {text, level}`, `paragraph {text}`, `image {url, alt}`, `image_grid {images[], columns}`, `quote {text, attribution}`, `button {label, href}`. Image blocks upload via the Storage stub. Public renderer maps each block type to a component. `/blog` lists `type=blog` posts newest-first; `/collab` renders the published `type=collab` post. All SSR for SEO.

**5) Admin panel.** Superadmin-only. Sections: Dashboard; Products (CRUD + per size/colour variants with stock + optional cost price + image upload/reorder); Drops (CRUD, assign products, mark current/past/soldout); Orders (list/filter, view detail incl. order note, update status, add courier + tracking number which fires a stubbed status-change email, CSV export); Campaigns (builder + live calculator above); Content (block builder above); Community photos (upload/caption/order/publish); FAQs (CRUD); Settings → Integrations (encrypted secrets) and Store (shipping west/east/threshold, social links, SSM number, owner-alert channel + email, pre-checkout upsell toggle + copy template, announcement bar).

## Commerce rules
- Stock is tracked per size+colour variant; decrement on a paid order (stub marks orders paid via the fake success redirect); sold-out variants render as sold out and block add-to-cart.
- Flat shipping by zone (West vs East Malaysia), free over a configurable threshold, rates set in admin.
- Order confirmation email (stub) to the customer on every order; owner alert (stub) on each paid order via the chosen channel.

## Seed data
One superadmin (from env); SiteSetting defaults (shipping rates, upsell enabled + template `Add {n} more for {percent}% off`, alert channel `discord`); 3 demo products with size×colour variants and placeholder images in one `current` drop; one quantity_tier campaign (2→5%, 3→10%) and one free_shipping_over (RM150); one `collab` content post with sample blocks and two `blog` posts; a few FAQs and community photos.

## Baseline SEO
Server-render product/blog/collab pages; per-page `<title>`/meta + Open Graph; `sitemap.xml`; `robots.txt`; semantic markup; Next image optimization.

## Quality
- **Develop test-first (TDD)** per the Development method section: one failing test → minimal code → refactor, in vertical slices. Tests assert behavior through public interfaces; no mocking of internal collaborators. `npm test` must be green.
- Put all external calls behind the four stub interfaces so swapping to real SDKs is a one-file change.
- Compute money/discounts server-side. Never store or log plaintext secrets.
- Provide `docker-compose.yml` (Postgres), `.env.example`, Prisma migrations, a seed script, and the Vitest suite covering the modules listed in the Development method section.
- App must run with: `docker compose up -d` → `cp .env.example .env` → `prisma migrate dev` + seed → `npm run dev`; tests run with `npm test`.

---
