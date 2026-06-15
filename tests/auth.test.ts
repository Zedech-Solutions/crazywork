import { afterAll, describe, expect, test } from "vitest";
import { auth } from "@/lib/auth";
import { getSuperadminSession } from "@/lib/admin-guard";
import { issueCodeForEmail } from "@/lib/codes";
import { prisma } from "@/lib/db";

// Integration tests — require the docker-compose Postgres (npm run docker / migrate).

const RUN = `authspec-${Date.now()}`;
const emailFor = (name: string) => `${RUN}-${name}@example.com`;
const PASSWORD = "str0ng-password!";

async function signUp(email: string, extraBody: Record<string, unknown> = {}) {
  return auth.api.signUpEmail({
    body: { email, password: PASSWORD, name: "Test User", ...extraBody },
  });
}

async function sessionHeadersFor(email: string): Promise<Headers> {
  const response = await auth.api.signInEmail({
    body: { email, password: PASSWORD },
    asResponse: true,
  });
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("no session cookie issued");
  return new Headers({ cookie });
}

afterAll(async () => {
  await prisma.discountCode.deleteMany({
    where: { issuedEmail: { startsWith: RUN } },
  });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN } } });
});

describe("signup role safeguard", () => {
  test("a plain signup gets the customer role", async () => {
    const email = emailFor("plain");
    await signUp(email);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.role).toBe("customer");
  });

  test("role is not self-assignable — injected role is ignored or rejected", async () => {
    const email = emailFor("injector");
    try {
      await signUp(email, { role: "superadmin" });
    } catch {
      // an outright rejection of the role field also satisfies the safeguard
    }
    const user = await prisma.user.findUnique({ where: { email } });
    // either the signup was refused (no user) or the role was forced to customer
    expect(user?.role ?? "customer").toBe("customer");
  });
});

describe("welcome promo code on signup", () => {
  test("signup issues a 10% code locked to the email", async () => {
    const email = emailFor("welcome");
    await signUp(email);
    const code = await prisma.discountCode.findFirst({
      where: { issuedEmail: email },
    });
    expect(code).not.toBeNull();
    expect(code?.percentage).toBe(10);
    expect(code?.code).toMatch(/^CRAZY/);
  });

  test("one code per email — reissue returns the same code, isNew only once", async () => {
    const email = emailFor("reuse");
    const first = await issueCodeForEmail(email, "popup");
    const second = await issueCodeForEmail(email, "signup");
    expect(second.record.id).toBe(first.record.id);
    expect(second.record.code).toBe(first.record.code);
    // isNew is true only the first time → the welcome email fires exactly once.
    expect(first.isNew).toBe(true);
    expect(second.isNew).toBe(false);
  });
});

describe("superadmin guard", () => {
  test("rejects anonymous requests", async () => {
    expect(await getSuperadminSession(new Headers())).toBeNull();
  });

  test("rejects a customer session", async () => {
    const email = emailFor("customer");
    await signUp(email);
    const headers = await sessionHeadersFor(email);
    expect(await getSuperadminSession(headers)).toBeNull();
  });

  test("accepts a superadmin session", async () => {
    const email = emailFor("admin");
    await signUp(email);
    await prisma.user.update({
      where: { email },
      data: { role: "superadmin" },
    });
    const headers = await sessionHeadersFor(email);
    const session = await getSuperadminSession(headers);
    expect(session?.user.email).toBe(email);
  });
});
