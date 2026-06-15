import "dotenv/config";
import { prisma } from "@/lib/db";

// Wipes customer/test data so signup + order flows can be re-tested from
// scratch. KEEPS the superadmin, site settings, products and campaigns.
// Deletes: non-superadmin users (cascades account/session/wishlist),
// per-customer discount codes (signup/popup), and all orders.
async function main() {
  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split(".")[0];
  console.log(`Target DB: ${host}\n`);

  const before = {
    users: await prisma.user.count(),
    superadmins: await prisma.user.count({ where: { role: "superadmin" } }),
    orders: await prisma.order.count(),
    customerCodes: await prisma.discountCode.count({
      where: { source: { in: ["signup", "popup"] } },
    }),
  };
  console.log("Before:", JSON.stringify(before));

  const orders = await prisma.order.deleteMany({});
  const codes = await prisma.discountCode.deleteMany({
    where: { source: { in: ["signup", "popup"] } },
  });
  const users = await prisma.user.deleteMany({
    where: { role: { not: "superadmin" } },
  });

  console.log(
    `\nDeleted → orders: ${orders.count}, customer codes: ${codes.count}, customers: ${users.count}`,
  );

  const after = {
    users: await prisma.user.count(),
    superadmins: await prisma.user.count({ where: { role: "superadmin" } }),
    orders: await prisma.order.count(),
  };
  console.log("After:", JSON.stringify(after));
  console.log(
    after.superadmins >= 1
      ? "\n✓ Superadmin preserved — you can still log into /admin."
      : "\n⚠ No superadmin remains — run `bun run db:seed:admin`.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
