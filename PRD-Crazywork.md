# Product Requirements Document — CRAZYWORK Storefront Rebuild

| | |
|---|---|
| **Project** | CRAZYWORK — Gym & Lifestyle Apparel Storefront + Admin |
| **Prepared for** | Crazywork (client) |
| **Prepared by** | Zedech Solution |
| **Date** | 2026-06-08 |
| **Current site** | https://crazywear-jioq6vwp.manus.space (Manus-hosted) |
| **Target** | Host-agnostic (Next.js + Prisma); **Cloudflare R2** storage; **Docker Postgres** in dev, managed Postgres in prod; custom domain |
| **Status** | Draft for review — **rev. 2** (adds discount/campaign engine, pre-checkout upsell, block-based content builder, admin-managed encrypted secrets, R2 + Docker-Postgres) |

---

## 1. About This Document

This PRD describes **what** we will build, **how** each piece works, and **what ships in v1** versus **what is part of future extensions** (and *why*). The current site was generated on the Manus platform and is welded to Manus-only services. This project migrates it to a self-owned stack on Vercel, overhauls the UI toward a clean, light storefront, adds a real admin panel, and implements the client's change list.

Read this as a discussion document. Anything that doesn't match intent, flag it and we adjust.

---

## 2. Problem Statement

From the client's perspective:

- The store runs on Manus, a closed platform. The client cannot fully own, host, or scale it, and the product catalogue is **hard-coded** — the client cannot add a product, change a price, edit a description, or mark stock without a developer.
- There is **no real admin panel**. Order viewing is locked to the Manus app; the client cannot manage products, stock, content, or settings independently.
- The current UI does not meet the bar the client wants (reference: **Gymshark**, secondary: Adidas, Nike, Lululemon).
- The client wants new capabilities: a **gym-collaboration blog**, **community photos**, **FAQs**, **size guide**, a **first-purchase 10% email-capture offer**, **guest + account checkout**, **Discord alerts** on new orders, configurable social links, and an **SSM listing** in the footer.
- SEO is weak — the current SPA is client-rendered, so product and content pages are poorly indexed.

## 3. Solution

From the client's perspective: a fast, polished, self-owned CRAZYWORK store the client controls end-to-end.

