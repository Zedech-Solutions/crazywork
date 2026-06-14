"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { adminFetch } from "@/components/admin/api";
import {
  OrdersChart,
  RevenueChart,
  type TimeBucket,
} from "@/components/admin/dashboard-charts";
import { formatRM } from "@/lib/money";

interface ActiveProduct {
  id: string;
  slug: string;
  name: string;
  image: string | null;
  basePriceSen: number;
  stock: number;
}

interface Stats {
  orders: number;
  revenueSen: number;
  profitSen: number;
  products: number;
  customers: number;
  subscribers: number;
  pendingCount: number;
  lowStock: { product: string; size: string; colour: string; stock: number }[];
  activeProducts: ActiveProduct[];
}

interface TopProduct {
  productId: string;
  name: string;
  revenueSen: number;
  units: number;
  image: string | null;
}

interface Timeseries {
  range: DashRange;
  buckets: TimeBucket[];
  topProducts: TopProduct[];
}

interface WishlistEntry {
  productId: string;
  name: string;
  image: string | null;
  count: number;
}

type DashRange = "7d" | "30d" | "90d" | "12mo";

const RANGES: { key: DashRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "12mo", label: "12 months" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<DashRange>("12mo");
  const [series, setSeries] = useState<Timeseries | null>(null);
  const [seriesLoading, setSeriesLoading] = useState(true);
  const [wishlist, setWishlist] = useState<WishlistEntry[]>([]);

  useEffect(() => {
    adminFetch<Stats>("/stats").then(setStats).catch((e) => setError(e.message));
    adminFetch<{ items: WishlistEntry[] }>("/wishlist")
      .then((r) => setWishlist(r.items))
      .catch(() => {});
  }, []);

  const loadSeries = useCallback((r: DashRange) => {
    setSeriesLoading(true);
    adminFetch<Timeseries>(`/stats/timeseries?range=${r}`)
      .then(setSeries)
      .catch((e) => setError(e.message))
      .finally(() => setSeriesLoading(false));
  }, []);

  useEffect(() => {
    loadSeries(range);
  }, [range, loadSeries]);

  if (error) return <p className="text-sm text-red-700">{error}</p>;
  if (!stats) return <p className="text-sm text-brown">Loading…</p>;

  const cards = [
    { label: "Revenue (paid)", value: formatRM(stats.revenueSen), href: "/admin/orders" },
    {
      label: "Est. profit",
      value: formatRM(stats.profitSen),
      href: "/admin/orders",
      accent: stats.profitSen < 0,
    },
    { label: "Orders", value: String(stats.orders), href: "/admin/orders" },
    {
      label: "Pending",
      value: String(stats.pendingCount),
      href: "/admin/orders",
      highlight: stats.pendingCount > 0,
    },
    { label: "Customers", value: String(stats.customers), href: "/admin/customers" },
  ];

  return (
    <div>
      <h1 className="headline text-5xl">Dashboard</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className={`rounded-xl border bg-sand/50 p-5 transition-colors hover:border-ink ${
              card.highlight ? "border-ember/60" : "border-warmgrey/60"
            }`}
          >
            <p className="eyebrow text-brown">{card.label}</p>
            <p
              className={`headline mt-2 text-4xl ${
                card.accent
                  ? "text-red-700"
                  : card.highlight
                    ? "text-ember"
                    : ""
              }`}
            >
              {card.value}
            </p>
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-warmgrey">
        Profit = paid revenue (after discounts) − product cost. Set each
        variant&apos;s cost price in the product editor for accurate margins.
      </p>

      {/* RANGE TOGGLE */}
      <div className="mt-10 flex items-center justify-between">
        <h2 className="subhead text-2xl">Sales</h2>
        <div className="flex gap-1 rounded-full border border-warmgrey/60 bg-sand/50 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                range === r.key
                  ? "bg-ink text-peach"
                  : "text-brown hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* REVENUE / PROFIT LINE */}
      <section className="mt-4 rounded-2xl border border-warmgrey/60 bg-white/50 p-5">
        <div className="mb-3 flex items-center gap-5 text-xs">
          <span className="flex items-center gap-1.5 text-brown">
            <span className="h-2.5 w-2.5 rounded-full bg-ember" /> Revenue
          </span>
          <span className="flex items-center gap-1.5 text-brown">
            <span className="h-0.5 w-4 bg-brown" /> Est. profit
          </span>
          {seriesLoading && <span className="text-warmgrey">Updating…</span>}
        </div>
        {series ? (
          <RevenueChart data={series.buckets} />
        ) : (
          <div className="h-64" />
        )}
      </section>

      {/* ORDERS + TOP PRODUCTS */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-warmgrey/60 bg-white/50 p-5">
          <h3 className="subhead text-lg">Orders</h3>
          {series ? (
            <OrdersChart data={series.buckets} />
          ) : (
            <div className="h-56" />
          )}
        </section>

        <section className="rounded-2xl border border-warmgrey/60 bg-white/50 p-5">
          <div className="flex items-end justify-between">
            <h3 className="subhead text-lg">Top products</h3>
            <Link href="/admin/products" className="eyebrow text-brown hover:text-ember">
              All →
            </Link>
          </div>
          {!series || series.topProducts.length === 0 ? (
            <p className="mt-6 text-sm text-brown">No sales in this range yet.</p>
          ) : (
            <ol className="mt-4 space-y-3">
              {series.topProducts.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3">
                  <span className="headline w-5 shrink-0 text-lg text-warmgrey">
                    {i + 1}
                  </span>
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-ink">
                    {p.image && (
                      <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="subhead truncate text-sm">{p.name}</p>
                    <p className="text-xs text-brown">{p.units} sold</p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-ink">
                    {formatRM(p.revenueSen)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      {/* MOST WISHLISTED — demand signal from account holders */}
      {wishlist.length > 0 && (
        <section className="mt-10">
          <h2 className="subhead text-2xl">Most wishlisted</h2>
          <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-3">
            {wishlist.map((w) => (
              <div
                key={w.productId}
                className="w-40 shrink-0 overflow-hidden rounded-xl border border-warmgrey/60 bg-white/50"
              >
                <div className="relative aspect-square bg-ink">
                  {w.image && (
                    <Image src={w.image} alt={w.name} fill sizes="160px" className="object-cover" />
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-ember px-2 py-0.5 text-[11px] font-bold text-peach">
                    ♥ {w.count}
                  </span>
                </div>
                <div className="p-3">
                  <p className="subhead truncate text-sm">{w.name}</p>
                  <p className="mt-0.5 text-xs text-brown">
                    {w.count} saved
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ACTIVE PRODUCTS — horizontal scroll with stock */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="subhead text-2xl">Active products</h2>
          <Link href="/admin/products" className="eyebrow text-brown hover:text-ember">
            Manage →
          </Link>
        </div>
        {stats.activeProducts.length === 0 ? (
          <p className="mt-3 text-sm text-brown">No active products yet.</p>
        ) : (
          <div className="-mx-1 mt-4 flex gap-3 overflow-x-auto px-1 pb-3">
            {stats.activeProducts.map((p) => {
              const out = p.stock === 0;
              const low = p.stock > 0 && p.stock <= 5;
              return (
                <Link
                  key={p.id}
                  href={`/admin/products`}
                  className="w-40 shrink-0 overflow-hidden rounded-xl border border-warmgrey/60 bg-white/50 transition-colors hover:border-ink"
                >
                  <div className="relative aspect-square bg-ink">
                    {p.image && (
                      <Image
                        src={p.image}
                        alt={p.name}
                        fill
                        sizes="160px"
                        className="object-cover"
                      />
                    )}
                    <span
                      className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${
                        out
                          ? "bg-red-700 text-white"
                          : low
                            ? "bg-ember text-peach"
                            : "bg-ink/80 text-peach"
                      }`}
                    >
                      {out ? "Sold out" : `${p.stock} in stock`}
                    </span>
                  </div>
                  <div className="p-3">
                    <p className="subhead truncate text-sm">{p.name}</p>
                    <p className="mt-0.5 text-xs text-brown">
                      {formatRM(p.basePriceSen)}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* LOW STOCK */}
      <section className="mt-10">
        <h2 className="subhead text-2xl">Low stock alerts</h2>
        {stats.lowStock.length === 0 ? (
          <p className="mt-3 text-sm text-brown">All variants healthy.</p>
        ) : (
          <table className="mt-3 w-full max-w-2xl border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink text-left">
                <th className="py-2 eyebrow text-brown">Product</th>
                <th className="py-2 eyebrow text-brown">Variant</th>
                <th className="py-2 eyebrow text-brown">Stock</th>
              </tr>
            </thead>
            <tbody>
              {stats.lowStock.map((row, i) => (
                <tr key={i} className="border-b border-sand">
                  <td className="py-2">{row.product}</td>
                  <td className="py-2 text-brown">
                    {row.size}/{row.colour}
                  </td>
                  <td
                    className={`py-2 font-bold ${row.stock === 0 ? "text-red-700" : "text-ember"}`}
                  >
                    {row.stock}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
