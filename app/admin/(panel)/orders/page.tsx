"use client";

import { useCallback, useEffect, useState } from "react";
import { Mail, Pencil, Search } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { CopyButton } from "@/components/admin/copy-button";
import { NewOrderDialog } from "@/components/admin/new-order-dialog";
import { OrderProgress } from "@/components/admin/order-progress";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input } from "@/components/ui/field";
import { formatRM, toSen } from "@/lib/money";
import { cn } from "@/lib/utils";

const STATUSES = ["pending", "paid", "processing", "shipped", "delivered", "cancelled"] as const;

interface ApiOrder {
  id: string;
  orderNumber: string;
  placedAt: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  shippingAddress: string;
  shippingState: string;
  shippingZone: string;
  status: (typeof STATUSES)[number];
  subtotal: string;
  discountAmount: string;
  shippingFee: string;
  total: string;
  appliedDiscountLabel: string | null;
  orderNote: string | null;
  courierName: string | null;
  trackingNumber: string | null;
  items: { productName: string; size: string; colour: string; quantity: number; unitPrice: string }[];
}

// Each status gets its own colour so the list scans at a glance.
const STATUS_STYLE: Record<string, { dot: string; pill: string }> = {
  pending: { dot: "bg-warmgrey", pill: "bg-warmgrey/25 text-brown" },
  paid: { dot: "bg-blue-500", pill: "bg-blue-100 text-blue-700" },
  processing: { dot: "bg-ember", pill: "bg-ember/15 text-ember" },
  shipped: { dot: "bg-indigo-500", pill: "bg-indigo-100 text-indigo-700" },
  delivered: { dot: "bg-emerald-500", pill: "bg-emerald-100 text-emerald-700" },
  cancelled: { dot: "bg-red-500", pill: "bg-red-100 text-red-700" },
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em]",
        STATUS_STYLE[status]?.pill ?? "bg-warmgrey/25 text-brown",
      )}
    >
      {status}
    </span>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [sort, setSort] = useState<"newest" | "oldest" | "highest" | "lowest">(
    "newest",
  );
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [itemCounts, setItemCounts] = useState<Record<string, number>>({});
  const [editTotalId, setEditTotalId] = useState<string | null>(null);
  const [editTotalValue, setEditTotalValue] = useState("");
  const [tracking, setTracking] = useState<{ courier: string; number: string }>({
    courier: "",
    number: "",
  });

  const reload = useCallback(() => {
    adminFetch<{ orders: ApiOrder[] }>(`/orders${filter ? `?status=${filter}` : ""}`)
      .then((r) => setOrders(r.orders))
      .catch((e) => setError(e.message));
    adminFetch<{
      counts: Record<string, number>;
      itemCounts: Record<string, number>;
    }>("/orders/counts")
      .then((r) => {
        setCounts(r.counts);
        setItemCounts(r.itemCounts ?? {});
      })
      .catch(() => {});
  }, [filter]);
  useEffect(reload, [reload]);

  async function setStatus(order: ApiOrder, status: string) {
    setError(null);
    try {
      await adminFetch(`/orders/${order.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(status === "shipped"
            ? { courierName: tracking.courier, trackingNumber: tracking.number }
            : {}),
        }),
      });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function saveTotal(orderId: string) {
    const totalSen = Math.round(parseFloat(editTotalValue) * 100);
    if (!Number.isFinite(totalSen) || totalSen < 0) {
      setError("Enter a valid amount.");
      return;
    }
    setError(null);
    try {
      await adminFetch(`/orders/${orderId}`, {
        method: "PATCH",
        body: JSON.stringify({ totalSen }),
      });
      setEditTotalId(null);
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const sorted = [...orders].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return +new Date(a.placedAt) - +new Date(b.placedAt);
      case "highest":
        return toSen(b.total) - toSen(a.total);
      case "lowest":
        return toSen(a.total) - toSen(b.total);
      default:
        return +new Date(b.placedAt) - +new Date(a.placedAt);
    }
  });

  const q = query.trim().toLowerCase();
  const fromTs = fromDate ? +new Date(`${fromDate}T00:00:00`) : null;
  const toTs = toDate ? +new Date(`${toDate}T23:59:59`) : null;
  const visible = sorted.filter((o) => {
    const t = +new Date(o.placedAt);
    if (fromTs && t < fromTs) return false;
    if (toTs && t > toTs) return false;
    if (!q) return true;
    return [
      o.orderNumber,
      o.customerName,
      o.customerEmail,
      o.customerPhone,
      o.shippingAddress,
      o.shippingState,
      o.status,
      o.trackingNumber,
      o.courierName,
      o.total,
      ...o.items.map((it) => `${it.productName} ${it.size} ${it.colour}`),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(q);
  });

  const totalOrders = Object.values(counts).reduce((s, n) => s + n, 0);
  const totalItems = Object.values(itemCounts).reduce((s, n) => s + n, 0);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="headline text-5xl">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-warmgrey"
            />
            <Input
              className="w-56 pl-9"
              placeholder="Search orders…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Dropdown
            className="w-40"
            value={filter || "all"}
            onValueChange={(v) => setFilter(v === "all" ? "" : v)}
            options={[
              { label: "All statuses", value: "all" },
              ...STATUSES.map((s) => ({
                label: s.charAt(0).toUpperCase() + s.slice(1),
                value: s,
              })),
            ]}
          />
          <Dropdown
            className="w-44"
            value={sort}
            onValueChange={(v) => setSort(v as typeof sort)}
            options={[
              { label: "Newest first", value: "newest" },
              { label: "Oldest first", value: "oldest" },
              { label: "Highest total", value: "highest" },
              { label: "Lowest total", value: "lowest" },
            ]}
          />
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/orders/export.csv" download>
              Export CSV
            </a>
          </Button>
          <NewOrderDialog onCreated={reload} />
        </div>
      </div>

      {/* Date-range filter */}
      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="eyebrow text-brown">Placed between</span>
        <Input
          type="date"
          className="w-40 py-1.5"
          value={fromDate}
          max={toDate || undefined}
          onChange={(e) => setFromDate(e.target.value)}
        />
        <span className="text-brown">→</span>
        <Input
          type="date"
          className="w-40 py-1.5"
          value={toDate}
          min={fromDate || undefined}
          onChange={(e) => setToDate(e.target.value)}
        />
        {(fromDate || toDate) && (
          <button
            onClick={() => {
              setFromDate("");
              setToDate("");
            }}
            className="cursor-pointer text-xs text-brown underline-offset-2 hover:text-ember hover:underline"
          >
            Clear
          </button>
        )}
      </div>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {/* Status overview — orders + items by status. */}
      {totalOrders > 0 && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          {/* ORDERS — clickable to filter */}
          <div className="rounded-2xl border border-warmgrey/50 bg-sand/30 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow text-brown">Orders by status</p>
              <p className="text-xs text-brown">{totalOrders} total</p>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-warmgrey/20">
              {STATUSES.map((s) => {
                const n = counts[s] ?? 0;
                if (!n) return null;
                return (
                  <div
                    key={s}
                    className={STATUS_STYLE[s].dot}
                    style={{ width: `${(n / totalOrders) * 100}%` }}
                    title={`${s}: ${n}`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((s) => {
                const active = filter === s;
                return (
                  <button
                    key={s}
                    onClick={() => setFilter(active ? "" : s)}
                    className={cn(
                      "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors",
                      active
                        ? "border-ink bg-ink text-peach"
                        : "border-warmgrey/60 text-brown hover:border-ink",
                    )}
                  >
                    <span className={cn("h-2 w-2 rounded-full", STATUS_STYLE[s].dot)} />
                    <span className="capitalize">{s}</span>
                    <span className="font-bold">{counts[s] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ITEMS — how many units are in each stage */}
          <div className="rounded-2xl border border-warmgrey/50 bg-sand/30 p-4">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow text-brown">Items by status</p>
              <p className="text-xs text-brown">{totalItems} units</p>
            </div>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-warmgrey/20">
              {STATUSES.map((s) => {
                const n = itemCounts[s] ?? 0;
                if (!n || totalItems === 0) return null;
                return (
                  <div
                    key={s}
                    className={STATUS_STYLE[s].dot}
                    style={{ width: `${(n / totalItems) * 100}%` }}
                    title={`${s}: ${n} items`}
                  />
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1.5 rounded-full border border-warmgrey/60 px-3 py-1 text-xs text-brown"
                >
                  <span className={cn("h-2 w-2 rounded-full", STATUS_STYLE[s].dot)} />
                  <span className="capitalize">{s}</span>
                  <span className="font-bold">{itemCounts[s] ?? 0}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-brown">
            No orders match.
          </p>
        )}
        {visible.map((order) => {
          const expanded = open === order.id;
          return (
            <div key={order.id} className="border border-warmgrey bg-sand/30">
              <div
                role="button"
                tabIndex={0}
                className="grid w-full cursor-pointer grid-cols-2 items-center gap-3 p-4 text-left text-sm sm:grid-cols-[1.4fr_1.1fr_1.7fr_minmax(5rem,0.7fr)_minmax(6rem,0.7fr)_7rem]"
                onClick={() => {
                  setOpen(expanded ? null : order.id);
                  setTracking({
                    courier: order.courierName ?? "",
                    number: order.trackingNumber ?? "",
                  });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpen(expanded ? null : order.id);
                  }
                }}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="subhead truncate text-base">
                    {order.orderNumber}
                  </span>
                  <CopyButton
                    value={order.orderNumber}
                    label="order number"
                    iconOnly
                  />
                </span>
                <span className="truncate text-brown">{order.customerName}</span>
                <span className="flex min-w-0 items-center gap-1.5 text-brown">
                  <span className="truncate">{order.customerEmail}</span>
                  <CopyButton value={order.customerEmail} label="email" iconOnly />
                </span>
                <span className="text-right tabular-nums">
                  {formatRM(toSen(order.total))}
                </span>
                <span className="text-right text-xs tabular-nums text-brown">
                  {new Date(order.placedAt).toLocaleDateString("en-MY")}
                </span>
                <span className="flex items-center justify-end gap-2">
                  {order.orderNote && (
                    <span title="Customer left a note" className="text-ember">
                      <Mail size={15} />
                    </span>
                  )}
                  <StatusPill status={order.status} />
                </span>
              </div>

              {expanded && (
                <div className="border-t border-warmgrey p-4">
                  <div className="mb-6 px-2 pt-1">
                    <OrderProgress status={order.status} />
                  </div>
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="text-sm">
                      <p className="eyebrow text-brown">Items</p>
                      <ul className="mt-2 space-y-1">
                        {order.items.map((item, i) => (
                          <li key={i} className="flex justify-between gap-3">
                            <span>
                              {item.quantity}× {item.productName} ({item.size}/{item.colour})
                            </span>
                            <span>{formatRM(toSen(item.unitPrice) * item.quantity)}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-3 space-y-1 border-t border-warmgrey pt-2 text-xs text-brown">
                        <p>Subtotal {formatRM(toSen(order.subtotal))}</p>
                        {Number(order.discountAmount) > 0 && (
                          <p className="text-ember">
                            Discount −{formatRM(toSen(order.discountAmount))}
                            {order.appliedDiscountLabel ? ` (${order.appliedDiscountLabel})` : ""}
                          </p>
                        )}
                        <p>
                          Shipping {formatRM(toSen(order.shippingFee))} ({order.shippingZone})
                        </p>
                        {editTotalId === order.id ? (
                          <div className="flex items-center gap-2 pt-1">
                            <span className="text-sm font-bold text-ink">Total RM</span>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              className="w-24 py-1"
                              value={editTotalValue}
                              onChange={(e) => setEditTotalValue(e.target.value)}
                            />
                            <button
                              onClick={() => saveTotal(order.id)}
                              className="cursor-pointer text-xs font-bold text-emerald-700"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditTotalId(null)}
                              className="cursor-pointer text-xs text-brown hover:text-ink"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <p className="flex items-center gap-2 text-sm font-bold text-ink">
                            Total {formatRM(toSen(order.total))}
                            <button
                              aria-label="Edit amount paid"
                              title="Edit amount paid"
                              onClick={() => {
                                setEditTotalId(order.id);
                                setEditTotalValue(
                                  (toSen(order.total) / 100).toFixed(2),
                                );
                              }}
                              className="cursor-pointer text-warmgrey hover:text-ember"
                            >
                              <Pencil size={12} />
                            </button>
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-sm">
                      <p className="eyebrow text-brown">Ship to</p>
                      <p className="mt-2">
                        {order.customerName}
                        {order.customerPhone ? ` · ${order.customerPhone}` : ""}
                      </p>
                      <p className="text-brown">
                        {order.shippingAddress}, {order.shippingState}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5">
                        <a
                          href={`mailto:${order.customerEmail}`}
                          className="text-brown hover:text-ember"
                        >
                          {order.customerEmail}
                        </a>
                        <CopyButton value={order.customerEmail} label="email" />
                      </p>
                      {order.orderNote && (
                        <div className="mt-3 border-l-2 border-ember bg-peach p-3">
                          <p className="eyebrow text-ember">Order note</p>
                          <p className="mt-1">{order.orderNote}</p>
                        </div>
                      )}
                      <div className="mt-4 flex flex-wrap items-end gap-2">
                        <div>
                          <p className="eyebrow text-brown">Courier</p>
                          <Input
                            className="mt-1 w-32 py-1.5"
                            placeholder="J&T"
                            value={tracking.courier}
                            onChange={(e) =>
                              setTracking((t) => ({ ...t, courier: e.target.value }))
                            }
                          />
                        </div>
                        <div>
                          <p className="flex items-center gap-1.5 eyebrow text-brown">
                            Tracking #
                            <CopyButton
                              value={tracking.number}
                              label="tracking number"
                            />
                          </p>
                          <Input
                            className="mt-1 w-44 py-1.5"
                            placeholder="JT123…MY"
                            value={tracking.number}
                            onChange={(e) =>
                              setTracking((t) => ({ ...t, number: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2 border-t border-warmgrey pt-4">
                    {STATUSES.filter((s) => s !== order.status).map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={s === "cancelled" ? "danger" : "outline"}
                        className={cn(s === "shipped" && "border-ember text-ember")}
                        onClick={() => setStatus(order, s)}
                      >
                        Mark {s}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {orders.length === 0 && <p className="text-sm text-brown">No orders.</p>}
      </div>
    </div>
  );
}
