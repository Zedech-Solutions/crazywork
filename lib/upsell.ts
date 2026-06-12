import { formatRM } from "@/lib/money";

export interface UpsellGap {
  itemsAway?: number;
  amountAway?: number;
  percent: number;
}

// Template slots: {n} → items away (or RM gap), {percent} → discount percent.
export function renderUpsellMessage(template: string, gap: UpsellGap): string {
  const n =
    gap.itemsAway != null ? String(gap.itemsAway) : formatRM(gap.amountAway ?? 0);
  return template
    .replaceAll("{n}", n)
    .replaceAll("{percent}", String(gap.percent));
}
