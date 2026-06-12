# CRAZYWORK — clean build branch

This is the **clean, Manus-independent** branch for the CRAZYWORK storefront + admin rebuild.
The previous Manus-generated code is preserved on `backup/manus-original` (and `main`); it is **not** part of this branch.

## What's here (the "frame" for the Fable one-shot)
- **`FABLE-ONESHOT-CONTEXT.md`** — the self-contained build brief. Start here.
- **`PRD-Crazywork.md`** — long-form product requirements (rev. 2).
- **`prisma/schema.prisma`** — draft data model (catalogue, orders, campaigns, content blocks, encrypted secrets).
- **`docker-compose.yml`** — local Postgres for dev.
- **`.env.example`** — boot-time env vars (copy to `.env`).
- **`reference /`** — brand kit + client change-list.

## Branches
- `main` — original Manus code (untouched).
- `backup/manus-original` — full snapshot of the Manus code + these docs.
- `staging` — clean frame (this branch); target for the Fable one-shot.
- `develop` — branched from `staging` for active build work.

## Local dev (once the app is generated)
```bash
docker compose up -d        # Postgres on :5432
cp .env.example .env        # fill in BETTER_AUTH_SECRET, AES_MASTER_KEY, Google OAuth
npx prisma migrate dev
npm run dev
```

Runtime secrets (Stripe / Resend / Discord) are entered in **Admin → Settings → Integrations**
and stored AES-256-GCM-encrypted in the DB — not in `.env`.
