import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

export interface EncryptedRecord {
  ciphertext: string;
  iv: string;
  authTag: string;
}

function masterKey(): Buffer {
  const raw = process.env.AES_MASTER_KEY;
  if (!raw) throw new Error("AES_MASTER_KEY is not set");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("AES_MASTER_KEY must be 32 bytes, base64-encoded");
  }
  return key;
}

export function encryptSecret(plaintext: string): EncryptedRecord {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", masterKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(record: EncryptedRecord): string {
  const decipher = createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(record.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
