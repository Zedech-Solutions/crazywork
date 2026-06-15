import { config } from "dotenv";
config({ path: ".env" });

import { PrismaClient } from "@prisma/client";

// Superadmin-only seed — creates the single admin user from SUPERADMIN_EMAIL/
// SUPERADMIN_PASSWORD and nothing else (no demo catalog/content). Safe to run
// against production. Idempotent: skips if the user already exists, never
// resets the password (rotate that from Admin → Settings → Change password).
const prisma = new PrismaClient();

async function main() {
  const email = process.env.SUPERADMIN_EMAIL;
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.error("✗ SUPERADMIN_EMAIL/_PASSWORD not set — aborting.");
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== "superadmin") {
      await prisma.user.update({ where: { email }, data: { role: "superadmin" } });
      console.log(`✓ promoted existing user to superadmin (${email})`);
    } else {
      console.log(`✓ superadmin already exists (${email}) — no change`);
    }
    return;
  }

  // Better Auth hashes the password; the plaintext is never stored.
  const { auth } = await import("../lib/auth");
  await auth.api.signUpEmail({
    body: { email, password, name: "CRAZYWORK Owner" },
  });
  await prisma.user.update({
    where: { email },
    data: { role: "superadmin", emailVerified: true },
  });
  console.log(`✓ superadmin created (${email})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
