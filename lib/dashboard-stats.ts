// Pure dashboard aggregation — bucketing + top-products. No Prisma/IO here so it
// stays trivially testable. Callers pass already paid-filtered orders in `sen`.

export type DashRange = "7d" | "30d" | "90d" | "12mo";

export interface OrderItemInput {
  productId: string;
  productName: string;
  unitPriceSen: number;
  costPriceSen: number | null;
  quantity: number;
}

export interface OrderInput {
  placedAt: Date;
  totalSen: number;
  subtotalSen: number;
  discountSen: number;
  items: OrderItemInput[];
}

export interface TimeBucket {
  label: string;
  revenueSen: number;
  profitSen: number;
  orders: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  revenueSen: number;
  units: number;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function addDaysUTC(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
function startOfMonthUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addMonthsUTC(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

interface BucketSpec {
  start: Date;
  end: Date; // exclusive
  label: string;
}

function bucketSpecs(range: DashRange, now: Date): BucketSpec[] {
  const specs: BucketSpec[] = [];
  if (range === "7d" || range === "30d") {
    const days = range === "7d" ? 7 : 30;
    const today = startOfDayUTC(now);
    for (let i = days - 1; i >= 0; i--) {
      const start = addDaysUTC(today, -i);
      specs.push({ start, end: addDaysUTC(start, 1), label: `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}` });
    }
  } else if (range === "90d") {
    const tomorrow = addDaysUTC(startOfDayUTC(now), 1); // exclusive upper bound
    for (let i = 12; i >= 0; i--) {
      const end = addDaysUTC(tomorrow, -i * 7);
      const start = addDaysUTC(end, -7);
      specs.push({ start, end, label: `${start.getUTCDate()} ${MONTHS[start.getUTCMonth()]}` });
    }
  } else {
    const thisMonth = startOfMonthUTC(now);
    for (let i = 11; i >= 0; i--) {
      const start = addMonthsUTC(thisMonth, -i);
      specs.push({ start, end: addMonthsUTC(start, 1), label: MONTHS[start.getUTCMonth()] });
    }
  }
  return specs;
}

function orderProfitSen(o: OrderInput): number {
  const cogs = o.items.reduce((s, it) => s + (it.costPriceSen ?? 0) * it.quantity, 0);
  return o.subtotalSen - o.discountSen - cogs;
}

export function buildTimeseries(
  orders: OrderInput[],
  range: DashRange,
  now: Date,
): TimeBucket[] {
  const specs = bucketSpecs(range, now);
  const buckets: TimeBucket[] = specs.map((s) => ({
    label: s.label,
    revenueSen: 0,
    profitSen: 0,
    orders: 0,
  }));
  for (const o of orders) {
    const t = o.placedAt.getTime();
    const idx = specs.findIndex((s) => t >= s.start.getTime() && t < s.end.getTime());
    if (idx === -1) continue;
    buckets[idx].revenueSen += o.totalSen;
    buckets[idx].profitSen += orderProfitSen(o);
    buckets[idx].orders += 1;
  }
  return buckets;
}

export function topProducts(
  orders: OrderInput[],
  range: DashRange,
  now: Date,
  limit = 5,
): TopProduct[] {
  const specs = bucketSpecs(range, now);
  const windowStart = specs[0].start.getTime();
  const windowEnd = specs[specs.length - 1].end.getTime();
  const acc = new Map<string, TopProduct>();
  for (const o of orders) {
    const t = o.placedAt.getTime();
    if (t < windowStart || t >= windowEnd) continue;
    for (const it of o.items) {
      const cur = acc.get(it.productId) ?? {
        productId: it.productId,
        name: it.productName,
        revenueSen: 0,
        units: 0,
      };
      cur.revenueSen += it.unitPriceSen * it.quantity;
      cur.units += it.quantity;
      acc.set(it.productId, cur);
    }
  }
  return [...acc.values()]
    .sort((a, b) => b.revenueSen - a.revenueSen)
    .slice(0, limit);
}
