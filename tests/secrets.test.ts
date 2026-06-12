import { afterAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib/db";
import {
  bootSecretStatuses,
  deleteSecret,
  getSecret,
  getSecretHint,
  setSecret,
} from "@/lib/secrets";

// Integration tests — require the docker-compose Postgres.

afterAll(async () => {
  await deleteSecret("stripe_secret_key");
});

describe("encrypted secrets store", () => {
  test("set → get round-trips through AES-256-GCM in the DB", async () => {
    await setSecret("stripe_secret_key", "sk_test_abc123xyz789");
    expect(await getSecret("stripe_secret_key")).toBe("sk_test_abc123xyz789");
  });

  test("the database row never contains the plaintext", async () => {
    await setSecret("stripe_secret_key", "sk_test_abc123xyz789");
    const row = await prisma.encryptedSecret.findUnique({
      where: { key: "stripe_secret_key" },
    });
    expect(row?.ciphertext).not.toContain("sk_test");
    expect(row?.iv).toBeTruthy();
    expect(row?.authTag).toBeTruthy();
  });

  test("admin hint is masked to the last 4 characters", async () => {
    await setSecret("stripe_secret_key", "sk_test_abc123xyz789");
    expect(await getSecretHint("stripe_secret_key")).toBe("••••z789");
  });

  test("missing secret reads as null (stubs no-op gracefully)", async () => {
    await deleteSecret("stripe_secret_key");
    expect(await getSecret("stripe_secret_key")).toBeNull();
  });

  test("boot secret panel exposes status only, never values", () => {
    const statuses = bootSecretStatuses();
    const dbUrl = statuses.find((s) => s.key === "DATABASE_URL");
    expect(dbUrl?.configured).toBe(true);
    expect(Object.keys(dbUrl!)).toEqual(["key", "configured"]);
  });
});
