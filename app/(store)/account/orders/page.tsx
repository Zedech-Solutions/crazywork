"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/field";
import { useSession } from "@/lib/auth-client";
import { formatRM, toSen } from "@/lib/money";

interface MyOrder {
  id: string;
  orderNumber: string;
  status: string;
  placedAt: string;
  total: string;
  courierName: string | null;
  trackingNumber: string | null;
  appliedDiscountLabel: string | null;
  items: {
    productName: string;
    size: string;
    colour: string;
    quantity: number;
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

export default function AccountOrdersPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [orders, setOrders] = useState<MyOrder[] | null>(null);

  useEffect(() => {
    if (!isPending && !session) router.replace("/auth/sign-in");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/me/orders")
      .then((res) => res.json())
      .then((body) => body.ok && setOrders(body.orders))
      .catch(() => setOrders([]));
  }, [session]);

  if (!session) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="eyebrow text-ember">
        <Link href="/account" className="hover:underline">
          ← Account
        </Link>
      </p>
      <h1 className="headline mt-1 text-6xl">My Orders</h1>

      {orders === null ? (
        <p className="mt-8 text-sm text-brown">Loading…</p>
      ) : orders.length === 0 ? (
        <p className="mt-8 text-sm text-brown">
          No orders yet —{" "}
          <Link href="/shop" className="text-ember underline">
            change that
          </Link>
          .
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {orders.map((order) => (
            <li key={order.id} className="border border-warmgrey bg-sand/40 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="subhead text-lg">{order.orderNumber}</p>
                <Badge tone={STATUS_TONE[order.status] ?? "outline"}>
                  {order.status}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-brown">
                {new Date(order.placedAt).toLocaleDateString("en-MY", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · {formatRM(toSen(order.total))}
                {order.appliedDiscountLabel
                  ? ` · ${order.appliedDiscountLabel}`
                  : ""}
              </p>
              <p className="mt-2 text-sm text-brown">
                {order.items
                  .map(
                    (i) =>
                      `${i.quantity}× ${i.productName} (${i.size}/${i.colour})`,
                  )
                  .join(", ")}
              </p>
              {order.trackingNumber && (
                <p className="mt-2 text-sm">
                  <span className="text-brown">Tracking:</span>{" "}
                  <span className="font-bold">
                    {order.courierName ? `${order.courierName} · ` : ""}
                    {order.trackingNumber}
                  </span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
