import "dotenv/config";
import { prisma } from "@/lib/db";

// FORCE-reset the superadmin to the SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD in
// .env. Unlike db:seed:admin (idempotent), this OVERWRITES: it removes any
// existing superadmin and any user already on the target email, then recreates
// a fresh superadmin with those credentials. Use to change the admin login.
async function main() {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.error("✗ Set SUPERADMIN_EMAIL and SUPERADMIN_PASSWORD in .env first.");
    process.exit(1);
  }

  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split(".")[0];
  console.log(`Target DB: ${host}`);

  const removed = await prisma.user.deleteMany({
    where: { OR: [{ role: "superadmin" }, { email }] },
  });
  console.log(`Removed ${removed.count} existing admin/conflicting user(s).`);

  const { auth } = await import("../lib/auth");
  await auth.api.signUpEmail({
    body: { email, password, name: "CRAZYWORK Owner" },
  });
  await prisma.user.update({
    where: { email },
    data: { role: "superadmin", emailVerified: true },
  });
  console.log(`✓ Superadmin reset to ${email}. Log in with this email + the .env password.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
