import { prisma } from "@/lib/db";
import { generateCode } from "@/lib/promoCode";

// One 10% first-purchase code per email, reused if already issued.
export async function issueCodeForEmail(
  email: string,
  source: "popup" | "signup",
) {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.discountCode.findFirst({
    where: { issuedEmail: normalized },
  });
  if (existing) return existing;
  return prisma.discountCode.create({
    data: {
      code: generateCode(),
      issuedEmail: normalized,
      percentage: 10,
      source,
    },
  });
}
