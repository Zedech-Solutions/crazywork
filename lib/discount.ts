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
}

export interface PricingResult {
  subtotal: number;
  discountAmount: number;
  discountLabel: string | null;
  discountSource: "campaign" | "code" | null;
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

  // Track 1 — item discounts: best single among campaigns and the code.
  type Candidate = {
    amount: number;
    label: string;
    source: "campaign" | "code";
    priority: number;
  };
  const candidates: Candidate[] = [];
  if (subtotal > 0) {
    for (const campaign of live) {
      const amount = campaignDiscount(campaign, subtotal, itemCount);
      if (amount > 0) {
        candidates.push({
          amount,
          label: campaign.name,
          source: "campaign",
          priority: campaign.priority,
        });
      }
    }
    if (input.code && input.code.percentage > 0) {
      candidates.push({
        amount: Math.round((subtotal * input.code.percentage) / 100),
        label: input.code.code,
        source: "code",
        priority: Number.NEGATIVE_INFINITY,
      });
    }
  }
  const best = candidates.reduce<Candidate | null>((winner, candidate) => {
    if (!winner) return candidate;
    if (candidate.amount > winner.amount) return candidate;
    if (candidate.amount === winner.amount && candidate.priority > winner.priority)
      return candidate;
    return winner;
  }, null);

  // Track 2 — free shipping waiver.
  const freeShippingApplied = live.some((campaign) => {
    if (campaign.type !== "free_shipping_over") return false;
    const { minSubtotal } = campaign.rules as { minSubtotal: number };
    return subtotal >= minSubtotal;
  });
  const shippingFee = freeShippingApplied ? 0 : input.shippingFee;

  const discountAmount = best?.amount ?? 0;
  return {
    subtotal,
    discountAmount,
    discountLabel: best?.label ?? null,
    discountSource: best?.source ?? null,
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