- A new storefront on **Next.js + Vercel**, restyled to a **light, clean theme** on the brand's light/peach + burnt-orange identity.
- A **single-superadmin admin panel** to manage products, stock (per size + colour), drops, orders, blog posts, community photos, FAQs, and site settings — no developer needed for day-to-day changes.
- Customers can buy as **guest or registered account**, pay by **card / FPX / GrabPay** (Stripe), and registered customers can see order history and status.
- Marketing built in: **10% first-purchase email capture**, **order-confirmation emails**, and a **new-order alert to the owner via Discord or email (client's choice — one channel)**.
- A **gym-collaboration blog** and **community photo wall**, both SEO-friendly via server rendering.

### Approach: port, not from-scratch

We **rebuild the application shell** on Next.js while **reusing** the existing React component library (shadcn/Radix), brand tokens, and business logic. We **replace** the Manus-coupled platform layer and the MySQL database, and **delete** all Manus `_core` services.

---

## 4. Locked Decisions

| Decision | Choice |
|---|---|
| Build strategy | **Next.js (App Router) port** — reuse components + logic, restyle pages |
| Repo | **Fresh Next.js repo**; copy reusable components/logic from the Manus repo (no in-place migration) |
| Hosting | **Host-agnostic** — app is plain Next.js + Prisma. Dev runs locally; prod host chosen at go-live (Vercel Pro / Railway / Render / Fly / self-host). |
| Database | **Dev: local Postgres via Docker** (`docker-compose`). **Prod: managed Postgres (TBD at launch — Neon / Supabase / Railway).** Prisma keeps this swappable. |
| ORM | **Prisma** (Zedech house standard) |
| API layer | **Hono** (runs as a catch-all route handler in Next.js; type-safe `hono/client`) |
| Discounts | **Configurable discount/campaign engine** — admin builds campaigns from fixed rule types (quantity tier, cart-total tier, buy-X-get-Y%, free-shipping-over-RM); **best-single-discount wins (no stacking)**; live margin/price preview in the builder. |
| Promo codes | **Email-issued, single-use, account-locked.** Code matches the issued email; once a logged-in account redeems it, it locks to that `userId` and no other account/email can use it. |
| Pre-checkout popup | **Smart upsell** — when the cart is 1–2 items short of the next campaign tier, a modal nudges "add N more for X% off". Admin toggle + editable copy. |
| Content (blog + collab) | **Block-based builder** (heading / paragraph / image / image-grid / quote / button blocks) powering a **multi-post blog AND the collab page**. Replaces the single-fixed-collab-page decision in rev. 1. |
| Auth | **Better Auth** for the whole app — customers (email/password **+ Google social**), guest checkout, and a **single seeded `superadmin`-role user** (admin role not self-assignable; no admin signup) |
| Payments | **Stripe — Cards + FPX + GrabPay** (all three confirmed supported for MYR via Stripe Checkout) now; **Touch 'n Go aggregator as a future extension**. **Built against Stripe test mode (sandbox) during development; live keys + live webhook wired at launch.** |
| Stock model | **Per size + colour variant** |
| Drops | **Drop-based grouping** (Current / Past / Sold-out) |
| Data migration | **Start fresh**, re-host product images to Cloudflare R2 |
| Image / file storage | **Cloudflare R2** (S3-compatible; accessed via an S3 client so it stays host-agnostic). Replaces Vercel Blob in rev. 1. |
| Secrets | **Runtime secrets (Stripe, Resend, Discord) are admin-managed**, stored **AES-256-GCM-encrypted** in the DB (master key in env). **Boot secrets** (AES master key, `DATABASE_URL`, Better Auth session secret, Google OAuth id/secret) stay **env-only**. |
| Email | **Resend** |
| Order alerts | Per new paid order via **either Discord webhook OR owner email — client picks one, and only that one is built** (not both). Suggested: Discord (instant push, no inbox flooding during drops) |
| Admin recovery | **Email/password + emailed reset link** to a locked owner email |
| Guest tracking | **Public order-lookup page** (order number + email) |
| Order management | 6 statuses + **courier/tracking number** + **auto status-change emails** |
| Shipping | **Flat West/East Malaysia rates**, free over a threshold, configurable in admin |
| Pages | Keep all current pages (Home, Shop, Drops, Mindset, Our Story); **add FAQ + Collab + Community** (real customer photos, per client PDF) |
| Collab page | **Single admin-configurable showcase page** (title, intro, gallery, body) |
| Theme | **Light / white + Peach Beige `#faefe0` + Burnt Orange `#d45c00` accent** |

### Database: Docker in dev, managed in prod

**Development** runs Postgres locally via `docker-compose` (no cloud account needed to build or one-shot the app). The Prisma schema is the source of truth, so the **production database is a deploy-time decision** — Neon (free tier, 0.5 GB / ~190 compute-hours/mo), Supabase, or a Railway/Render Postgres all work unchanged behind `DATABASE_URL`. The store's data (a handful of products, orders, customers, content) fits any free tier with huge headroom. If a serverless Postgres (Neon) is chosen, note its compute **auto-suspends** after idle, adding a ~few-hundred-ms cold start on the first request — invisible for low-traffic retail.

### Infrastructure cost (monthly)

| Service | Plan | Cost |
|---|---|---|
| **App host** | Local in dev; host chosen at go-live (Railway/Render ~$5–7, Vercel Pro ~$20, or self-host) | $0 in dev |
| **Cloudflare R2** | Free tier (10 GB storage, **zero egress fees**) | ~$0 at this scale — optimized WebP well under 10 GB |
| **Postgres** | Docker (dev) / managed free tier (prod) | $0 |
| **Resend** | Free tier (3,000 emails/mo) | $0 at launch volume |
| **Stripe** | pay-per-transaction | per-txn fees only, no monthly |

**For now: $0/mo** — dev runs entirely on Docker + free tiers. **Domain is the only upfront cost (~RM40–60/yr).**

**At go-live**, decide the host. The app is **fully host-agnostic** (plain Next.js + Prisma + an S3-compatible client for R2), so any of these work:
- **Railway / Render** — ~$5–7/mo, commercial allowed, can host app + DB together.
- **Vercel Pro** — ~$20/mo/seat. Best Next.js DX.
- **Fly.io / self-host (Hetzner + Coolify)** — cheapest, more setup.

**R2 is the only storage dependency** and is S3-compatible, so it can be swapped for S3 / Supabase Storage with a config change. Hosting is **client-billable** (pass-through), not absorbed by Zedech.

### Stripe environments

Development is built and tested entirely against **Stripe test mode (sandbox)** — test API keys + `stripe listen` for local webhooks. **Live keys and the live webhook endpoint are wired only at launch**, after the client's Stripe account passes KYC and FPX/GrabPay are enabled in the Dashboard.

---

## 5. Brand & Design Direction

**Identity (from brand kit):**
- **Colours:** Peach Beige `#faefe0` (primary bg), Near Black `#1a1a1a` (text/logo), **Burnt Orange `#d45c00`** (accent — used sparingly), Soft Sand `#f0e8dc`, Warm Grey `#c4b5a3` (borders), Muted Brown `#7a6a5a` (secondary text). Max three colours per layout.
- **Type:** Barlow Condensed (Black 900 / Bold 700) for logo, headlines, product names; Barlow (400/500) for body and UI.
- **Imagery:** dark, cinematic, film-grain, single-subject, authentic effort — note the deliberate tension of dark product photography on a light peach UI.
- **Voice:** raw, direct, community-first, quietly confident. All-caps brand name always.

**UX direction:** a **light, clean theme** — clean grid, generous whitespace, large imagery, sticky add-to-cart, refined PDP, size guide. Informed by modern athletic-wear stores (Gymshark, Adidas, Nike, Lululemon) for navigation and PDP patterns.

---

## 6. Architecture & Tech Stack

- **Frontend:** Next.js 15 App Router, React 19, Tailwind 4, reused shadcn/Radix `ui/*` components, framer-motion. SSR/SSG for storefront, product, and blog pages (SEO); client components for cart/interactivity.
- **API:** Hono mounted at `app/api/[[...route]]/route.ts` via `hono/vercel`; end-to-end types to the client through `hono/client`.
- **Data:** Prisma ORM against Postgres (Docker in dev, managed in prod; pooled connection).
- **Auth:** session-cookie auth. One seeded superadmin row (hashed password, env-seeded); customers use email/password; guests checkout with email only.
- **Discounts:** server-side discount engine evaluates active campaigns + any applied promo code against the cart, returns the **single best discount** (no stacking), and the final total is what's handed to Stripe.
- **Payments:** Stripe Checkout (hosted), webhook route handler to confirm payment and finalize orders. **Stripe keys/webhook secret are read from the AES-encrypted secrets store at request time** (not env).
- **Email:** Resend (transactional: OTP discount, order confirmation, status-change, owner alert). **Resend key + from-address read from the encrypted secrets store.**
- **Alerts:** Discord incoming webhook (URL stored in the encrypted secrets store, configurable in admin).
- **Storage:** Cloudflare R2 via an S3-compatible client for all uploads (product images, blog/collab block images, community photos). Public read via an R2 public bucket / CDN domain.
- **Secrets:** an `encryptedSecret` store (AES-256-GCM, master key in env) holds admin-managed runtime secrets; the GCM auth tag provides the integrity guarantee originally described as "HMAC". Boot secrets remain env-only.
- **Deleted from current code:** all `server/_core/*` Manus services (OAuth, notification, dataApi, storageProxy, imageGeneration, llm, voiceTranscription, map), Manus Vite runtime plugins, MySQL/Drizzle layer, Wouter, and the Vercel Blob coupling.

---

## 7. Data Model (Modules / Tables)

| Table | Purpose / key fields |
|---|---|
| `user` / `account` / `session` / `verification` | **Better Auth-managed** tables. `user` carries name, email, image, plus app fields: **role** (`customer` \| `superadmin`), phone, address. `account` holds password + linked Google social. Single superadmin = one seeded `user` with role `superadmin` (role not self-assignable). |
| `product` | slug (unique), name, description, category, basePrice, isNew, isLimited, status (active/draft), dropId, SEO fields. |
| `productVariant` | productId, size, colour, **stock**, sku, **costPrice** (optional — feeds the campaign margin preview, never shown to customers). Stock tracked at this grain. |
| `productImage` | productId, blobUrl, alt, sortOrder. |
| `drop` | name, slug, status (current/past/soldout), sortOrder. Groups products for "previous drops" browsing. |
| `order` | customer fields, shipping zone + **shippingFee**, totalAmount, status (pending→paid→processing→shipped→delivered→cancelled), paymentMethod, discountCode, **orderNote** (customer free-text request), **courierName + trackingNumber**, placedAt. |
| `orderItem` | orderId, productId, variant (size/colour), unit price, quantity. (Normalized out of the current JSON blob.) |
| `discountCode` | code (unique), **issuedEmail**, percentage, **used flag**, **lockedUserId** (null until a logged-in account redeems, then permanent), expiresAt, source (popup/signup). **One per email; single-use; account-locked** — see §8.6. Backs popup capture + signup welcome. |
| `campaign` | name, **type** (`quantity_tier` \| `cart_total_tier` \| `buy_x_get_y` \| `free_shipping_over`), **rules** (JSON: tier thresholds → %/benefit), active flag, startAt/endAt, priority, **stacksWithCodes** (default false). Drives automatic cart discounts + the smart upsell popup. |
| `emailSubscriber` | email, source (popup/signup), createdAt. |
| `contentPost` | slug (unique), title, cover image (R2), **type** (`blog` \| `collab`), excerpt, published flag, publishedAt, SEO fields. Multi-post blog + the collab page are both rows here. |
| `contentBlock` | postId, **type** (`heading` \| `paragraph` \| `image` \| `image_grid` \| `quote` \| `button`), **data** (JSON: text / R2 image url(s) / button label+href), sortOrder. The block-based layout for each post. |
| `communityPhoto` | imageUrl (R2), caption, sortOrder, published. Real-customer photos for the Community page. |
| `faq` | question, answer, category, sortOrder, published. |
| `encryptedSecret` | key (e.g. `stripe_secret`, `resend_key`, `discord_webhook`), **ciphertext + iv + authTag** (AES-256-GCM), updatedAt. Admin-managed runtime secrets; decrypted in-memory at call time. Master key is env-only. |
| `siteSettings` | key/value (**non-secret only**): social links, **SSM number**, owner-alert channel choice + owner-alert email, **shipping rates (West/East/threshold)**, **popup timing**, **pre-checkout upsell toggle + copy template**, announcement bar, configurable product links. |

---

## 8. Modules — v1 Scope, May-Be Future Extensions (with Why), Defaults

Each module is described in three layers: **v1** (ships now) · **May be part of future extension** (*candidate* work beyond v1 — possibilities, not commitments — each with the reason it's needed and why it's out of v1) · **Defaults** (choices Zedech sets for speed; client can override).

### 8.1 Storefront Pages
- **v1:** Home (hero, marquee, featured drop), Shop (grid + filter/sort), Product Detail (PDP), Cart, Checkout, Payment Success, Customer Auth, Customer Orders + Profile, Our Story, Mindset (restyle/keep), FAQ, **Blog index + post**, Collab, Community, 404. Restyled to a light, clean theme on the light/peach identity. **Clicking a product opens straight at the product** (no scroll-up — fixes client complaint). Quick view replaced by **"Add to Cart."**
- **Sticky add-to-cart bar (v1):** when the shopper scrolls down/away on a PDP without adding to cart, a sticky bar appears with the product, **size + colour selectors, and an Add-to-Cart button** — so they can pick a variant and add without scrolling back up.
- **May be part of future extension — Wishlist / favourites.** *Why needed:* lifts repeat-purchase and lets the client see demand signals. *Why it's not in v1:* not on the client's must-have list; adds auth-bound state and UI not required to transact.
- **May be part of future extension — Product reviews & ratings (real).** *Why needed:* social proof raises conversion. *Why it's not in v1:* needs moderation + verified-purchase logic; current ratings are static and fine for launch.
- **Defaults:** Mindset and Our Story pages kept and restyled rather than removed (cheap, on-brand content surface).

### 8.2 Product & Stock Management (Admin CRUD) — *v1 core*
- **v1:** Superadmin can create / edit / delete products; manage **per size + colour variants with stock counts**; upload/reorder/delete product images; edit descriptions, price, category, badges (new/limited); set product status; assign a product to a drop. Stock decrements on paid order; sold-out variants show as sold out and block add-to-cart.
- **May be part of future extension — Low-stock alerts + bulk CSV import/export of catalogue.** *Why needed:* speeds up large catalogue updates and prevents accidental oversell. *Why it's not in v1:* the client's catalogue is small at launch; manual CRUD is sufficient and faster to ship.
- **Defaults:** "Configurable product links" implemented as full admin-managed products plus an optional external-link field per product (e.g. Instagram/marketplace) surfaced in `siteSettings`/product.

### 8.3 Drops & Sold-Out Browsing
- **v1:** Admin creates drops, assigns products, marks each drop **Current / Past / Sold-out**. Shop highlights the current drop; a **"Past Drops"** view lists previous/sold-out drops (fixes "make sold out tabs for the previous drops").
- **May be part of future extension — Scheduled auto-publish of a drop at a set date/time + countdown.** *Why needed:* drop culture thrives on timed releases; automates the launch moment. *Why it's not in v1:* requires a scheduler/cron and careful timezone handling; manual publish covers launch.
- **Defaults:** countdown timer component (already built) reused on the current drop where relevant.

### 8.4 Cart & Checkout
- **v1 — slide-out cart drawer:** adding to cart (or clicking the cart icon) opens a **drawer that slides in from the right**, with the **rest of the page dimmed/blurred** behind it (à la Carhartt). The drawer shows line items (image, name, variant, price, qty stepper, remove), an **"Add order note"** expandable field, a "Tax included · Shipping calculated at checkout" line, a primary **Checkout · RM total** button, and a **View Cart** link to the full cart page. Closes via the × or backdrop click.
- **Order note:** an optional free-text note the customer can add in the drawer (e.g. "please pack flat", "leave at guardhouse") — **saved with the order and shown to the admin** in the order detail / order alert.
- **v1 — checkout:** collects name, email, phone, address (incl. state for shipping zone). **Stripe Checkout (Cards + FPX + GrabPay).** **Flat shipping by zone — West vs East Malaysia rates, free over a configurable threshold** (rates set in admin). Discount code applied at checkout. **COD removed** (per client). Guest checkout requires email; registered checkout pre-fills from account.
- **May be part of future extension — Touch 'n Go eWallet via a Malaysian aggregator (ToyyibPay/Billplz/Curlec).** *Why needed:* TnG eWallet is widely used in Malaysia and Stripe cannot process it. *Why it's not in v1:* it's a separate payment integration replacing/duplicating the Stripe layer; FPX already covers "pay directly from my bank," so it's not blocking for launch.
- **May be part of future extension — Shipping-rate logic by region / live courier rates.** *Why needed:* accurate postage at scale. *Why it's not in v1:* current flat/manual handling is acceptable for launch volume.
- **Defaults:** currency MYR, displayed `RM 1,500.00`. Stripe one-time KYC uses the client's SSM + bank details.

### 8.5 Accounts & Guest
- **v1:** **Better Auth** customer accounts — sign up / sign in with **email+password or Google social login**. Register-or-guest choice at checkout. Registered customers get a **Profile page** (details + their 10% code, copyable) and an **Orders page** showing past, pending, and current orders with status + tracking. Guests provide email at checkout, receive an **order-confirmation email**, and track via the public order-lookup page (order number + email). Password reset via emailed link (Better Auth).
- **May be part of future extension — Saved addresses / multiple addresses, more social providers (Apple/FB).** *Why needed:* faster repeat checkout. *Why it's not in v1:* email/password + Google covers the stated need; extra providers are incremental.
- **Defaults:** Google as the only social provider in v1; customer role assigned automatically; superadmin role never self-assignable.

### 8.6 First-Purchase Offer, Email Capture & Welcome
- **v1 — two paths to a 10% code, one code per email:**
  - **Popup capture:** a popup prompts for email to get 10% off the first purchase; a one-time-use code is emailed automatically (Resend). Email saved to `emailSubscriber`.
  - **Account signup:** when a customer creates an account, a **welcome email with their 10% code** is sent, and the code is **shown + copyable on their Profile page**.
  - If the email already has a code (e.g. popup then signup), the **same code is reused** — never two codes per email.
- **Account-locked, single-use enforcement (client requirement):** a code is issued to one **email**. At redemption the checkout email must match the issued email; the code must be **unused**. The first time a **logged-in account** redeems it, the code **locks to that `userId`** permanently — afterwards no other account (and no other email) can use it. Guests may redeem only if their checkout email matches the issued email. This delivers "only one account can use its code, cannot be used by other accounts, and only once."
- Code validated + marked used at checkout. **Popup trigger timing is an admin setting** (default: after ~5s or on scroll, once per visitor via cookie; client will finalise timing).
- **May be part of future extension — Newsletter campaigns / broadcast to subscribers.** *Why needed:* turns the captured list into repeat revenue. *Why it's not in v1:* needs broadcast tooling + unsubscribe compliance; capture-and-store is enough for launch.
- **Defaults:** code prefix `CRAZY…`, 10%, 30-day expiry, one per email, single-use, account-locked on first authenticated redemption.

### 8.6a Discount & Campaign Engine — *v1 core (new in rev. 2)*
- **v1 — admin campaign builder:** the owner creates named **campaigns** from a fixed set of **rule types**, no developer needed:
  - **Quantity tier** — "add more clothes, more discount": buy 2+ → 5%, 3+ → 10%, 5+ → 15% (thresholds + %s set by owner). Basis = total cart item count by default.
  - **Cart-total tier** — spend RM150+ → 5%, RM300+ → 10%.
  - **Buy X get Y%** — "buy 2 clothes for 5% off" style.
  - **Free shipping over RM** — waives the shipping fee above a threshold.
  - Each campaign has: name, active toggle, **date range** (start/end), priority, and a **"stacks with codes?"** flag (default off).
- **Live calculator in the builder (the "promo calculation page"):** as the owner types tiers, a right-hand preview shows a **sample cart** → subtotal, discount, **final price the customer pays**, and (if `costPrice` is set on variants) the **resulting margin** — so promos can't be mis-configured. This is a panel inside the builder, not a separate page.
- **Best-single-discount wins (no stacking):** at cart/checkout the engine evaluates every applicable campaign **plus** any applied promo code and applies **only the largest** discount. The customer sees which offer was applied ("FIRST10 applied — best offer"). A campaign's `stacksWithCodes` flag can later allow a code to stack on top (capped); default behaviour is best-single.
- **Where it runs:** discounts compute **server-side** against live cart + DB campaigns; the final amount is what's sent to Stripe (never trust a client-supplied total).
- **May be part of future extension — free-form IF/THEN rule engine, per-category/per-product targeting, max-discount caps, additive stacking, scheduled auto-activation.** *Why needed:* richer merchandising. *Why it's not in v1:* the fixed rule types cover every example the client gave; a Turing-complete builder multiplies the QA surface.
- **Defaults:** quantity tier basis = total cart item count; campaigns auto-apply (no code needed); priority breaks ties when two campaigns yield the same discount.

### 8.6b Pre-Checkout Upsell Popup — *v1 (new in rev. 2)*
- **v1:** when the shopper clicks **Checkout** and their cart is **1–2 items short of the next campaign tier**, a modal nudges them — e.g. *"Almost there! Add 1 more item and save 5% on your cart"* — with **[Add more]** (closes, returns to shop/cart) and **[Continue to checkout →]**. Auto-generated from the active quantity/cart-total campaigns; never blocks checkout.
- **Admin control:** a single toggle (on/off) plus an **editable copy template** (e.g. `Add {n} more for {discount}% off`) in `siteSettings`. Fires at most once per checkout attempt.
- **May be part of future extension — in-cart live progress bar ("RM30 to free shipping"), product recommendations in the popup.** *Why needed:* stronger upsell. *Why it's not in v1:* the click-to-checkout nudge covers the client's stated "popup message before checkout".
- **Defaults:** on; triggers only when a tier is within 2 items / a configurable RM gap; dismissible.

### 8.7 Order Alerts, Tracking & Transactional Email — *v1 core*
- **v1:** Per new (paid) order, an alert with customer, items, size/colour, quantity, total, placed date goes out via **one channel the client picks — Discord webhook OR owner email**. Only the chosen channel is built (not both). Customer gets an **order-confirmation email** regardless. Admin can attach a **courier name + tracking number** to an order; changing an order's status fires an **automatic status-change email** to the customer (e.g. "shipped" includes the tracking number). All order data stored (placed date, product type, size, colour, quantity, status, tracking, **customer order note**).
- **Why Discord is suggested (client picks one):** a Discord webhook gives an **instant push** to the owner's phone/desktop, **bypasses email spam/promotions filtering** (owner order alerts often get mis-sorted or throttled), turns a `#orders` channel into a **shared, searchable order feed**, and is near-zero setup (a single POST — no sending-domain verification). The email alternative gives a formal inbox record to forward to accounting. **Only one is built — the client chooses** at the start of the build; the other can be added later as a future extension if needed.
- **May be part of future extension — The second alert channel (whichever wasn't chosen), carrier tracking links / EasyParcel integration, customizable email templates.** *Why needed:* richer fulfilment + branding + redundancy. *Why it's not in v1:* the single chosen channel + manual tracking number + templated emails cover the core need at launch.
- **Defaults:** the chosen channel's config (Discord webhook URL or owner-email address) lives in admin `siteSettings`; status-change email copy templated per status.

### 8.8 Content Builder — Blog + Collab — *v1 core (expanded in rev. 2)*
- **v1 — block-based builder:** a Notion/WordPress-style editor where the owner composes a page from **blocks** — `heading`, `paragraph`, `image`, `image-grid`, `quote`, `button` — and drags to reorder. The **same builder powers a multi-post blog AND the collab page**: posts have `type = blog | collab`. Each post: slug, cover image (R2), title, excerpt, ordered blocks, publish toggle, SEO fields. **Server-rendered** at `/blog`, `/blog/[slug]`, and `/collab` for SEO. (Supersedes rev. 1's single-fixed-collab-page decision — the client now wants a customizable layout builder.)
- **Image handling:** every image/image-grid block uploads to **R2**; the builder shows thumbnails and alt-text fields.
- **May be part of future extension — categories/tags, scheduled publishing, more block types (video, embed, product-card), revision history.** *Why needed:* a maturing content operation. *Why it's not in v1:* the six core blocks cover the client's "add images and so on" brief; extras are incremental.
- **Defaults:** collab is one published post of `type=collab` surfaced at `/collab`; blog index lists `type=blog` posts newest-first.

### 8.9 Community Photos — *v1 core*
- **v1:** A **Community page/tab** where the admin uploads **real-customer photos** (caption, ordering, publish toggle) to a responsive grid — fixes the client PDF's "under community tab, upload pictures of real customers." Server-rendered.
- **May be part of future extension — Instagram hashtag/feed auto-pull + customer photo submissions.** *Why needed:* keeps the wall fresh without manual upload. *Why it's not in v1:* needs Instagram API access + moderation; admin upload covers the launch need.
- **Defaults:** manual admin upload; photos stored on Cloudflare R2.

### 8.10 FAQs, Size Guide, Social & SSM Footer
- **v1:** **FAQ** page/section (admin-managed Q&A). **Size guide** modal on PDP/Shop, Gymshark-style measurement table. **Social links** (Instagram, email, etc.) configurable in admin and shown in footer/nav. **SSM business number listed in the footer.** Updated per-product descriptions (client to provide copy).
- **May be part of future extension — Per-category / per-product size charts, unit toggle (cm/in).** *Why needed:* apparel sizing varies by garment. *Why it's not in v1:* one well-built universal chart covers the current 3-product catalogue.
- **Defaults:** one universal size guide using Gymshark's table as the template; social/SSM stored in `siteSettings`.

### 8.11 Admin Panel & Access Control — *v1 core*
- **v1:** **Exactly one `superadmin`-role user**, seeded once via Better Auth, **no admin signup route and the admin role is not self-assignable** (safeguarded — customer signups always get the `customer` role). Admin login via Better Auth (email/password), **password recovery via emailed reset link** to the locked owner email. Admin dashboard to manage: products/stock (incl. optional cost price), drops, orders (view/filter/update status + tracking, **read the customer's order note**, CSV export), **campaigns + the live promo calculator**, **the pre-checkout upsell toggle/copy**, **blog + collab posts via the block builder**, Community photos, FAQs, **runtime secrets (Stripe/Resend/Discord, AES-encrypted; env secrets shown read-only as ✓/✗ configured)**, and site settings. Sessions expire; logout supported.
- **May be part of future extension — Editable roles / additional staff accounts with per-page permissions.** *Why needed:* if the client grows a team, delegated access avoids sharing the superadmin login. *Why it's not in v1:* the client explicitly wants a single account at launch; multi-role adds RBAC surface that isn't needed yet.
- **Defaults:** superadmin seeded once (env-provided email); role gating enforced server-side on every admin route; cannot be self-deleted.

### 8.12 SEO
- **v1 (baseline):** server-rendered product and blog pages, clean per-page `<title>`/meta + Open Graph, `sitemap.xml`, `robots.txt`, semantic markup, fast Core Web Vitals via Next image optimization.
- **May be part of future extension (full pass) — Product (`Offer`) + Article structured data (JSON-LD), breadcrumb schema, canonical tuning, hreflang if multilingual, richer OG imagery, analytics/Search Console wiring.** *Why needed:* structured data drives rich results and ranking for a retail catalogue. *Why it's not in v1 (client's choice):* the SSR baseline already fixes the SPA's core indexing problem; the deep schema pass is a candidate for once content/catalogue stabilises.
- **Defaults:** baseline metadata baked in as pages are built.

---

## 9. Client Change-List Coverage (from "Crazywork Website Changes.pdf")

| Client request | Where handled | v1? |
|---|---|---|
| Click product → show product directly (no scroll-up) | §8.1 Storefront | ✅ |
| Add size guide (Gymshark sample) | §8.10 | ✅ |
| Email popup → 10% first-purchase, one-time code via email | §8.6 | ✅ |
| Register account OR continue as guest | §8.5 | ✅ |
| Registered: see past/pending/current order status | §8.5 | ✅ |
| Guest: email at checkout → confirmation email + order lookup | §8.5 / §8.7 | ✅ |
| Store order (date, type, size, colour, qty) + email owner per order | §8.7 | ✅ |
| Community tab: real customer photos | §8.9 | ✅ |
| Remove COD | §8.4 | ✅ |
| Add FAQs | §8.10 | ✅ |
| Add social links (Instagram, email…) | §8.10 | ✅ |
| Change per-product descriptions | §8.2 (client provides copy) | ✅ |
| Sold-out tabs for previous drops | §8.3 | ✅ |
| Add-to-cart popup on scroll within product | §8.1 | ✅ |
| Change "quick view" → "add to cart" | §8.1 | ✅ |

Additional client/owner asks also covered: off-Manus migration, Postgres DB (Docker dev / managed prod), **R2 storage**, new admin panel, clean UI, **configurable discount/campaign engine + live promo calculator**, **pre-checkout upsell popup**, **account-locked single-use promo codes**, **block-based blog + collab builder**, **admin-managed AES-encrypted secrets**, Better Auth with Google social login, welcome email + profile-page code, slide-out cart drawer with order note, sticky add-to-cart bar with size/colour selectors, flat West/East shipping, order tracking + status emails, Discord webhook, configurable product links, single safeguarded superadmin, SSM in footer, light/peach + orange theme.

---

## 10. User Stories

**Shopper (guest & registered)**
1. As a shopper, I want a product to open directly on its detail view, so that I don't have to scroll up to see what I clicked.
2. As a shopper, I want a size guide modal, so that I can pick the right size with confidence.
3. As a shopper, I want a sticky "Add to Cart" bar as I scroll a product, so that I can add it without scrolling back up.
4. As a shopper, I want "Add to Cart" instead of "Quick View," so that the primary action is buying.
4a. As a shopper, I want a slide-out cart drawer (with the page dimmed behind it) where I can review items and checkout, so that I don't lose my place on the page.
4b. As a shopper, I want to add an order note with special requests, so that the seller knows how I'd like my order handled.
5. As a first-time visitor, I want a 10%-off code emailed to me for signing up, so that I'm rewarded for my first purchase.
6. As a shopper, I want to choose between creating an account or checking out as a guest, so that I'm not forced to register.
7. As a guest, I want to enter my email at checkout and get a confirmation email, so that I have a record of my order.
8. As a shopper, I want to pay by card, FPX, or GrabPay, so that I can use my preferred Malaysian payment method.
9. As a shopper, I want to see which sizes/colours are sold out, so that I don't try to buy unavailable stock.
10. As a shopper, I want to browse the current drop and past (sold-out) drops, so that I can see the brand's history and what's live now.
11. As a shopper, I want to read FAQs, so that I can answer my own questions before buying.
12. As a shopper, I want to see real customer photos, so that I trust the product and brand.
13. As a shopper, I want to read the gym-collaboration blog, so that I feel part of the community.
14. As a shopper, I want to find the brand's Instagram and contact links, so that I can follow and reach them.

**Registered customer**
15. As a registered customer, I want my details pre-filled at checkout, so that buying is faster.
16. As a registered customer, I want to see my past, pending, and current orders with status, so that I can track everything in one place.
17. As a registered customer, I want to log out, so that my account stays secure on shared devices.

**Owner / Superadmin**
18. As the owner, I want one secure admin account that can't be duplicated, so that only I control the store.
19. As the owner, I want to add, edit, and remove products, so that I manage my catalogue without a developer.
20. As the owner, I want to set stock per size and colour, so that the store sells out accurately.
21. As the owner, I want to edit product descriptions and prices, so that listings stay current.
22. As the owner, I want to group products into drops and mark them current/past/sold-out, so that browsing reflects my release model.
23. As the owner, I want to view, filter, update, and export orders, so that I can fulfil and reconcile sales.
24. As the owner, I want a new-order alert on my chosen channel (Discord ping or email), so that I never miss a sale.
25. As the owner, I want to publish blog posts about gym collaborations, so that I grow the community.
26. As the owner, I want to upload community photos, so that I showcase real customers.
26a. As the owner, I want to see the customer's order note on each order, so that I can honour their requests when packing.
27. As the owner, I want to manage FAQs, social links, the SSM number, and the Discord webhook, so that I control site content and settings.
28. As the owner, I want my product images hosted on my own infrastructure, so that I don't depend on Manus staying online.

**SEO / system**
29. As the owner, I want product and content pages server-rendered with proper metadata and a sitemap, so that customers can find my store on Google.
30. As a shopper, I want to sign in with Google, so that I don't have to create another password.
31. As a new account holder, I want a welcome email with my 10% code and the same code visible on my profile, so that I can find and use it easily.
32. As a shopper, I want a sticky bar with size and colour pickers when I scroll a product, so that I can choose a variant and add to cart in one tap.
33. As the owner, I want to attach a tracking number and have the customer auto-emailed on status changes, so that buyers self-serve their delivery status.

---

## 11. Implementation Decisions

- **Port to Next.js App Router**; reuse shadcn `ui/*`, Tailwind, brand tokens, framer-motion, Stripe + order/discount logic. Replace Vite, Wouter, Express, and all Manus `_core` services.
- **Prisma + Postgres** (Docker dev / managed prod) replaces Drizzle + MySQL; schema rewritten per §7 (variants and order items normalized; campaigns, content blocks, encrypted secrets added).
- **Hono** API mounted as a Next catch-all route handler; type-safe client via `hono/client`.
- **Products move from hard-coded files into the database**; the admin panel is the single source of truth for catalogue, stock, and drops.
- **Per size + colour variant stock**; stock decremented on payment confirmation (Stripe webhook).
- **Better Auth** for all auth: customers via email/password **+ Google social**; **single seeded `superadmin`-role user** (admin role not self-assignable, no admin signup, cannot be self-deleted); admin + customer password recovery via emailed reset link; guest checkout = email only.
- **Account signup sends a welcome email with a 10% code** (one per email, reused if already issued via popup); code shown + copyable on the customer Profile page.
- **Sticky add-to-cart bar with size + colour selectors** on PDPs.
- **Per size + colour variant stock**; **flat West/East Malaysia shipping** with free-over-threshold, configurable in admin.
- **Order tracking** (courier + tracking number) + **automatic status-change emails** to the customer.
- **Stripe Checkout** (Cards + FPX + GrabPay) now; payment layer abstracted so a **TnG-capable aggregator** can be added later without reworking the order model.
- **Resend** for transactional email (welcome/OTP discount, order confirmation, status-change, and the owner alert *if* email is the chosen alert channel); **one owner-alert channel built — Discord webhook OR owner email, client's choice** — configured in `siteSettings`.
- **Cloudflare R2** (S3-compatible client) for all uploads; existing CloudFront product images re-hosted before Manus is decommissioned.
- **Baseline SEO** (SSR, metadata, OG, sitemap, robots) in v1; full structured-data pass is a future extension.

## 12. Testing Decisions

Good tests assert **external behaviour**, not implementation details. Prior art exists in the current repo (`server/stripe.test.ts`, `server/auth.logout.test.ts`) using Vitest — carry that forward.

Target for tests (deep modules with stable interfaces):
- **Stock / variant module** — add-to-cart blocked on zero stock; stock decrements correctly on paid order; sold-out states derived correctly.
- **Discount-code module** — generate (one per email), validate (invalid/used/expired), apply (marks used). Carries over from existing logic.
- **Order creation + webhook** — order persists with correct items/variants/total; status transitions; owner alert + confirmation fire on paid.
- **Auth / safeguard** — customer signup always gets `customer` role; admin role not self-assignable; single superadmin only; Google social login round-trips; protected admin routes reject non-superadmin requests.
- **Pricing / checkout total** — line items, discount, and total computed correctly before handing to Stripe.

Confirm with the client which of these they want covered first; the stock, discount, and order/webhook modules are the highest-value targets.

## 13. Out of Scope (v1)

- Touch 'n Go eWallet (future extension via aggregator).
- Multi-admin / editable roles & permissions.
- **Free-form discount rule engine, additive stacking, per-category targeting, max-discount caps** (v1 ships fixed rule types + best-single-wins).
- **Instagram auto-feed / customer photo submissions for the Community page** (v1 is admin-uploaded photos).
- **Content builder extras** — categories/tags, scheduled publishing, video/embed/product-card blocks, revision history (v1 ships the six core blocks).
- Social providers beyond Google (Apple/Facebook); saved/multiple addresses.
- Wishlist, real verified-purchase reviews, newsletter/broadcast campaigns.
- Live courier shipping rates (EasyParcel etc.); v1 uses flat West/East rates.
- Full SEO structured-data pass; multilingual storefront.
- Scheduled/auto-publishing drops with automated countdowns.
- **Secret key rotation / cloud KMS / audit log** (v1 uses a single static AES master key in env).
- Migrating historical Manus orders/customers (starting fresh).

## 14. Open Questions to Confirm with Client

*Logistics / assets the client must provide (not design decisions):*
1. **Domain** — what custom domain do we deploy to (e.g. `crazywork.my`)? Who holds the registrar/DNS?
2. **Stripe account** — Stripe Malaysia account + SSM doc + bank details for KYC; FPX/GrabPay enabled in the dashboard.
3. **Google OAuth** — Google Cloud OAuth client ID/secret for the "Sign in with Google" flow (Zedech can set this up if given access).
4. **Owner alert targets** — the email address and the Discord channel/webhook for order alerts.
5. **Resend** — verified sending domain/email for transactional mail.
6. **Product copy & images** — new per-product descriptions + higher-quality photos (or confirm AI-generated imagery is acceptable, and for which products).
7. **SSM number** — exact registration number/string to display in the footer.
8. **Collab content** — copy + images for the Collab showcase page.
8a. **Cloudflare R2** — R2 bucket + access key id/secret + public bucket/CDN domain for image hosting.
8b. **AES master key** — a 32-byte key (Zedech generates) set as `AES_MASTER_KEY` env at deploy; it encrypts all admin-entered runtime secrets and must never live in the DB.
8c. **Launch campaigns** — confirm the first discount campaigns (quantity tiers / cart-total / buy-X-get-Y / free-shipping threshold) and whether any should stack with codes.

*Still to confirm:*
9. **Discount popup timing** — client to finalise (built as an admin setting; default after ~5s / on scroll, once per visitor).
10. **Size guide** — confirm one universal Gymshark-style chart is acceptable for the current catalogue.
11. **Community photos** — client to supply the real-customer photos (with permission to publish) to seed the Community page.

## 15. Rough Delivery Plan (2–3 focused days)

- **Day 1 — Foundation:** scaffold Next.js + Hono + Prisma + **Docker Postgres**; **Better Auth** (email/password + Google + superadmin seed); port shadcn components + brand tokens; Prisma schema + seed (superadmin, site settings); **encrypted-secrets store + AES helper**; re-host the 3 products' images to **R2**; products/variants/drops into DB.
- **Day 2 — Storefront + Commerce:** restyle Home/Shop/PDP/Cart/Checkout (Gymshark-led, Carhartt slide-out cart); sticky add-to-cart bar with size/colour selectors, size guide, direct-to-product, sold-out states; Stripe Checkout (Cards/FPX/GrabPay) + webhook; flat West/East shipping; **discount engine (server-side best-single-wins) + pre-checkout upsell popup**; email-capture popup + welcome/OTP email + **account-locked promo codes** + profile-page code; order confirmation + the chosen owner-alert channel (Discord OR email); guest order lookup + account order history.
- **Day 3 — Admin + Content + Ship:** admin panel (product/stock CRUD + cost price, drops, orders + tracking + status-change emails + CSV, **campaign builder + live promo calculator**, **block-based blog/collab builder**, Community photos, FAQ, **encrypted-secrets settings**); Blog + Collab + Community + FAQ public pages; baseline SEO (metadata, sitemap, robots, OG); footer (social + SSM); QA, deploy, smoke test the golden path.

> The plumbing is mechanical and fast; the real time sink is **clean, light UI polish across every page** plus the **admin CRUD surface**. Scope is locked tightly to hit the window; anything in §13/§14 that expands scope should be treated as a future extension.
