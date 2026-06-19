import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/db";
import { mailer } from "@/lib/integrations/mailer";
import { issueCodeForEmail } from "@/lib/codes";

// Customers: email+password and Google (env-stubbed). Role is NEVER
// client-assignable (input: false) — every signup is a customer; the single
// superadmin is created by the seed script from SUPERADMIN_EMAIL/_PASSWORD.

const googleConfigured = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  // DB-backed rate limiting. In-memory (the default) lives per serverless
  // instance, so on Vercel it resets on cold starts and over-counts behind the
  // shared edge — producing intermittent false "Too many requests" 429s. The
  // database store keeps one consistent counter across all instances.
  rateLimit: {
    // Default is production-only; keep it that way (dev stays unthrottled).
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      // Session lookups fire on nearly every page load — keep them generous.
      "/get-session": { window: 60, max: 1000 },
      // OAuth involves a couple of round-trips; don't trip on a retry.
      "/sign-in/social": { window: 60, max: 30 },
    },
  },
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      await mailer.send(user.email, "password_reset", { url });
    },
  },
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "customer",
        input: false, // clients can never set role
      },
      phone: { type: "string", required: false },
      address: { type: "string", required: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // welcome 10% first-purchase code — email only on first issue, so a
          // popup subscriber who later signs up isn't emailed the code twice.
          const { record, isNew } = await issueCodeForEmail(user.email, "signup");
          if (isNew) {
            await mailer.send(user.email, "welcome_code", { code: record.code });
          }
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
