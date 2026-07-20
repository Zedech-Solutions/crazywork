import { Hono } from "hono";
import { sweepExpiredReservations } from "@/lib/orders";

export const cron = new Hono();

// Backstop for the Stripe checkout.session.expired webhook: hands stock back
// from any pending reservation whose hold has lapsed but whose release-webhook
// was missed or delayed. Safe to run on a schedule — releases are idempotent.
//
// Guarded by CRON_SECRET: Vercel Cron sends it as `Authorization: Bearer <...>`
// when the env var is set. With no secret configured (local/dev) it runs open.
cron.get("/release-reservations", async (c) => {
  const secret = process.env.CRON_SECRET;
  if (secret && c.req.header("authorization") !== `Bearer ${secret}`) {
    return c.json({ ok: false, message: "Unauthorized" }, 401);
  }
  const { released } = await sweepExpiredReservations();
  return c.json({ ok: true, released });
});
