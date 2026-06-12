"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { formatRM } from "@/lib/money";

interface Customer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  joinedAt: string;
  orders: number;
  spentSen: number;
}

interface Page {
  page: number;
  pages: number;
  total: number;
  customers: Customer[];
}

export default function AdminCustomersPage() {
  const [data, setData] = useState<Page | null>(null);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const params = new URLSearchParams({ page: String(page) });
    if (query) params.set("q", query);
    adminFetch<Page>(`/customers?${params}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [page, query]);
  useEffect(load, [load]);

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
        <form onSubmit={search} className="flex gap-2">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brown"
            />
            <Input
              className="w-64 pl-9"
              placeholder="Search name or email"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-6 overflow-x-auto rounded-2xl border border-warmgrey/60">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-warmgrey/60 bg-sand/50 text-left">
              {["Customer", "Phone", "Orders", "Total spent", "Joined"].map((h) => (
                <th key={h} className="px-4 py-3 eyebrow text-brown">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data?.customers.map((c) => (
              <tr
                key={c.id}
                className="border-b border-sand last:border-0 hover:bg-sand/30"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ember text-sm font-bold text-peach">
                      {(c.name ?? c.email).charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate subhead text-sm">{c.name ?? "—"}</p>
                      <p className="truncate text-xs text-brown">{c.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-brown">{c.phone ?? "—"}</td>
                <td className="px-4 py-3 font-bold">{c.orders}</td>
                <td className="px-4 py-3 font-bold">{formatRM(c.spentSen)}</td>
                <td className="px-4 py-3 text-brown">
                  {new Date(c.joinedAt).toLocaleDateString("en-MY", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </td>
              </tr>
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
