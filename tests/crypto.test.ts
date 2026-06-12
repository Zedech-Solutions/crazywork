import { describe, expect, test } from "vitest";
import { decryptSecret, encryptSecret } from "@/lib/crypto";

const PLAINTEXT = "sk_test_super_secret_stripe_key_12345";

describe("encryptSecret / decryptSecret (AES-256-GCM)", () => {
  test("encrypt → decrypt round-trips the plaintext", () => {
    const record = encryptSecret(PLAINTEXT);
    expect(decryptSecret(record)).toBe(PLAINTEXT);
  });

  test("produces a fresh random IV per encryption (same input ≠ same output)", () => {
    const a = encryptSecret(PLAINTEXT);
    const b = encryptSecret(PLAINTEXT);
    expect(a.iv).not.toBe(b.iv);
    expect(a.ciphertext).not.toBe(b.ciphertext);
  });

  test("IV is 12 bytes", () => {
    const { iv } = encryptSecret(PLAINTEXT);
    expect(Buffer.from(iv, "base64")).toHaveLength(12);
  });

  test("never stores plaintext in any output field", () => {
    const record = encryptSecret(PLAINTEXT);
    for (const field of Object.values(record)) {
      expect(field).not.toContain(PLAINTEXT);
      expect(Buffer.from(field, "base64").toString("utf8")).not.toContain(
        PLAINTEXT,
      );
    }
  });

  test("tampered ciphertext fails authentication", () => {
    const record = encryptSecret(PLAINTEXT);
    const bytes = Buffer.from(record.ciphertext, "base64");
    bytes[0] ^= 0xff;
    expect(() =>
      decryptSecret({ ...record, ciphertext: bytes.toString("base64") }),
    ).toThrow();
  });

  test("tampered auth tag fails authentication", () => {
    const record = encryptSecret(PLAINTEXT);
    const tag = Buffer.from(record.authTag, "base64");
    tag[0] ^= 0xff;
    expect(() =>
      decryptSecret({ ...record, authTag: tag.toString("base64") }),
    ).toThrow();
  });

  test("decrypting with a different master key fails", () => {
    const record = encryptSecret(PLAINTEXT);
    const original = process.env.AES_MASTER_KEY;
    process.env.AES_MASTER_KEY = Buffer.alloc(32, 9).toString("base64");
    try {
      expect(() => decryptSecret(record)).toThrow();
    } finally {
      process.env.AES_MASTER_KEY = original;
    }
  });

  test("handles empty string and unicode round-trips", () => {
    expect(decryptSecret(encryptSecret(""))).toBe("");
    expect(decryptSecret(encryptSecret("kunci-rahsia-🔐"))).toBe(
      "kunci-rahsia-🔐",
    );
  });
});
