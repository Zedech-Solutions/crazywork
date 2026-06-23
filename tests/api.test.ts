import { afterAll, describe, expect, test } from "vitest";
import { app } from "@/server/app";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// API integration tests — require the docker-compose Postgres.

const RUN = `apispec-${Date.now()}`;
const PASSWORD = "str0ng-password!";

async function signedInHeaders(email: string, role?: "superadmin") {
  await auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: "API Test" },
  });
  if (role) {
    await prisma.user.update({ where: { email }, data: { role } });
  }
  const response = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  return { cookie: response.headers.get("set-cookie") ?? "" };
}

afterAll(async () => {
  await prisma.discountCode.deleteMany({
    where: { issuedEmail: { contains: RUN } },
  });
  await prisma.discountCode.deleteMany({
    where: { batchLabel: { contains: RUN } },
  });
  await prisma.emailSubscriber.deleteMany({
    where: { email: { contains: RUN } },
  });
  await prisma.user.deleteMany({ where: { email: { contains: RUN } } });
});

describe("/api/admin/* guard", () => {
  test("anonymous requests are rejected", async () => {
    const res = await app.request("/api/admin/stats");
    expect(res.status).toBe(403);
  });

  test("customer sessions are rejected on every admin resource", async () => {
    const headers = await signedInHeaders(`${RUN}-cust@example.com`);
    for (const path of [
      "/api/admin/stats",
      "/api/admin/products",
      "/api/admin/orders",
      "/api/admin/campaigns",
      "/api/admin/secrets",
      "/api/admin/settings",
    ]) {
      const res = await app.request(path, { headers });
      expect(res.status, path).toBe(403);
    }
  });

  test("superadmin sessions are accepted", async () => {
    const headers = await signedInHeaders(
      `${RUN}-admin@example.com`,
      "superadmin",
    );
    const res = await app.request("/api/admin/stats", { headers });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.orders).toBe("number");
  });
});

describe("admin shared codes", () => {
  test("creates a shared code and lists it with quota + overage", async () => {
    const headers = await signedInHeaders(
      `${RUN}-shareadmin@example.com`,
      "superadmin",
    );
    const code = `SHARE${RUN.replace(/\D/g, "")}`;

    const create = await app.request("/api/admin/shared-codes", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({
        code,
        label: `${RUN}-share`,
        quota: 25,
        discountType: "percent",
        value: 15,
      }),
    });
    expect(create.status).toBe(200);
    const created = await create.json();
    expect(created.ok).toBe(true);

    const list = await app.request("/api/admin/shared-codes", { headers });
    const body = await list.json();
    const row = body.codes.find((r: { code: string }) => r.code === code);
    expect(row).toMatchObject({
      code,
      quota: 25,
      redeemed: 0,
      over: 0,
      percentage: 15,
    });

    const del = await app.request(`/api/admin/shared-codes/${created.id}`, {
      method: "DELETE",
      headers,
    });
    expect(del.status).toBe(200);
  });
});

describe("/api/subscribe (email popup)", () => {
  test("captures the email and returns a reusable 10% code", async () => {
    const email = `${RUN}-popup@example.com`;
    const first = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(first.status).toBe(200);
    const firstBody = await first.json();
    expect(firstBody.code).toMatch(/^CRAZY/);
    expect(firstBody.percentage).toBe(10);

    const second = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const secondBody = await second.json();
    expect(secondBody.code).toBe(firstBody.code);
  });

  test("rejects an invalid email", async () => {
    const res = await app.request("/api/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "not-an-email" }),
    });
    expect(res.status).toBe(400);
  });
});
