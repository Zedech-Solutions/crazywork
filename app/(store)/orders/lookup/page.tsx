"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label, Badge } from "@/components/ui/field";
import { formatRM, toSen } from "@/lib/money";

interface LookupOrder {
  orderNumber: string;
  status: string;
  placedAt: string;
  total: string;
  courierName: string | null;
  trackingNumber: string | null;
  items: {
    productName: string;
    size: string;
    colour: string;
    quantity: number;
    unitPrice: string;
  }[];
}

const STATUS_TONE: Record<string, "ember" | "ink" | "sand" | "outline"> = {
  pending: "outline",
  paid: "ember",
  processing: "ember",
  shipped: "ink",
  delivered: "ink",
  cancelled: "sand",
};

function OrderLookup() {
  const params = useSearchParams();
  const [orderNumber, setOrderNumber] = useState(
    params.get("orderNumber")?.toUpperCase().trim() ?? "",
  );
  const [email, setEmail] = useState(params.get("email") ?? "");
  const [order, setOrder] = useState<LookupOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const runLookup = useCallback(async (orderNo: string, mail: string) => {
    if (!orderNo || !mail) return;
    setBusy(true);
    setError(null);
    setOrder(null);
    try {
      const query = new URLSearchParams({ orderNumber: orderNo, email: mail });
      const res = await fetch(`/api/orders/lookup?${query}`);
      const body = await res.json();
      if (body.ok) setOrder(body.order);
      else setError(body.message ?? "No order found for that combination.");
    } catch {
      setError("Something went wrong — try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Auto-run when arriving from a "Track this order" link (both params present).
  useEffect(() => {
    const o = params.get("orderNumber")?.toUpperCase().trim();
    const m = params.get("email");
    if (o && m) runLookup(o, m);
  }, [params, runLookup]);

  function lookup(e: React.FormEvent) {
    e.preventDefault();
    runLookup(orderNumber, email);
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-14 sm:px-6">
      <h1 className="headline text-6xl">Track Order</h1>
      <p className="mt-2 text-sm text-brown">
        Enter your order number and the email you checked out with.
      </p>
      <form onSubmit={lookup} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="lk-order">Order number</Label>
          <Input
            id="lk-order"
            required
            placeholder="CW-260612-XXXX"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value.toUpperCase().trim())}
          />
        </div>
        <div>
          <Label htmlFor="lk-email">Email</Label>
          <Input
            id="lk-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" variant="accent" disabled={busy} className="w-full">
          {busy ? "Looking…" : "Find my order"}
        </Button>
      </form>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {order && (
        <div className="mt-8 border border-warmgrey bg-sand/50 p-6">
          <div className="flex items-center justify-between">
            <p className="subhead text-xl">{order.orderNumber}</p>
            <Badge tone={STATUS_TONE[order.status] ?? "outline"}>
              {order.status}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-brown">
            Placed {new Date(order.placedAt).toLocaleDateString("en-MY")}
          </p>
          {order.trackingNumber && (
            <p className="mt-3 text-sm">
              <span className="text-brown">Tracking:</span>{" "}
              <span className="font-bold">
                {order.courierName ? `${order.courierName} · ` : ""}
                {order.trackingNumber}
              </span>
            </p>
          )}
          <ul className="mt-4 space-y-1.5 border-t border-warmgrey pt-4 text-sm">
            {order.items.map((item, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-brown">
                  {item.quantity}× {item.productName} ({item.size}/{item.colour})
                </span>
                <span>{formatRM(toSen(item.unitPrice) * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex justify-between border-t border-warmgrey pt-3 font-bold">
            <span>Total</span>
            <span>{formatRM(toSen(order.total))}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default function OrderLookupPage() {
  return (
    <Suspense fallback={null}>
      <OrderLookup />
    </Suspense>
  );
}
