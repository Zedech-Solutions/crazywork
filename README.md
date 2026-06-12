# CRAZYWORK — storefront + admin

Malaysian gym/lifestyle apparel store. Next.js 15 (App Router) + React 19 +
TypeScript · Tailwind 4 · Hono API (`app/api/[[...route]]`) · Prisma → Postgres
· Better Auth · Vitest. Currency is MYR (`RM 1,500.00`); all money math runs in
integer sen, server-side.

All external integrations are **stubbed behind interfaces** (`lib/integrations/`):

| Interface | Stub behaviour | Real impl (one-file swap) |
|---|---|---|
| `Storage` | writes `/public/uploads` | Cloudflare R2 |
| `Mailer` | console + in-memory log | Resend |
| `Payment` | redirects to `/checkout/success?fake=1` | Stripe (Cards + FPX + GrabPay) |
| `Notifier` | console | Discord webhook or owner email |

Runtime secrets (Stripe/Resend/Discord) are entered in **Admin → Settings →
Integrations** and stored AES-256-GCM encrypted (`lib/crypto.ts`), decrypted
in-memory at call time. Boot secrets live in `.env` only.

## Run it

```bash
docker compose up -d          # Postgres on :5432
cp .env.example .env          # then fill in:
#   BETTER_AUTH_SECRET  → openssl rand -base64 32
#   AES_MASTER_KEY      → openssl rand -base64 32
#   SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD
npm install
npx prisma migrate dev        # creates schema
npx prisma db seed            # superadmin, 3 products, campaigns, content, FAQs
npm run dev                   # http://localhost:3000  ·  admin at /admin
```

## Tests

```bash
npm test
```

Vitest suite (TDD, behaviour through public interfaces, no internal mocks):

- `tests/money.test.ts` — RM formatting, sen conversions
- `tests/crypto.test.ts` — AES-256-GCM round-trip, tamper detection, no plaintext leaks
- `tests/discount.test.ts` — best-single campaign engine, tier boundaries,
  free-shipping waiver, code-vs-campaign, upsell gap
- `tests/promoCode.test.ts` — email-locked single-use codes, account locking
- `tests/orders.test.ts` — status transitions, sold-out derivation, CSV, upsell template
- `tests/checkout.test.ts`* — server-side pricing, stock blocking/decrement,
  order lifecycle, code consumption
- `tests/auth.test.ts`* / `tests/api.test.ts`* — signup role safeguard,
  `/admin/*` guard, email-popup codes

\* integration tests — need the docker-compose Postgres running (schema migrated).

## Structure

- `lib/` — pure business logic (discount, promoCode, crypto, orders, money, settings)
- `server/` — Hono app (`routes/storefront.ts`, `routes/admin.ts`)
- `app/(store)/` — public storefront (SSR) · `app/admin/` — superadmin panel
- `prisma/` — schema, migrations, seed
- `reference /` — brand kit + client change-list (note the trailing space)

Original Manus build is preserved on `backup/manus-original`.
