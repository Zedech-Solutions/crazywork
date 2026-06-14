import { describe, expect, test } from "vitest";
import { storageFromEnv, R2Storage } from "@/lib/integrations/storage";

const FULL_ENV = {
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET: "bucket",
  R2_PUBLIC_BASE_URL: "https://cdn.example.com",
};

const R2ENV = {
  accountId: "acct",
  accessKeyId: "key",
  secretAccessKey: "secret",
  bucket: "bucket",
  publicUrl: "https://cdn.example.com",
};

function fakeClient() {
  const calls: { name: string; input: Record<string, unknown> }[] = [];
  return {
    calls,
    send: async (cmd: { constructor: { name: string }; input: Record<string, unknown> }) => {
      calls.push({ name: cmd.constructor.name, input: cmd.input });
      return {};
    },
  };
}

describe("R2Storage", () => {
  test("upload puts under uploads/ prefix and returns the public URL", async () => {
    const client = fakeClient();
    const s = new R2Storage(R2ENV, client as never);
    const { url } = await s.upload({
      name: "shirt.png",
      contentType: "image/png",
      bytes: Buffer.from("x"),
    });
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].name).toBe("PutObjectCommand");
    expect(client.calls[0].input.Bucket).toBe("bucket");
    expect(String(client.calls[0].input.Key)).toMatch(/^uploads\/.*\.png$/);
    expect(client.calls[0].input.ContentType).toBe("image/png");
    expect(url).toBe(`https://cdn.example.com/${client.calls[0].input.Key}`);
  });

  test("delete removes the object whose URL is under the public base", async () => {
    const client = fakeClient();
    const s = new R2Storage(R2ENV, client as never);
    await s.delete("https://cdn.example.com/uploads/123-abc.png");
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0].name).toBe("DeleteObjectCommand");
    expect(client.calls[0].input.Bucket).toBe("bucket");
    expect(client.calls[0].input.Key).toBe("uploads/123-abc.png");
  });

  test("delete ignores externally-hosted or stale URLs (no S3 call)", async () => {
    const client = fakeClient();
    const s = new R2Storage(R2ENV, client as never);
    await s.delete("https://instagram.com/p/abc/thumb.jpg");
    await s.delete("/uploads/old-stub-file.png");
    await s.delete("https://cdn.example.com"); // base only, no key
    expect(client.calls).toHaveLength(0);
  });
});

describe("storageFromEnv", () => {
  test("builds R2Storage when all five R2_* vars are present", () => {
    expect(storageFromEnv(FULL_ENV)).toBeInstanceOf(R2Storage);
  });

  test("throws when any R2_* var is missing (no local fallback)", () => {
    for (const key of Object.keys(FULL_ENV)) {
      const partial = { ...FULL_ENV, [key]: undefined };
      expect(() => storageFromEnv(partial)).toThrow(/Missing required R2 env/);
    }
  });
});
