import type { DiscountCode } from "@prisma/client";
import { prisma } from "@/lib/db";
import { generateCampaignCode, generateCode } from "@/lib/promoCode";
import { getSetting } from "@/lib/settings";

// One first-purchase code per email, at the admin-configured percentage.
// Returns the code plus `isNew` — true only the first time it's issued — so the
// welcome email fires exactly once per email, whichever trigger (signup or
// popup) gets there first.
export async function issueCodeForEmail(
  email: string,
  source: "popup" | "signup",
): Promise<{ record: DiscountCode; isNew: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await prisma.discountCode.findFirst({
    where: { issuedEmail: normalized },
  });
  if (existing) return { record: existing, isNew: false };
  const percentage = await getSetting("emailPopupPercentage");
  const record = await prisma.discountCode.create({
    data: {
      code: generateCode(),
      issuedEmail: normalized,
      percentage,
      source,
    },
  });
  return { record, isNew: true };
}

export const MAX_BATCH_CODES = 5000;

// Generate a batch of single-use campaign/influencer codes (prefix + random,
// unique). Either a percentage or a fixed sen amount; open to anyone.
export async function generateCampaignBatch(input: {
  label: string;
  prefix: string;
  count: number;
  percentage?: number;
  amountOffSen?: number | null;
  expiresAt?: Date | null;
}): Promise<number> {
  const target = Math.max(1, Math.min(MAX_BATCH_CODES, Math.floor(input.count)));
  const isFixed = (input.amountOffSen ?? 0) > 0;
  let created = 0;
  let remaining = target;

  // Loop so any code that collides with an existing one (astronomically rare)
  // is regenerated until the requested count is actually created.
  while (remaining > 0) {
    const codes = new Set<string>();
    while (codes.size < remaining) codes.add(generateCampaignCode(input.prefix));
    const result = await prisma.discountCode.createMany({
      data: [...codes].map((code) => ({
        code,
        issuedEmail: null,
        percentage: isFixed ? 0 : (input.percentage ?? 0),
        amountOffSen: isFixed ? input.amountOffSen : null,
        source: "campaign" as const,
        batchLabel: input.label.trim(),
        expiresAt: input.expiresAt ?? null,
      })),
      skipDuplicates: true,
    });
    created += result.count;
    remaining -= result.count;
    if (result.count === 0) break; // safety: avoid an infinite loop
  }
  return created;
}

// Edit every code in a campaign batch at once: rename the batch, change the
// discount, and/or change the expiry. Past orders keep their own recorded
// discount, so re-pricing a used code doesn't rewrite history.
export async function updateCampaignBatch(input: {
  label: string;
  newLabel?: string;
  percentage?: number;
  amountOffSen?: number | null;
  expiresAt?: Date | null;
}): Promise<number> {
  const data: Record<string, unknown> = {};
  if (input.newLabel !== undefined) data.batchLabel = input.newLabel.trim();
  if (input.percentage !== undefined) data.percentage = input.percentage;
  if (input.amountOffSen !== undefined) data.amountOffSen = input.amountOffSen;
  if (input.expiresAt !== undefined) data.expiresAt = input.expiresAt;
  const res = await prisma.discountCode.updateMany({
    where: { source: "campaign", batchLabel: input.label },
    data,
  });
  return res.count;
}

// Delete an entire campaign batch and all its codes. Orders that redeemed a
// code keep their snapshot (the FK is set null), so order history survives.
export async function deleteCampaignBatch(label: string): Promise<number> {
  const res = await prisma.discountCode.deleteMany({
    where: { source: "campaign", batchLabel: label },
  });
  return res.count;
}
