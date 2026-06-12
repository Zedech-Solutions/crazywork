"use client";

import { useCallback, useEffect, useState } from "react";
import { adminFetch } from "@/components/admin/api";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Badge, Input } from "@/components/ui/field";
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

const TONE: Record<string, "ember" | "ink" | "sand" | "outline"> = {
  pending: "outline",
  paid: "ember",
  processing: "ember",
  shipped: "ink",
  delivered: "ink",
  cancelled: "sand",
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<ApiOrder[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState<{ courier: string; number: string }>({
    courier: "",
    number: "",
  });

  const reload = useCallback(() => {
    adminFetch<{ orders: ApiOrder[] }>(`/orders${filter ? `?status=${filter}` : ""}`)
      .then((r) => setOrders(r.orders))
      .catch((e) => setError(e.message));
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

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="headline text-5xl">Orders</h1>
        <div className="flex items-center gap-2">
          <Dropdown
            className="w-44"
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
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/orders/export.csv" download>
              Export CSV
            </a>
          </Button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-8 space-y-3">
        {orders.map((order) => {
          const expanded = open === order.id;
          return (
            <div key={order.id} className="border border-warmgrey bg-sand/30">
              <button
                className="grid w-full cursor-pointer grid-cols-2 items-center gap-2 p-4 text-left text-sm sm:grid-cols-[1.2fr_1.5fr_1fr_1fr_auto]"
                onClick={() => {
                  setOpen(expanded ? null : order.id);
                  setTracking({
                    courier: order.courierName ?? "",
                    number: order.trackingNumber ?? "",
                  });
                }}
              >
                <span className="subhead text-base">{order.orderNumber}</span>
                <span className="truncate text-brown">
                  {order.customerName} · {order.customerEmail}
                </span>
                <span>{formatRM(toSen(order.total))}</span>
                <span className="text-xs text-brown">
                  {new Date(order.placedAt).toLocaleDateString("en-MY")}
                </span>
                <Badge tone={TONE[order.status]}>{order.status}</Badge>
              </button>

              {expanded && (
                <div className="border-t border-warmgrey p-4">
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
                        <p className="text-sm font-bold text-ink">
                          Total {formatRM(toSen(order.total))}
                        </p>
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
                          <p className="eyebrow text-brown">Tracking #</p>
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
