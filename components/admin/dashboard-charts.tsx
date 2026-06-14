"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatRM } from "@/lib/money";

const EMBER = "#d45c00";
const BROWN = "#7a6a5a";
const WARMGREY = "#c4b5a3";
const INK = "#1a1a1a";

export interface TimeBucket {
  label: string;
  revenueSen: number;
  profitSen: number;
  orders: number;
}

function compactRM(sen: number): string {
  const ringgit = sen / 100;
  if (Math.abs(ringgit) >= 1000) return `RM ${(ringgit / 1000).toFixed(1)}k`;
  return `RM ${ringgit.toFixed(0)}`;
}

const axisProps = {
  stroke: WARMGREY,
  tick: { fill: BROWN, fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: WARMGREY },
} as const;

function MoneyTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-warmgrey/70 bg-peach px-3 py-2 text-xs shadow-lg">
      <p className="subhead mb-1 text-ink">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="flex items-center gap-2 text-brown">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: <span className="font-bold text-ink">{formatRM(p.value)}</span>
        </p>
      ))}
    </div>
  );
}

function CountTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-warmgrey/70 bg-peach px-3 py-2 text-xs shadow-lg">
      <p className="subhead mb-0.5 text-ink">{label}</p>
      <p className="text-brown">
        <span className="font-bold text-ink">{payload[0].value}</span> orders
      </p>
    </div>
  );
}

function EmptyOverlay({ note }: { note: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <p className="rounded-full bg-sand/80 px-4 py-1.5 text-xs text-brown">{note}</p>
    </div>
  );
}

export function RevenueChart({ data }: { data: TimeBucket[] }) {
  const empty = data.every((d) => d.revenueSen === 0 && d.profitSen === 0);
  return (
    <div className="relative h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={WARMGREY} strokeOpacity={0.3} vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axisProps} width={52} tickFormatter={(v) => compactRM(Number(v))} />
          <Tooltip content={<MoneyTooltip />} cursor={{ stroke: WARMGREY, strokeDasharray: "3 3" }} />
          <Line
            type="monotone"
            dataKey="revenueSen"
            name="Revenue"
            stroke={EMBER}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: EMBER }}
          />
          <Line
            type="monotone"
            dataKey="profitSen"
            name="Profit"
            stroke={BROWN}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={{ r: 4, fill: BROWN }}
          />
        </LineChart>
      </ResponsiveContainer>
      {empty && <EmptyOverlay note="No sales yet — your first order will show here" />}
    </div>
  );
}

export function OrdersChart({ data }: { data: TimeBucket[] }) {
  const empty = data.every((d) => d.orders === 0);
  return (
    <div className="relative h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
          <CartesianGrid stroke={WARMGREY} strokeOpacity={0.3} vertical={false} />
          <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={16} />
          <YAxis {...axisProps} width={28} allowDecimals={false} />
          <Tooltip content={<CountTooltip />} cursor={{ fill: WARMGREY, fillOpacity: 0.15 }} />
          <Bar dataKey="orders" name="Orders" fill={INK} radius={[3, 3, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
      {empty && <EmptyOverlay note="No orders in this range yet" />}
    </div>
  );
}
