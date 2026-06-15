// Server-side discount/campaign evaluator. All amounts in integer sen.
// Best-single-wins: every applicable campaign and the promo code are computed,
// then only the largest is applied (ties between campaigns broken by priority).
// free_shipping_over campaigns are a separate track: they zero the shipping
// fee instead of competing with item discounts.

export type CampaignType =
  | "quantity_tier"
  | "cart_total_tier"
  | "buy_x_get_y"
  | "free_shipping_over";

export interface CampaignInput {
  id: string;
  name: string;
  type: CampaignType;
  rules: unknown;
  active: boolean;
  startAt?: Date | string | null;
  endAt?: Date | string | null;
  priority: number;
  stacksWithCodes: boolean;
}

export interface CartLine {
  unitPrice: number; // sen
  quantity: number;
}

export interface PromoCodeInput {
  code: string;
  percentage: number;
  amountOffSen?: number | null; // fixed discount in sen; overrides percentage
}

export interface AppliedDiscount {
  label: string;
  amount: number;
  source: "campaign" | "code";
}

export interface PricingResult {
  subtotal: number;
  discountAmount: number; // total across all applied discounts
  discountLabel: string | null; // combined label (e.g. "Member 10% + SAVE20")
  discountSource: "campaign" | "code" | null;
  discounts: AppliedDiscount[]; // breakdown — list each in the summary
  shippingFee: number;
  freeShippingApplied: boolean;
  total: number;
}

interface Tier {
  percent: number;
}
interface QuantityTier extends Tier {
  minQty: number;
}
interface SubtotalTier extends Tier {
  minSubtotal: number;
}

function isWithinWindow(campaign: CampaignInput, now: Date): boolean {
  if (!campaign.active) return false;
  if (campaign.startAt && now < new Date(campaign.startAt)) return false;
  if (campaign.endAt && now > new Date(campaign.endAt)) return false;
  return true;
}

function bestTierPercent<T extends Tier>(
  tiers: T[],
  qualifies: (tier: T) => boolean,
): number {
  return tiers.reduce(
    (best, tier) => (qualifies(tier) && tier.percent > best ? tier.percent : best),
    0,
  );
}

function campaignDiscount(
  campaign: CampaignInput,
  subtotal: number,
  itemCount: number,
): number {
  const rules = campaign.rules as Record<string, unknown>;
  let percent = 0;
  switch (campaign.type) {
    case "quantity_tier":
      percent = bestTierPercent(
        (rules.tiers as QuantityTier[]) ?? [],
        (t) => itemCount >= t.minQty,
      );
      break;
    case "cart_total_tier":
      percent = bestTierPercent(
        (rules.tiers as SubtotalTier[]) ?? [],
        (t) => subtotal >= t.minSubtotal,
      );
      break;
    case "buy_x_get_y": {
      const { buyQty, percent: p } = rules as { buyQty: number; percent: number };
      percent = itemCount >= buyQty ? p : 0;
      break;
    }
    case "free_shipping_over":
      return 0; // handled on the shipping track
  }
  return Math.round((subtotal * percent) / 100);
}

