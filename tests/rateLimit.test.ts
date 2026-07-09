/**
 * Unit tests for server/rate-limit.ts
 *
 * We mock @/lib/db so tests don't need a real database.
 * The fake tracks one RateLimit row per key, matching the Prisma model shape.
 */
import { beforeEach, describe, expect, test, vi } from "vitest";
import { Hono } from "hono";

// ───────────── Fake Prisma RateLimit store ─────────────

interface FakeRow {
  key: string;
  count: number | null;
  lastRequest: bigint | null;
}

// Mock declared BEFORE any imports that use it.
// The factory runs after hoisting so it must not reference outer let/const.
vi.mock("@/lib/db", () => {
  const store = new Map<string, FakeRow>();
  return {
    prisma: {
      rateLimit: {
        findUnique: vi.fn(async ({ where }: { where: { key: string } }) => {
          return store.get(where.key) ?? null;
        }),
        upsert: vi.fn(
          async ({
            where,
            create,
            update,
          }: {
            where: { key: string };
            create: FakeRow;
            update: Partial<FakeRow>;
          }) => {
            const existing = store.get(where.key);
            if (existing) {
              store.set(where.key, { ...existing, ...update });
            } else {
              store.set(where.key, create);
            }
          },
        ),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { key: string };
            data: { count: { increment: number } };
          }) => {
            const row = store.get(where.key);
            if (row) {
              row.count = (row.count ?? 0) + data.count.increment;
            }
          },
        ),
        _store: store,
      },
    },
  };
});

// Import after mock is registered
import { prisma } from "@/lib/db";
import { rateLimit } from "@/server/rate-limit";

// Typed handle to the internal store for test setup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const store = (prisma.rateLimit as any)._store as Map<string, FakeRow>;

// ───────────── Helpers ─────────────

function buildApp(key: string, max: number, windowSec: number) {
  const app = new Hono();
  app.post("/test", rateLimit({ key, max, windowSec }), (c) => c.json({ ok: true }));
  return app;
}

function req(opts: { ip?: string; realIp?: string } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (opts.ip) headers["x-forwarded-for"] = opts.ip;
  if (opts.realIp) headers["x-real-ip"] = opts.realIp;
  return new Request("http://localhost/test", { method: "POST", headers, body: "{}" });
}

// ───────────── Tests ─────────────

beforeEach(() => {
  store.clear();
  vi.mocked(prisma.rateLimit.findUnique).mockClear();
  vi.mocked(prisma.rateLimit.upsert).mockClear();
  vi.mocked(prisma.rateLimit.update).mockClear();
});

describe("rateLimit middleware", () => {
  test("allows exactly max requests within the window", async () => {
    const app = buildApp("subscribe", 3, 3600);
    for (let i = 0; i < 3; i++) {
      const res = await app.request(req({ ip: "1.2.3.4" }));
      expect(res.status, `request ${i + 1}`).toBe(200);
    }
  });

  test("returns 429 on the (max+1)th request within the same window", async () => {
    const app = buildApp("subscribe", 3, 3600);
    for (let i = 0; i < 3; i++) {
      await app.request(req({ ip: "1.2.3.4" }));
    }
    const res = await app.request(req({ ip: "1.2.3.4" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body).toEqual({ error: "Too many requests" });
  });

  test("resets the counter after the window expires", async () => {
    const app = buildApp("subscribe", 2, 3600);
    // Exhaust the limit
    await app.request(req({ ip: "5.5.5.5" }));
    await app.request(req({ ip: "5.5.5.5" }));
    // Simulate window expiry by back-dating the lastRequest
    const rowKey = "subscribe:5.5.5.5";
    const row = store.get(rowKey)!;
    row.lastRequest = BigInt(Date.now() - 3601 * 1000); // > 1 hour ago

    // Should allow again after window reset
    const res = await app.request(req({ ip: "5.5.5.5" }));
    expect(res.status).toBe(200);
  });

  test("uses x-forwarded-for (first value) for caller identity", async () => {
    const app = buildApp("checkout", 2, 60);
    // Two requests from "10.0.0.1, 10.0.0.2" and "10.0.0.1" — both count as 10.0.0.1
    await app.request(req({ ip: "10.0.0.1, 10.0.0.2" }));
    await app.request(req({ ip: "10.0.0.1" }));
    // 10.0.0.1 is now at max → 429
    const res = await app.request(req({ ip: "10.0.0.1" }));
    expect(res.status).toBe(429);
    // 10.0.0.2 used as primary IP is still fresh
    const res2 = await app.request(req({ ip: "10.0.0.2" }));
    expect(res2.status).toBe(200);
  });

  test("falls back to x-real-ip when x-forwarded-for is absent", async () => {
    const app = buildApp("notify", 1, 3600);
    await app.request(req({ realIp: "9.9.9.9" }));
    const res = await app.request(req({ realIp: "9.9.9.9" }));
    expect(res.status).toBe(429);
  });

  test("falls back to 'unknown' when no IP header is present", async () => {
    const app = buildApp("notify", 1, 3600);
    await app.request(req({}));
    const res = await app.request(req({}));
    expect(res.status).toBe(429);
    expect(store.has("notify:unknown")).toBe(true);
  });

  test("different IPs are rate-limited independently", async () => {
    const app = buildApp("checkout", 2, 60);
    // IP A exhausts its budget
    await app.request(req({ ip: "1.1.1.1" }));
    await app.request(req({ ip: "1.1.1.1" }));
    const resA = await app.request(req({ ip: "1.1.1.1" }));
    expect(resA.status).toBe(429);
    // IP B has its own fresh counter
    const resB = await app.request(req({ ip: "2.2.2.2" }));
    expect(resB.status).toBe(200);
  });

  test("fails open on storage error — returns 200 instead of 500", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const app = buildApp("checkout", 10, 60);
    // Make findUnique throw once
    vi.mocked(prisma.rateLimit.findUnique).mockRejectedValueOnce(new Error("DB is down"));

    const res = await app.request(req({ ip: "3.3.3.3" }));
    expect(res.status).toBe(200); // must NOT be 500
    expect(warnSpy).toHaveBeenCalledWith(
      "[rate-limit] storage error, failing open:",
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });

  test("downstream handler exception is NOT swallowed by the fail-open catch", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    let handlerCallCount = 0;

    // Build an app whose downstream handler throws
    const app = new Hono();
    app.post(
      "/throwing",
      rateLimit({ key: "throw-test", max: 10, windowSec: 60 }),
      (_c) => {
        handlerCallCount++;
        throw new Error("downstream boom");
      },
    );
    // Hono's default onError returns a 500 text response
    app.onError((_err, c) => c.text("Internal Server Error", 500));

    const throwReq = new Request("http://localhost/throwing", { method: "POST" });
    const res = await app.request(throwReq);

    // (a) The fail-open warn must NOT have been called — the error is downstream, not storage
    expect(warnSpy).not.toHaveBeenCalled();

    // (b) The error propagates — Hono surfaces it as a 500
    expect(res.status).toBe(500);

    // (c) The handler ran exactly once (not double-invoked)
    expect(handlerCallCount).toBe(1);

    warnSpy.mockRestore();
  });
});
