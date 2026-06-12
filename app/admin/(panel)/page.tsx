"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { adminFetch } from "@/components/admin/api";
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
  lowStock: { product: string; size: string; colour: string; stock: number }[];
  activeProducts: ActiveProduct[];
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    adminFetch<Stats>("/stats").then(setStats).catch((e) => setError(e.message));
  }, []);

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
    { label: "Customers", value: String(stats.customers), href: "/admin/customers" },
  ];

  return (
    <div>
      <h1 className="headline text-5xl">Dashboard</h1>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            className="rounded-xl border border-warmgrey/60 bg-sand/50 p-5 transition-colors hover:border-ink"
          >
            <p className="eyebrow text-brown">{card.label}</p>
            <p
              className={`headline mt-2 text-4xl ${card.accent ? "text-red-700" : ""}`}
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
