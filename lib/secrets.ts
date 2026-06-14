import { prisma } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

// Runtime secrets: AES-256-GCM encrypted in the EncryptedSecret table,
// decrypted in-memory at call time. Plaintext is never logged or returned
// to the client — admin only ever sees a masked hint + configured status.

export const RUNTIME_SECRET_KEYS = [
  // Stripe test keys (the unprefixed trio is the sandbox/test set).
  "stripe_secret_key",
  "stripe_publishable_key",
  "stripe_webhook_secret",
  // Stripe live keys — used when stripeMode === "live".
  "stripe_live_secret_key",
  "stripe_live_publishable_key",
  "stripe_live_webhook_secret",
  "resend_api_key",
  "resend_from_email",
  "discord_webhook_url",
] as const;

export type RuntimeSecretKey = (typeof RUNTIME_SECRET_KEYS)[number];

export async function getSecret(key: RuntimeSecretKey): Promise<string | null> {
  const record = await prisma.encryptedSecret.findUnique({ where: { key } });
  if (!record) return null;
  try {
    return decryptSecret(record);
  } catch {
    return null; // tampered or re-keyed — treat as unconfigured
  }
}

export async function setSecret(
  key: RuntimeSecretKey,
  plaintext: string,
): Promise<void> {
  const encrypted = encryptSecret(plaintext);
  await prisma.encryptedSecret.upsert({
    where: { key },
    create: { key, ...encrypted },
    update: encrypted,
  });
}

export async function deleteSecret(key: RuntimeSecretKey): Promise<void> {
  await prisma.encryptedSecret.deleteMany({ where: { key } });
}

/** Masked hint for the admin UI, e.g. "••••1234". Never the full value. */
export async function getSecretHint(
  key: RuntimeSecretKey,
): Promise<string | null> {
  const value = await getSecret(key);
  if (!value) return null;
  return `••••${value.slice(-4)}`;
}

export async function secretStatuses(): Promise<
  { key: RuntimeSecretKey; configured: boolean; hint: string | null }[]
> {
  const records = await prisma.encryptedSecret.findMany({
    where: { key: { in: [...RUNTIME_SECRET_KEYS] } },
  });
  const byKey = new Map(records.map((r) => [r.key, r]));
  return Promise.all(
    RUNTIME_SECRET_KEYS.map(async (key) => ({
      key,
      configured: byKey.has(key),
      hint: byKey.has(key) ? await getSecretHint(key) : null,
    })),
  );
}

/** Boot secrets: status only (✓/✗) — values are never exposed. */
export function bootSecretStatuses(): { key: string; configured: boolean }[] {
  const keys = [
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "AES_MASTER_KEY",
    "SUPERADMIN_EMAIL",
    "SUPERADMIN_PASSWORD",
  ];
  return keys.map((key) => ({
    key,
    configured: Boolean(process.env[key]?.length),
  }));
}
