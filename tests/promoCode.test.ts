import { describe, expect, test } from "vitest";
import {
  generateCode,
  validatePromoCode,
  type DiscountCodeRecord,
} from "@/lib/promoCode";

const NOW = new Date("2026-06-12T12:00:00Z");

function code(overrides: Partial<DiscountCodeRecord> = {}): DiscountCodeRecord {
  return {
    id: "dc1",
    code: "CRAZY1234",
    issuedEmail: "aina@example.com",
    percentage: 10,
    used: false,
    lockedUserId: null,
    expiresAt: null,
    ...overrides,
  };
}

describe("validatePromoCode", () => {
  test("unknown code is rejected", () => {
    const result = validatePromoCode({
      record: null,
      email: "aina@example.com",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
  });

  test("wrong email is rejected", () => {
    const result = validatePromoCode({
      record: code(),
      email: "someoneelse@example.com",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "wrong_email" });
  });

  test("email match is case-insensitive and trimmed", () => {
    const result = validatePromoCode({
      record: code(),
      email: "  AINA@Example.COM ",
      now: NOW,
    });
    expect(result.ok).toBe(true);
  });

  test("expired code is rejected", () => {
    const result = validatePromoCode({
      record: code({ expiresAt: new Date("2026-06-01T00:00:00Z") }),
      email: "aina@example.com",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  test("second use is rejected", () => {
    const result = validatePromoCode({
      record: code({ used: true }),
      email: "aina@example.com",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "already_used" });
  });

  test("guest with matching email is allowed", () => {
    const result = validatePromoCode({
      record: code(),
      email: "aina@example.com",
      userId: null,
      now: NOW,
    });
    expect(result).toEqual({ ok: true, lockToUserId: null });
  });

  test("first authenticated redemption locks the code to that user", () => {
    const result = validatePromoCode({
      record: code(),
      email: "aina@example.com",
      userId: "user_aina",
      now: NOW,
    });
    expect(result).toEqual({ ok: true, lockToUserId: "user_aina" });
  });

  test("after lock, another account is rejected even with the right email", () => {
    const result = validatePromoCode({
      record: code({ lockedUserId: "user_aina" }),
      email: "aina@example.com",
      userId: "user_impostor",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "locked_to_other_account" });
  });

  test("after lock, a guest session is rejected (must sign in as the owner)", () => {
    const result = validatePromoCode({
      record: code({ lockedUserId: "user_aina" }),
      email: "aina@example.com",
      userId: null,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "locked_to_other_account" });
  });

  test("the locked owner can still redeem (no re-lock needed)", () => {
    const result = validatePromoCode({
      record: code({ lockedUserId: "user_aina" }),
      email: "aina@example.com",
      userId: "user_aina",
      now: NOW,
    });
    expect(result).toEqual({ ok: true, lockToUserId: null });
  });
});

describe("generateCode", () => {
  test("uses the CRAZY prefix with an uppercase alphanumeric suffix", () => {
    const generated = generateCode();
    expect(generated).toMatch(/^CRAZY[A-Z0-9]{6}$/);
  });

  test("generates distinct codes", () => {
    const batch = new Set(Array.from({ length: 50 }, () => generateCode()));
    expect(batch.size).toBeGreaterThan(45);
  });
});
