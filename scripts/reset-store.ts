import "dotenv/config";
import { prisma } from "@/lib/db";

// FRESH-LAUNCH reset — wipes all store/customer/content data so you can build
// real products from scratch. KEEPS: superadmin login, site settings, and the
// encrypted integration keys (Resend / Stripe / Discord). Irreversible.
async function main() {
  const host = (process.env.DATABASE_URL ?? "").split("@")[1]?.split(".")[0];
  console.log(`Target DB: ${host}\n`);

  const before = {
    users: await prisma.user.count(),
    products: await prisma.product.count(),
    orders: await prisma.order.count(),
    campaigns: await prisma.campaign.count(),
    codes: await prisma.discountCode.count(),
    settings: await prisma.siteSetting.count(),
    secrets: await prisma.encryptedSecret.count(),
  };
  console.log("Before:", JSON.stringify(before));

  // Order matters for FK safety: children/dependents first.
  await prisma.order.deleteMany({}); // cascades OrderItem
  await prisma.product.deleteMany({}); // cascades ProductVariant + ProductImage
  await prisma.drop.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.discountCode.deleteMany({});
  await prisma.emailSubscriber.deleteMany({});
  await prisma.contentPost.deleteMany({}); // cascades ContentBlock
  await prisma.communityPhoto.deleteMany({});
  await prisma.faq.deleteMany({});
  await prisma.wishlistItem.deleteMany({});
  await prisma.verification.deleteMany({}); // transient auth tokens
  // Customers last (cascades their Account/Session); superadmin is preserved.
  const customers = await prisma.user.deleteMany({
    where: { role: { not: "superadmin" } },
  });

  console.log(`\nDeleted all store/customer/content data (${customers.count} customers removed).`);

  const after = {
    users: await prisma.user.count(),
    superadmins: await prisma.user.count({ where: { role: "superadmin" } }),
    products: await prisma.product.count(),
    orders: await prisma.order.count(),
    settings: await prisma.siteSetting.count(),
    secrets: await prisma.encryptedSecret.count(),
  };
  console.log("After:", JSON.stringify(after));
  console.log(
    after.superadmins >= 1 && after.secrets >= 1
      ? "\n✓ Kept superadmin, settings + integration keys. Store is launch-clean."
      : "\n⚠ Check: superadmin or integration keys missing.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
