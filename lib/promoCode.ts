import { randomBytes } from "crypto";

// Account-locked, single-use promo codes. Pure validation here; the checkout
// route persists the outcome (lockedUserId, used=true) inside a transaction.

export interface DiscountCodeRecord {
  id: string;
  code: string;
  issuedEmail: string;
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
  wrong_email: "This code was issued to a different email.",
  expired: "This code has expired.",
  already_used: "This code has already been used.",
  locked_to_other_account: "This code is locked to another account.",
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
  if (
    record.issuedEmail.trim().toLowerCase() !== input.email.trim().toLowerCase()
  ) {
    return { ok: false, reason: "wrong_email" };
  }
  if (record.expiresAt && now > new Date(record.expiresAt)) {
    return { ok: false, reason: "expired" };
  }
  if (record.used) return { ok: false, reason: "already_used" };
  if (record.lockedUserId) {
    if (userId !== record.lockedUserId) {
      return { ok: false, reason: "locked_to_other_account" };
    }
    return { ok: true, lockToUserId: null };
  }
  return { ok: true, lockToUserId: userId };
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
