"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Image from "next/image";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Heart,
  Search,
} from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatRM } from "@/lib/money";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  type: "account" | "guest";
  joinedAt: string;
  lastOrderAt: string | null;
  orders: number;
  spentSen: number;
}

interface Page {
  page: number;
  pages: number;
  total: number;
  customers: Customer[];
}

interface WishItem {
  productId: string;
  name: string;
  slug: string;
  image: string | null;
}

interface TopWish {
  productId: string;
  name: string;
  image: string | null;
  count: number;
}

export default function AdminCustomersPage() {
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [topWish, setTopWish] = useState<TopWish[]>([]);
  const [showTop, setShowTop] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [wishCache, setWishCache] = useState<
    Record<string, { hasAccount: boolean; items: WishItem[] }>
  >({});

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    adminFetch<Page>(`/customers?${params}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page, query]);
  useEffect(load, [load]);

  useEffect(() => {
    adminFetch<{ items: TopWish[] }>("/wishlist")
      .then((r) => setTopWish(r.items))
      .catch(() => {});
  }, []);

  function toggleRow(cust: Customer) {
    const next = expanded === cust.id ? null : cust.id;
    setExpanded(next);
    if (next && !wishCache[cust.id]) {
      adminFetch<{ hasAccount: boolean; items: WishItem[] }>(
        `/customers/wishlist?email=${encodeURIComponent(cust.email)}`,
      )
        .then((r) =>
          setWishCache((w) => ({
            ...w,
            [cust.id]: { hasAccount: r.hasAccount, items: r.items },
          })),
        )
        .catch(() =>
          setWishCache((w) => ({
            ...w,
            [cust.id]: { hasAccount: false, items: [] },
          })),
        );
    }
  }

  function search(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setQuery(q.trim());
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="headline text-5xl">Customers</h1>
          <p className="mt-1 text-sm text-brown">
            {data ? `${data.total} customer${data.total === 1 ? "" : "s"}` : "—"}
          </p>
        </div>
        <form onSubmit={search} className="flex w-full gap-2 sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brown"
            />
            <Input
              className="w-full pl-9 sm:w-64"
              placeholder="Search name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline" className="shrink-0">
            Search
          </Button>
        </form>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {/* Most wishlisted — collapsible overview */}
      {topWish.length > 0 && (
        <div className="mt-6 rounded-2xl border border-warmgrey/60 bg-sand/30">
          <button
            onClick={() => setShowTop((s) => !s)}
            className="flex w-full items-center justify-between px-4 py-3 cursor-pointer"
          >
            <span className="flex items-center gap-2 subhead text-sm">
              <Heart size={15} className="fill-ember text-ember" /> Most wishlisted
            </span>
            <ChevronDown
              size={16}
              className={cn("text-brown transition-transform", showTop && "rotate-180")}
            />
          </button>
          {showTop && (
            <div className="flex flex-wrap gap-2 border-t border-warmgrey/40 p-4">
              {topWish.map((w) => (
                <div
                  key={w.productId}
                  className="flex items-center gap-2 rounded-full border border-warmgrey/60 bg-white/60 py-1 pl-1 pr-3"
                >
                  <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full bg-ink">
                    {w.image && (
                      <Image src={w.image} alt="" fill sizes="28px" className="object-cover" />
                    )}
                  </span>
                  <span className="text-xs">{w.name}</span>
                  <span className="text-xs font-bold text-ember">♥ {w.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-warmgrey/60">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-warmgrey/60 bg-sand/50 text-left">
              {["Customer", "Phone", "Orders", "Total spent", "Last order"].map(
                (h) => (
                  <th key={h} className="px-4 py-3 eyebrow text-brown">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {data?.customers.map((c) => (
              <Fragment key={c.id}>
                <tr
                  onClick={() => toggleRow(c)}
                  className="cursor-pointer border-b border-sand last:border-0 hover:bg-sand/30"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember text-sm font-bold text-peach">
                        {(c.name ?? c.email).charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate subhead text-sm">{c.name ?? "—"}</p>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] ${
                              c.type === "account"
                                ? "bg-ember/15 text-ember"
                                : "bg-warmgrey/25 text-brown"
                            }`}
                          >
                            {c.type === "account" ? "Account" : "Guest"}
                          </span>
                          <ChevronDown
                            size={14}
                            className={cn(
                              "text-warmgrey transition-transform",
                              expanded === c.id && "rotate-180",
                            )}
                          />
                        </div>
                        <p className="truncate text-xs text-brown">{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-brown">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 font-bold">{c.orders}</td>
                  <td className="px-4 py-3 font-bold">{formatRM(c.spentSen)}</td>
                  <td className="px-4 py-3 text-brown">
                    {c.lastOrderAt
                      ? new Date(c.lastOrderAt).toLocaleDateString("en-MY", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                </tr>
                {expanded === c.id && (
                  <tr className="border-b border-sand bg-sand/20">
                    <td colSpan={5} className="px-4 py-3">
                      <p className="eyebrow mb-2 text-brown">Wishlist</p>
                      {!wishCache[c.id] ? (
                        <p className="text-xs text-brown">Loading…</p>
                      ) : !wishCache[c.id].hasAccount ? (
                        <p className="text-xs text-brown">
                          No login account for this email — wishlists are
                          account-only.
                        </p>
                      ) : wishCache[c.id].items.length === 0 ? (
                        <p className="text-xs text-brown">Nothing saved yet.</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {wishCache[c.id].items.map((w) => (
                            <a
                              key={w.productId}
                              href={`/product/${w.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-2 rounded-lg border border-warmgrey/60 bg-white/60 py-1 pl-1 pr-3 hover:border-ink"
                            >
                              <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-ink">
                                {w.image && (
                                  <Image
                                    src={w.image}
                                    alt=""
                                    fill
                                    sizes="32px"
                                    className="object-cover"
                                  />
                                )}
                              </span>
                              <span className="text-xs">{w.name}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {data && data.customers.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-brown">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data && data.pages > 1 && (
        <div className="mt-5 flex items-center justify-between">
          <p className="text-xs text-brown">
            Page {data.page} of {data.pages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Prev
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={page >= data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight size={14} />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
