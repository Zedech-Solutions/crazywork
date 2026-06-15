# CRAZYWORK — The Complete Handbook

A plain-English guide to everything the CRAZYWORK store does, for **customers** and for **you (the admin)**. It covers every screen, every button, and the rules behind the scenes — including the "if this, then that" logic so you always know what the store will do.

- **Storefront** (what shoppers see): https://crazywork.vercel.app/
- **Admin panel** (what you manage): https://crazywork.vercel.app/admin
- **Currency:** Malaysian Ringgit (MYR), shown as `RM 1,500.00`. All money is calculated on the server, so prices can never be tampered with from the browser.

---

# Table of Contents

**Part 1 — Customer Guide**
1. Getting around the store
2. Browsing & finding products
3. Product pages (sizes, colours, stock)
4. The cart
5. Wishlist (accounts only)
6. Checkout, shipping & payment
7. Discount codes & the 10% popup
8. Accounts: sign up, sign in, Google, passwords
9. After ordering: confirmation & tracking
10. Content pages (Blog, FAQ, Drops, etc.)

**Part 2 — Admin Guide**
11. Logging in & the admin layout
12. Dashboard
13. Products
14. Drops
15. Orders (incl. manual/offline sales)
16. Customers
17. Campaigns (automatic discounts)
18. Promo Codes (influencer/bulk batches)
19. Settings (integrations, shipping, emails)
20. Site content: Pages, Content, Community, FAQs
21. Your profile & password

**Part 3 — Reference (the rules)**
22. How discounts are decided
23. Order statuses & what they trigger
24. Shipping zones & fees
25. Quick "if this, then that" cheat sheet

---

# PART 1 — CUSTOMER GUIDE

## 1. Getting around the store

Every page shares the same frame:

- **Announcement bar** (thin coloured strip at the very top). Default text: `FREE SHIPPING OVER RM150 · WEST & EAST MALAYSIA`. It only appears if you (the admin) set text for it.
- **Navbar:** the `CRAZYWORK` logo (returns home), plus links: **Shop · Drops · Collab · Mindset · Our Story · Community · Blog**. On the right: an **account** icon and a **cart bag** icon. When the cart has items, a small badge shows the count.
- **Footer:** brand blurb, link columns (Shop / Help / Brand), the copyright line (`© {year} CRAZYWORK · SSM {number} · Malaysia` — the SSM number only shows if set), and any social links you've configured (Instagram, TikTok, email).
- **Email popup:** a one-time "10% off" offer that appears after a few seconds (see §7).
- **Cart drawer:** a slide-out cart that opens from any page.

On mobile, the navbar links collapse into a hamburger menu.

**If a page doesn't exist** (a broken or mistyped link), customers see a friendly 404: *"This page skipped leg day."* with buttons **Shop the drop** and **Go home**.

## 2. Browsing & finding products

