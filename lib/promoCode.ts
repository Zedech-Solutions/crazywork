import { randomBytes } from "crypto";

// Account-locked, single-use promo codes. Pure validation here; the checkout
// route persists the outcome (lockedUserId, used=true) inside a transaction.

export interface DiscountCodeRecord {
  id: string;
  code: string;
  issuedEmail: string | null; // null = campaign/bulk code, open to anyone
  percentage: number;
  used: boolean;
  lockedUserId: string | null;
  expiresAt: Date | string | null;
}

export type PromoRejection =
  | "not_found"
  | "wrong_email"
  | "expired"
  | "already_used"
  | "locked_to_other_account";

export type PromoValidation =
  | { ok: true; lockToUserId: string | null }
  | { ok: false; reason: PromoRejection };

export const PROMO_REJECTION_MESSAGES: Record<PromoRejection, string> = {
  not_found: "That code doesn't exist.",
  wrong_email: "This code isn't linked to your account — it belongs to someone else.",
  expired: "This code has expired.",
  already_used: "This code has already been used.",
  locked_to_other_account: "This code belongs to another account.",
};

export function validatePromoCode(input: {
  record: DiscountCodeRecord | null;
  email: string;
  userId?: string | null;
  now?: Date;
}): PromoValidation {
  const { record } = input;
  const now = input.now ?? new Date();
  const userId = input.userId ?? null;

  if (!record) return { ok: false, reason: "not_found" };

  // Personal codes are tied to an email; campaign/bulk codes (issuedEmail null)
  // are open to anyone.
  const issued = record.issuedEmail;
  if (
    issued &&
    issued.trim().toLowerCase() !== input.email.trim().toLowerCase()
  ) {
    return { ok: false, reason: "wrong_email" };
  }
  if (record.expiresAt && now > new Date(record.expiresAt)) {
    return { ok: false, reason: "expired" };
  }
  if (record.used) return { ok: false, reason: "already_used" };

  // Campaign code: single redemption by anyone, never account-locked.
  if (!issued) return { ok: true, lockToUserId: null };

  if (record.lockedUserId) {
    if (userId !== record.lockedUserId) {
      return { ok: false, reason: "locked_to_other_account" };
    }
    return { ok: true, lockToUserId: null };
  }
  return { ok: true, lockToUserId: userId };
}

// Campaign/bulk code: admin-chosen prefix (alphanumeric, uppercased) + a random
// suffix from the same alphabet as personal codes.
export function generateCampaignCode(prefix: string): string {
  const clean = prefix.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const bytes = randomBytes(6);
  let suffix = "";
  for (const byte of bytes) {
    suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `${clean}${suffix}`;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateCode(): string {
  const bytes = randomBytes(6);
  let suffix = "";
  for (const byte of bytes) {
    suffix += CODE_ALPHABET[byte % CODE_ALPHABET.length];
  }
  return `CRAZY${suffix}`;
}
