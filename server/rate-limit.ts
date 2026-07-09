import type { Context, MiddlewareHandler } from "hono";
import { prisma } from "@/lib/db";

export interface RateLimitOptions {
  key: string;
  max: number;
  windowSec: number;
}

/**
 * Hono middleware factory that rate-limits requests using the existing
 * better-auth RateLimit Prisma model.
 *
 * Caller identity = first value of x-forwarded-for, fallback x-real-ip,
 * fallback "unknown".
 *
 * The RateLimit row key is `${opts.key}:${ip}`.
 * lastRequest is stored as epoch milliseconds (matches better-auth semantics).
 *
 * Approximate limiting: we do a read-then-update which is not strictly atomic.
 * Under very high concurrency two requests may both pass just at the boundary,
 * but this is acceptable for our use case.
 *
 * Storage errors NEVER produce a 500 — the middleware fails open (logs a
 * warning and calls next()).
 */
export function rateLimit(opts: RateLimitOptions): MiddlewareHandler {
  const { key, max, windowSec } = opts;
  const windowMs = windowSec * 1000;

  return async (c: Context, next) => {
    const ip = getIp(c);
    const rowKey = `${key}:${ip}`;

    let limited = false;
    try {
      const now = Date.now();
      const windowStart = BigInt(now - windowMs);

      // Read current state
      const row = await prisma.rateLimit.findUnique({ where: { key: rowKey } });

      if (!row || row.lastRequest === null || row.lastRequest < windowStart) {
        // No record or window has expired — create/reset to count=1
        await prisma.rateLimit.upsert({
          where: { key: rowKey },
          create: { key: rowKey, count: 1, lastRequest: BigInt(now) },
          update: { count: 1, lastRequest: BigInt(now) },
        });
        // count is now 1, which is ≤ max (max is always ≥ 1); fall through
      } else {
        // Within the current window
        const currentCount = row.count ?? 0;
        if (currentCount >= max) {
          limited = true;
        } else {
          // Increment counter
          await prisma.rateLimit.update({
            where: { key: rowKey },
            data: { count: { increment: 1 } },
          });
        }
      }
    } catch (err) {
      // Fail open — a storage error must never block the request
      console.warn("[rate-limit] storage error, failing open:", err);
    }

    if (limited) return c.json({ error: "Too many requests" }, 429);
    return next();
  };
}

function getIp(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = c.req.header("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