### Home page
Scrolling top to bottom, a shopper sees: a hero banner, a scrolling marquee, optional promo bands, "Shop by Category" tiles, the **Featured Drop** (up to 6 products from the current drop, or "The Latest" if there's no current drop), editorial tiles (Mindset / Our Story), and a Community photo strip. If you've set a drop countdown, a live "Starts in" timer appears on the featured drop.

### Shop page (`/shop`)
- Heading **"Shop All"** and a count: *"{N} pieces · built for the work"*.
- **Category chips:** "All" plus one chip per category. Tapping a chip filters the grid.
- **Sort options:** **Newest** (default), **Price ↑** (low to high), **Price ↓** (high to low).
- **If no products match** the filter: *"Nothing here yet — next drop loading."*

### Product cards (the tiles in any grid)
- Badges: **New** and/or **Limited** if the product is flagged that way.
- A **heart** to wishlist it (see §5).
- **If every size/colour is out of stock:** a dark **"Sold Out"** bar covers the card and there's no add button.
- **If in stock:** an **"Add to Cart"** bar appears on hover.
  - **If the product has exactly one in-stock variant**, clicking adds it straight to the cart (and opens the cart drawer).
  - **If it has multiple variants**, clicking takes the shopper to the product page to choose size/colour first.

## 3. Product pages (sizes, colours, stock)

Opening a product (`/product/{name}`) shows the image gallery, price, a size selector, a colour selector, **Add to Cart**, a wishlist heart, and the description. A **"Size guide ▸"** link opens a measurement table (the product's own guide, or your store default).

What the shopper experiences, case by case:

- **A size/colour combo that's out of stock** is shown dimmed and struck-through — it can't be selected.
- **The chosen combo is sold out:** the Add button is disabled and reads `{size} / {colour} — Sold Out`.
- **The whole product is sold out:** the button simply reads **"Sold Out"** and is disabled.
- **Low stock (3 or fewer left of the chosen variant):** a nudge appears — *"Only {n} left in {size}/{colour}"*.
- **Adding to cart** opens the cart drawer. Quantity can never exceed the available stock for that variant.
- A floating mini add-to-cart bar follows the shopper down the page once the main button scrolls away.
- **If a product link is wrong or the product is a draft/hidden,** the shopper gets the 404 page.

## 4. The cart

The cart is saved **in the browser** (so it survives refreshes) and does **not** require an account. There are two views:

**Cart drawer** (slide-out) and **Cart page** (`/cart`) — both show each line with image, name, `size / colour`, a quantity stepper (− / number / +), a remove (trash) button, and the line total.

- The **+ button is disabled** once you reach the available stock for that variant.
- Setting a quantity below 1 **removes** the line.
- There's an **order note** box ("Sizing requests, delivery instructions…") that travels through to checkout.
- **If the cart is empty:** *"Nothing yet. The work doesn't do itself."* with a **Shop the drop** button.
- Footer note: *"Tax included · Shipping calculated at checkout"*, plus a **Checkout · {subtotal}** button.

> Stock isn't re-checked while items sit in the cart — it's verified for real at checkout (see §6). So a shopper can add something that sells out before they pay; they'll be told at checkout.

## 5. Wishlist (accounts only)

The **heart** on any product saves it for later.

- **If the shopper is not signed in:** tapping a heart sends them to the sign-in page (*"Sign in to save items."*).
- **If signed in:** the item is saved, and hearts light up across the whole site.

The **Wishlist page** (`/account/wishlist`) requires sign-in (it redirects to sign-in otherwise). It shows saved products in a grid; un-hearting removes an item live. A **"Sold Out"** bar appears on any saved product that's now fully out of stock.

- **If nothing is saved:** *"Nothing saved yet — tap the heart on any product to save it here."*

## 6. Checkout, shipping & payment

Checkout (`/checkout`) works for **guests and signed-in customers** alike — no account required.

- **If the cart is empty:** *"Nothing to check out."* with a back-to-shop button.

### The form
Required: **Full name**, **Email**, **Address**, **Postcode**, **City**, **State** (dropdown, defaults to Selangor). Optional: **Phone**. The **shipping zone** (West / East Malaysia) is filled in automatically from the chosen state.

- **If signed in**, name and email are pre-filled from the account.
- The form is auto-saved as the shopper types, so leaving and coming back won't lose it.
- **If a required field is missing or the email looks invalid**, the order is refused with *"Missing checkout details."*

### Order summary
Shows each line, the **Subtotal**, any **Discount** lines (in colour, prefixed "−"), **Shipping ({zone})** — shown as **FREE** when waived — and the **Total**.

### Shipping fees (defaults — you can change these in Settings)
- **West Malaysia:** RM 8
- **East Malaysia** (Sabah, Sarawak, Labuan): RM 15
- **Free shipping** once the subtotal reaches **RM 150** (or via a free-shipping campaign).

### Paying
The **Pay {total}** button is disabled until a valid price quote has loaded. Clicking it:

1. **May first show an upsell popup** once per visit — e.g. *"Almost there! Add 1 more and save 10% on your cart"* — if the shopper is close to a better discount tier. (They can dismiss it and continue.)
2. Otherwise it creates the order and **redirects to Stripe** to pay by card, FPX, or GrabPay.

The order is saved as **pending before payment**, so an abandoned payment can still be found and retried — and **no discount code is "used up" until payment actually succeeds.**

**Possible messages at this step:**
- An item sold out while in the cart → *"{Product} ({size}/{colour}) is sold out."*
- An item was hidden/removed → *"An item in your cart is no longer available."*
- Payment system temporarily down → *"Payment is temporarily unavailable. Please try again shortly."*
- Internet dropped → *"Network problem — try again."*

## 7. Discount codes & the 10% popup

### The 10% popup
A few seconds after arriving, a first-time visitor sees: **"10% off. Earned by showing up."** Entering an email returns a **single-use code locked to that email** (and emails it once).

- **New claim:** *"You're in."* + the code (click to copy).
- **Already claimed (unused):** *"Already yours."* + the same code (no second email).
- **Already used:** *"Already used."* — the code is one-time only.
- **Bad email:** *"Enter a valid email."*

The popup appears **only once per browser** — once dismissed it won't return.

### Entering a code at checkout
Type the code and press **Apply**.

- **Valid:** *"Code {CODE} applied."* and the discount appears in the summary.
- **Doesn't exist:** *"That code doesn't exist."*
- **Belongs to someone else's email:** *"This code isn't linked to your account — it belongs to someone else."*
- **Expired:** *"This code has expired."*
- **Already used:** *"This code has already been used."*
- **Locked to another account:** *"This code belongs to another account."*

There are two kinds of codes:
- **Personal codes** (the 10% first-purchase code) — tied to one email, single use.
- **Campaign/bulk codes** (influencer codes you generate) — open to anyone, but each code works **once total**.

How codes combine with automatic campaign discounts is in §22.

## 8. Accounts: sign up, sign in, Google, passwords

Accounts are optional. They're only needed for the **wishlist**, viewing your **saved 10% code**, and your **order history**.

- **Sign up** (`/auth/sign-up`): Name, Email, Password (**min 8 characters**). Creating an account also issues the 10% first-purchase code. *"Sign up failed."* on error.
- **Sign in** (`/auth/sign-in`): Email + Password. Links to "Forgot password?" and "Create account".
- **Continue with Google:** available on both screens. *"Google sign-in isn't available right now."* if it's not configured.
- **Forgot password:** enter an email; the page always says *"If that email has an account, a reset link is on the way."* (it never reveals whether an email is registered).
- **Reset password:** opened from the emailed link. New password must be **≥ 8 characters** and match the confirmation. *"This reset link is invalid or has expired. Request a new one."* if the link is stale.

### Account home (`/account`)
Shows the customer's name, email, their **10% first-purchase code** (click to copy if unused, or marked **Used** if spent), and buttons for **My orders**, **Wishlist**, and **Sign out**.

### Order history (`/account/orders`)
Lists past orders (matched by account **or** by the email used at checkout), newest first, each with a status badge, date, total, items, and tracking if shipped. **If none:** *"No orders yet — change that."*

## 9. After ordering: confirmation & tracking

- **Success page:** after paying, the shopper lands on a confirmation showing the order number (click to copy) with **Keep shopping** and **Track order** buttons. The confirmation **email** is sent the moment payment succeeds.
- **Track order** (`/orders/lookup`) — for guests especially: enter the **order number** *and* the **email** used at checkout.
  - **Both must match.** If not: *"No order found for that combination."*
  - On success: order status, date, items, tracking (courier + number) and total.
- **Order numbers** look like `CW-260612-XXXX` (CW, the date, then 4 characters).

## 10. Content pages

- **FAQ** (`/faq`): questions grouped by category, each expandable. Empty: *"Questions and answers coming soon."*
- **Drops** (`/drops`): every drop with a badge — **Live now**, **Past drop**, or **Sold out**.
- **Blog** (`/blog`) and posts (`/blog/{slug}`): articles with cover image, date, and rich content.
- **Collab** (`/collab`): the latest collaboration, or *"Something's cooking."* if none.
- **Community** (`/community`): customer photos. Empty: *"Photos coming — the work continues."*
- **Mindset** and **Our Story:** editorial brand pages.

---

# PART 2 — ADMIN GUIDE

## 11. Logging in & the admin layout

The admin panel lives at **`/admin`**. There is a single **superadmin** account.

### Login (`/admin/login`)
Enter email + password.
- **Wrong details:** *"Wrong email or password."*
- **Right details but not an admin account:** *"This account doesn't have admin access."* (and you're signed back out).
- On success you land on the dashboard.

> Every admin page and action checks that you're the superadmin. A non-admin who tries gets *"Forbidden."*

### The layout
- **Left sidebar**, two groups:
  - **Store:** Dashboard · Orders · Customers · Products · Drops · Campaigns · Promo Codes
  - **Site:** Pages · Content · Community · FAQs
  - **Settings** is pinned at the bottom.
- **Live badges** in the sidebar:
  - **Products** shows a red badge = how many variants are low on stock. Tooltip: *"N items low on stock"*.
  - **Orders** shows a badge = paid orders still awaiting fulfilment.
- Top-right **user menu**: your profile, and **Log out**.
- A **"← Back to store"** link returns to the storefront.

Destructive actions always pop a branded confirm dialog ("Are you sure?") — there's no accidental one-click delete.

## 12. Dashboard (`/admin`)

Five stat cards (each clicks through to Orders or Customers):

- **Revenue (paid, RM):** total of all orders in a paid status (paid, processing, shipped, delivered).
- **Est. profit (RM):** revenue after discounts, minus product cost. **Turns red if negative.** *Only accurate if you've entered cost prices on variants.*
- **Orders:** total count.
- **Pending:** orders awaiting payment; the card glows when above zero.
- **Customers:** number of customer accounts.

Below that:
- **Sales charts** with a range toggle (**7 days / 30 days / 90 days / 12 months**) — revenue, est. profit, and order count over time.
- **Top products** in the range, **Most wishlisted**, **Active products** (with stock badges), and a **Low stock alerts** table.

## 13. Products (`/admin/products`)

### The list
Table of Product · Price · Stock · Drop · Status. **Stock turns red** when at/below your low-stock threshold (darkest red at 0). **Status** is **active** (visible) or **draft** (hidden). 20 per page. Click a row to edit; trash to delete.

### Adding / editing a product
Fields:
- **Name** (required). On a *new* product, typing the name auto-fills the **Slug** (the URL). Editing an existing product won't auto-change the slug.
- **Slug** (required). *"Slug and name are required."* if either is blank.
- **Description**, **Category** (free text, e.g. "Tees / Hoodies"), **Base price (RM)**.
- **Drop** dropdown (assign to a drop, or "— None —").
- Checkboxes: **Active (visible in store)**, **NEW badge**, **LIMITED badge**.
- **Variants** — one row per **Size × Colour**, with **Stock**, optional **SKU**, and optional **Cost (RM)**.
  - Cost price is only used for profit/margin math — it's never shown to customers.
  - **Important:** when you save, any variant row you removed is **permanently deleted**. Rows with stock you keep are updated.
- **Images** — upload one or more; they're stored on Cloudflare R2. Removing an image and saving **deletes it from storage**. Drag order = display order.
- **Size guide** — leave unchecked to use the store default, or tick **"Custom for this product"** to give it its own table.
- **SEO** — Meta title and Meta description.

### Deleting a product
Confirm: *"Delete this product and all its variants? This can't be undone."* Variants and images are removed, and the images are deleted from storage too.

> **Selling rule:** a product only sells if its status is **active**. Draft products can't be checked out — a customer with one in their cart sees *"An item in your cart is no longer available."*

## 14. Drops (`/admin/drops`)

Drops are themed collections.

- **Create:** type a name (e.g. "Drop 03 — Iron Season"). The slug is auto-generated; status starts as **Current**.
- Each drop has a **status dropdown** that saves instantly:
  - **Current** — featured on the home page.
  - **Past** — archived.
  - **Sold out** — every product in it shows as sold out to customers.
- **Delete:** *"Delete this drop? Its products stay, just unassigned."* — products survive; they just lose the drop tag.
- You assign products to a drop from the **product editor**, not here.

## 15. Orders (`/admin/orders`)

### The list
Controls: **search** (matches almost any field — order #, name, email, phone, address, state, status, tracking, courier, total, item names), **status** filter, **sort** (Newest / Oldest / Highest / Lowest total), **Active / Archived** view, a **date range** filter (with Last 7 days / This month / This year presets), **Export CSV**, and **New order**.

Default behaviour:
- With no status filter, **cancelled orders are hidden** (pick "cancelled" to see them).
- **Test orders are hidden** unless you turn on "Show test orders" in Settings. They carry a "Test" tag.

Two overview bars — **Orders by status** and **Items by status** — give you clickable counts across all live orders.

### Working an order
Expanding an order shows a progress stepper (Pending → Paid → Processing → Shipped → Delivered, or a red "cancelled" banner), the items, the money breakdown, payment info, the shipping address, the customer's note, and **courier + tracking** fields.

**Changing status** (the "Mark X" buttons):
- You can move an order to **any** status from any status — there's no forced order, so you can correct mistakes freely.
- **Marking "Shipped" requires a courier and tracking number.** Without them: *"Courier and tracking number are required to mark an order shipped."*
- **Moving a pending order to paid/processing/shipped/delivered deducts stock** and triggers the paid side-effects **once**: a Discord order alert, the customer's confirmation email, and a low-stock alert if a variant dips below threshold.
- **Every status change emails the customer** an update (including tracking when shipped) — if order emails are enabled in Settings.

**Editing money & payment:**
- The pencil by **Total** lets you set the amount actually paid (any gap is recorded as a "Manual adjustment" discount). *"Enter a valid amount."* if invalid.
- The pencil by **Payment** lets you set the method (Cash / Bank transfer / FPX / DuitNow / Card / Stripe / Offline).

**Archive vs delete:**
- **Archive** = soft delete (hidden from the active list, fully restorable from the **Archived** view). *"It isn't deleted — you can restore it anytime."*
- **Delete permanently** is only allowed on an **already-archived** order. Trying to delete an active order is blocked: *"Archive the order before deleting it."* Orders are financial records — this two-step guard is deliberate.

**CSV export** respects your filters and an "Include test orders" checkbox (off by default).

### Manual / offline orders (the "New order" button)
For walk-in or off-platform sales:
- Add **line items** (product → variant → quantity).
- **Customer:** Name (required), Email & Phone (optional).
- **Status** dropdown — **Pending makes *no* stock change**; any other status deducts stock.
- **Payment method** and an optional **note**.
- **"Save as a customer account"** (on by default): on → creates/links a customer record (needs an email — *"Add an email to create a customer."*); off → a private sale that won't appear under Customers.
- **Amount charged (RM):** leave blank for full price, or enter less to record a discount.
- **If a quantity exceeds stock:** a red panel offers **"Use N"** (clamp to available) or a restock input. Submitting is blocked until fixed: *"Some items exceed available stock — lower the quantity or restock below."*

## 16. Customers (`/admin/customers`)

A read-only directory. A "customer" is anyone with an account **or** anyone who placed an order (merged by email). Anonymous walk-in sales are excluded.

Each row: name, **Account/Guest** badge, email, phone, **order count**, **total spent** (paid orders only), and **last order** date. Search by name or email; 20 per page.

Expanding a row loads that person's **wishlist**:
- No account → *"No login account for this email — wishlists are account-only."*
- Account but empty → *"Nothing saved yet."*

## 17. Campaigns (automatic discounts) (`/admin/campaigns`)

Campaigns apply automatically at checkout — customers don't type anything.

**Reordering:** drag the cards. **Higher = higher priority** when two campaigns would give the same discount.

### The four campaign types
1. **Quantity tiers (buy more, save more):** set tiers of **Min items → Discount %**. The best tier the cart qualifies for applies.
2. **Cart total tiers (spend more, save more):** tiers of **Min subtotal (RM) → Discount %**.
3. **Buy X = Y% off:** buy at least X items, get Y% off the cart.
4. **Free shipping over RM…:** waives shipping once the subtotal hits the threshold. (This runs on a separate track — see §22.)

### Common fields
- **Name** (required — *"Name and a valid type are required."*).
- **Starts** / **Ends** dates (the end date counts the whole day).
- **Active** checkbox.
- **"Stack promo codes on top of this campaign"** — see §22.

### Live preview
A sandbox cart on the right runs the **real** discount engine so you can see the subtotal, discount, shipping, what the customer pays, and **your margin** before saving anything.

### Pre-checkout upsell
At the bottom you can enable the upsell nudge and edit its wording. `{n}` = how many items/RM away, `{percent}` = the reward. Default: *"Almost there! Add {n} more and save {percent}% on your cart"*. It fires when a cart is within **2 items** or **RM 50** of a better tier.

## 18. Promo Codes (influencer/bulk batches) (`/admin/codes`)

This screen creates **campaign/bulk code batches** (e.g. influencer codes). The personal 10% first-purchase codes are issued automatically on signup/popup and aren't managed here.

### Creating a batch
- **Campaign / influencer name** (required).
- **Code prefix** (auto-uppercased; needs at least one letter/number). Codes become `PREFIX` + 6 random characters (e.g. `SUMMER4KQ9P2`).
- **How many codes** (1–5000).
- **Discount:** Percentage or Fixed RM (must be > 0; percent ≤ 100).
- **Expiry** (optional).

### Managing batches
Each batch card shows the label, discount, **used/total**, and expiry. Actions:
- **View codes** — see each code, whether it's used, and who redeemed it.
- **Edit** — change label/discount/expiry for the whole batch. *Orders that already used a code keep their original discount.*
- **Export CSV.**
- **Delete** — removes all codes in the batch; past orders keep their record.

Every code is **single-use** and is only "spent" when an order is actually **paid** — abandoned checkouts never burn a code.

## 19. Settings (`/admin/settings`)

### Integrations (encrypted, never shown back)
Secrets are encrypted at rest and only ever displayed as a masked hint (e.g. `••••1234`). **Saving an empty value never wipes an existing secret** — it's ignored on purpose.

- **Stripe** (checkout — cards, FPX, GrabPay):
  - A **Test / Live toggle** that takes effect immediately.
  - Separate keys for test and live (secret key, publishable key, webhook secret).
  - A **"How to connect"** guide and a **Test** button that does a real connectivity check.
  - ⚠ Live mode means **real cards and real charges**.
- **Resend** (transactional email — confirmations & resets): API key + "from" email, with a real validation **Test**.
- **Discord** (alerts): three separate webhooks — **Orders**, **Low-stock**, and **Errors** — each to its own channel.

A card shows **Not connected / Partial / Connected** based on how many keys are filled.

### Store settings (one "Save store settings" button)
- **West shipping (RM)** (default 8), **East shipping (RM)** (default 15), **Free shipping over (RM)** (default 150).
- **Low-stock alert at (units)** (default 3) — drives the red badges, the dashboard table, and Discord low-stock alerts.
- **Instagram / TikTok / Contact email / SSM number.**
- **Email popup delay (seconds)** (default 6) and **Drop countdown until** (shows a countdown on the featured drop).
- **Show test orders** — surface Stripe test-mode orders in admin and Discord.
- **Email notifications** — independent on/off switches for: **Welcome / first-purchase code**, **Password reset link**, **Order confirmation**, **Order status update**. ⚠ Turning password-reset emails off means customers can't recover accounts by email.

### Default size guide
Edit the measurement table used by any product that doesn't have its own.

### Admin account
Change your password here (also available on the Profile page).

## 20. Site content: Pages, Content, Community, FAQs

### Pages — visual builder (`/admin/pages`)
Tabs for **Home / Mindset / Drops / Footer / Checkout**. Each shows a **live preview** with orange ✎ tags — click a region to edit it; changes preview instantly. Saving merges your edits over the defaults (so a partial edit can't blank out a section). Highlights:
- **Home:** announcement bar, hero (image/video, headline, two CTA buttons), marquee lines, category tiles, featured label, drag-and-drop **promo bands** (placed in four slots), Mindset/Story tiles, community labels. Has **Reset** and **Save**.
- **Mindset:** header + story articles.
- **Drops:** heading + description.
- **Footer:** tagline + blurb (links/socials live in Settings).
- **Checkout (success):** background image, heading, subheading.

### Content — blog & collab posts (`/admin/content`)
Block-based editor that powers `/blog` and `/collab`.
- Fields: Title (auto-slug on new), Slug, **Type** (Blog / Collab), cover image, excerpt, **Published**, SEO.
- **Blocks** (drag to reorder): heading, paragraph (**bold**/*italic*), image, image grid (2/3/4 columns), quote, button.
- Requires a title + slug to save. Removing images deletes them from storage.

### Community (`/admin/community`)
- **Upload photos** or **add by Instagram link** (needs an image or a post link).
- Each tile has an editable caption + IG URL, a **Live** toggle, and delete.

### FAQs (`/admin/faqs`)
- Add a **Question** (required), optional **Category**, and **Answer** (required).
- Each FAQ has a **Live** toggle and delete. Edit the answer inline.

## 21. Your profile & password (`/admin/profile`)

- **Display name** — editable; email is fixed.
- **Change password** — current + new (min 8) + confirm. On success, other sessions are signed out: *"Password updated. Other sessions signed out."*

---

# PART 3 — REFERENCE (the rules)

## 22. How discounts are decided

All discounts are computed on the server in two separate "tracks":

**Track 1 — item discounts (campaigns + the promo code):**
1. Only campaigns that are **active and within their date window** count.
2. Among those, **only the single largest** applies ("best-single-wins"). Ties are broken by the campaign's drag-order priority.
3. The promo **code** is treated as its own discount.
4. **By default, only the larger of (best campaign) vs (code) applies.**
5. **Stacking:** if the winning campaign has **"Stack promo codes on top"** turned on, the code is *added on top* and both show as separate lines.
6. The combined discount can never exceed the subtotal.

**Track 2 — free shipping:** `free_shipping_over` campaigns (and the store-wide free-shipping threshold) waive the shipping fee independently — they don't compete with item discounts.

## 23. Order statuses & what they trigger

| Status | Meaning | Side-effects when entered |
|---|---|---|
| **pending** | Created, not yet paid | None. No stock deducted. |
| **paid** | Payment received | **Deducts stock**, sends confirmation email + Discord alert + low-stock check (once). |
| **processing** | Being prepared | Status-update email. (Deducts stock if coming from pending.) |
| **shipped** | Dispatched | **Requires courier + tracking.** Status-update email with tracking. |
| **delivered** | Received | Status-update email. |
| **cancelled** | Cancelled | Status-update email. Hidden from the default list. |

Notes:
- The "deduct stock & notify" step runs **once**, the first time an order leaves pending into any paid-type status.
- Admins can move between any statuses to fix mistakes.

## 24. Shipping zones & fees

- **West Malaysia** = everywhere except the three East states. Default fee **RM 8**.
- **East Malaysia** = **Sabah, Sarawak, Labuan**. Default fee **RM 15**.
- The zone is decided automatically from the customer's state at checkout.
- **Free shipping** once the subtotal reaches the threshold (default **RM 150**), or via a free-shipping campaign.

## 25. Quick "if this, then that" cheat sheet

| If… | Then… |
|---|---|
| A product's every variant has 0 stock | Card shows **Sold Out**, no add button |
| A chosen size/colour is out of stock | Add button is disabled, reads "… — Sold Out" |
| A variant has ≤ 3 left | "Only {n} left" nudge on the product page |
| Cart subtotal ≥ RM 150 | Shipping is **FREE** |
| Customer not signed in + taps wishlist heart | Sent to sign-in |
| Guest checks out | Allowed — order tied to their email |
| Promo code already used | "This code has already been used." |
| Personal code used with a different email | "This code isn't linked to your account…" |
| Payment abandoned | Order stays **pending**; code **not** consumed; retrievable via Track Order |
| Admin marks order shipped without tracking | Blocked — courier + tracking required |
| Admin moves pending → paid | Stock deducted; confirmation email + alerts fire once |
| Admin tries to delete an active order | Blocked — "Archive the order before deleting it." |
| Admin removes a variant and saves | That variant is **permanently deleted** |
| Admin removes a product/content image | The file is **deleted from storage** |
| Admin saves an empty secret value | Ignored — existing secret is kept |
| Product status = draft | Hidden from store; can't be checked out |
| Drop status = sold out | All its products show as sold out |
| Two campaigns give the same discount | Higher-positioned (priority) one wins |
| Campaign has "stack codes" on | Promo code adds on top of the campaign |
| Password-reset emails turned off | Customers can't recover accounts by email |

---

*This handbook reflects the store's current behaviour. If you change defaults in **Settings**, the numbers above (shipping fees, free-shipping threshold, low-stock level, popup delay) change accordingly.*
