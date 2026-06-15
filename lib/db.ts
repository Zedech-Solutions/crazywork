import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Options for interactive ($transaction(async tx => …)) transactions. The
// default 5s limit is easily exceeded by our multi-statement writes (per-variant
// / per-item loops) under serverless + Neon pooler latency, which surfaces as
// "Transaction not found … refers to an old closed transaction". Give them room.
export const TX_OPTS = { maxWait: 15_000, timeout: 30_000 } as const;