export function evaluateCart(input: {
  items: CartLine[];
  campaigns: CampaignInput[];
  code?: PromoCodeInput | null;
  shippingFee: number;
  now?: Date;
}): PricingResult {
  const now = input.now ?? new Date();
  const subtotal = input.items.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0,
  );
  const itemCount = input.items.reduce((sum, line) => sum + line.quantity, 0);
  const live = input.campaigns.filter((c) => isWithinWindow(c, now));

  // Track 1 — item discounts. Pick the best single campaign; the code is a
  // separate discount. They stack only when that campaign allows it.
  let bestCampaign: {
    amount: number;
    label: string;
    priority: number;
    stacks: boolean;
  } | null = null;
  let codeDiscount: { amount: number; label: string } | null = null;

  if (subtotal > 0) {
    for (const campaign of live) {
      const amount = campaignDiscount(campaign, subtotal, itemCount);
      if (amount <= 0) continue;
      if (
        !bestCampaign ||
        amount > bestCampaign.amount ||
        (amount === bestCampaign.amount && campaign.priority > bestCampaign.priority)
      ) {
        bestCampaign = {
          amount,
          label: campaign.name,
          priority: campaign.priority,
          stacks: campaign.stacksWithCodes,
        };
      }
    }
    if (input.code) {
      // Fixed-amount codes discount a flat sen value; otherwise a percentage.
      const codeAmount =
        input.code.amountOffSen != null && input.code.amountOffSen > 0
          ? Math.min(input.code.amountOffSen, subtotal)
          : Math.round((subtotal * input.code.percentage) / 100);
      if (codeAmount > 0) {
        codeDiscount = { amount: codeAmount, label: input.code.code };
      }
    }
  }

  const discounts: AppliedDiscount[] = [];
  if (bestCampaign && codeDiscount && bestCampaign.stacks) {
    // Stack both — list each line.
    discounts.push({
      label: bestCampaign.label,
      amount: bestCampaign.amount,
      source: "campaign",
    });
    discounts.push({ label: codeDiscount.label, amount: codeDiscount.amount, source: "code" });
  } else {
    // Best-single-wins between the best campaign and the code.
    const campaignAmt = bestCampaign?.amount ?? 0;
    const codeAmt = codeDiscount?.amount ?? 0;
    if (campaignAmt > 0 && campaignAmt >= codeAmt) {
      discounts.push({ label: bestCampaign!.label, amount: campaignAmt, source: "campaign" });
    } else if (codeAmt > 0) {
      discounts.push({ label: codeDiscount!.label, amount: codeAmt, source: "code" });
    }
  }

  // Cap the combined discount at the subtotal (shrink the last line if needed).
  let discountAmount = discounts.reduce((s, d) => s + d.amount, 0);
  if (discountAmount > subtotal && discounts.length) {
    const last = discounts[discounts.length - 1];
    last.amount = Math.max(0, last.amount - (discountAmount - subtotal));
    discountAmount = subtotal;
  }

  // Track 2 — free shipping waiver.
  const freeShippingApplied = live.some((campaign) => {
    if (campaign.type !== "free_shipping_over") return false;
    const { minSubtotal } = campaign.rules as { minSubtotal: number };
    return subtotal >= minSubtotal;
  });
  const shippingFee = freeShippingApplied ? 0 : input.shippingFee;

  return {
    subtotal,
    discountAmount,
    discountLabel: discounts.length
      ? discounts.map((d) => d.label).join(" + ")
      : null,
    discountSource: discounts[0]?.source ?? null,
    discounts,
    shippingFee,
    freeShippingApplied,
    total: subtotal - discountAmount + shippingFee,
  };
}

/**
 * Upsell helper: distance to the next better quantity/cart-total tier.
 * Used by the pre-checkout popup ("Add {n} more and save {percent}%").
 */
export function nextTierGap(input: {
  items: CartLine[];
  campaigns: CampaignInput[];
  now?: Date;
}): { itemsAway?: number; amountAway?: number; percent: number } | null {
  const now = input.now ?? new Date();
  const subtotal = input.items.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = input.items.reduce((s, l) => s + l.quantity, 0);
  if (itemCount === 0) return null;

  // "Next tier" = the NEAREST reachable tier (add 1 more…), not the biggest
  // percent — ties on distance break toward the higher percent.
  let best: { itemsAway?: number; amountAway?: number; percent: number } | null =
    null;
  const distance = (gap: { itemsAway?: number; amountAway?: number }) =>
    gap.itemsAway ?? (gap.amountAway ?? Infinity) / 5000;
  const consider = (candidate: {
    itemsAway?: number;
    amountAway?: number;
    percent: number;
  }) => {
    if (
      !best ||
      distance(candidate) < distance(best) ||
      (distance(candidate) === distance(best) && candidate.percent > best.percent)
    ) {
      best = candidate;
    }
  };
  for (const campaign of input.campaigns.filter((c) => isWithinWindow(c, now))) {
    const rules = campaign.rules as Record<string, unknown>;
    if (campaign.type === "quantity_tier") {
      for (const tier of (rules.tiers as QuantityTier[]) ?? []) {
        const away = tier.minQty - itemCount;
        if (away >= 1 && away <= 2) consider({ itemsAway: away, percent: tier.percent });
      }
    }
    if (campaign.type === "cart_total_tier") {
      for (const tier of (rules.tiers as SubtotalTier[]) ?? []) {
        const away = tier.minSubtotal - subtotal;
        // within an RM50 gap of the next subtotal tier
        if (away > 0 && away <= 5000) consider({ amountAway: away, percent: tier.percent });
      }
    }
  }
  return best;
}
