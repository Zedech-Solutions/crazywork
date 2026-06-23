import { describe, expect, test } from "vitest";
import {
  generateCampaignCode,
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
    maxRedemptions: null,
    redeemedCount: 0,
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

  // Campaign/bulk codes have no issued email — open to anyone, single-use.
  test("campaign code (no issued email) is valid for any email, no lock", () => {
    const result = validatePromoCode({
      record: code({ issuedEmail: null }),
      email: "anyone@example.com",
      userId: "user_x",
      now: NOW,
    });
    expect(result).toEqual({ ok: true, lockToUserId: null });
  });

  test("campaign code still respects single-use", () => {
    const result = validatePromoCode({
      record: code({ issuedEmail: null, used: true }),
      email: "anyone@example.com",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "already_used" });
  });

  test("campaign code respects expiry", () => {
    const result = validatePromoCode({
      record: code({
        issuedEmail: null,
        expiresAt: new Date("2026-06-01T00:00:00Z"),
      }),
      email: "anyone@example.com",
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });
});

describe("validatePromoCode — shared quota codes", () => {
  const shared = (overrides: Partial<DiscountCodeRecord> = {}) =>
    code({ issuedEmail: null, maxRedemptions: 50, redeemedCount: 0, ...overrides });

  test("valid for any signed-in customer with quota remaining", () => {
    const result = validatePromoCode({
      record: shared(),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: false,
      now: NOW,
    });
    expect(result).toEqual({ ok: true, lockToUserId: null });
  });

  test("rejected when the quota is fully redeemed", () => {
    const result = validatePromoCode({
      record: shared({ maxRedemptions: 50, redeemedCount: 50 }),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: false,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "fully_redeemed" });
  });

  test("rejected when this customer already redeemed it", () => {
    const result = validatePromoCode({
      record: shared(),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: true,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "already_used" });
  });

  test("respects expiry before quota", () => {
    const result = validatePromoCode({
      record: shared({ expiresAt: new Date("2026-06-01T00:00:00Z") }),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: false,
      now: NOW,
    });
    expect(result).toEqual({ ok: false, reason: "expired" });
  });

  test("a used=true flag is ignored for shared codes (counter is the source of truth)", () => {
    const result = validatePromoCode({
      record: shared({ used: true, redeemedCount: 1, maxRedemptions: 50 }),
      email: "anyone@example.com",
      userId: "user_a",
      alreadyRedeemedByUser: false,
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

describe("generateCampaignCode", () => {
  test("uppercases the prefix and appends a random alphanumeric suffix", () => {
    expect(generateCampaignCode("summer")).toMatch(/^SUMMER[A-Z0-9]{6}$/);
  });

  test("strips non-alphanumerics from the prefix", () => {
    expect(generateCampaignCode("sum-mer 25!")).toMatch(/^SUMMER25[A-Z0-9]{6}$/);
  });

  test("generates distinct codes for the same prefix", () => {
    const batch = new Set(
      Array.from({ length: 50 }, () => generateCampaignCode("X")),
    );
    expect(batch.size).toBeGreaterThan(45);
  });
});
