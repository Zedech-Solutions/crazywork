"use client";

import { useEffect } from "react";
import { trackMeta } from "@/lib/meta-events";

export type PurchaseData = {
  orderNumber: string;
  value: number;
  contents: {
    id: string;
    quantity: number;
    item_price: number;
  }[];
};

export default function PurchaseEvent({
  purchase,
}: {
  purchase: PurchaseData;
}) {
  useEffect(() => {
    const key = `meta-purchase:${purchase.orderNumber}`;
    let sent = false;

    const timer = window.setInterval(() => {
      if (sent) return;

      try {
        if (localStorage.getItem(key)) {
          sent = true;
          window.clearInterval(timer);
          return;
        }
      } catch {
        // Continue if browser storage is unavailable.
      }

      sent = trackMeta(
        "Purchase",
        {
          value: purchase.value,
          currency: "MYR",
          content_type: "product",
          content_ids: [...new Set(
            purchase.contents.map((item) => item.id)
          )],
          contents: purchase.contents,
          num_items: purchase.contents.reduce(
            (sum, item) => sum + item.quantity,
            0,
          ),
        },
        `purchase-${purchase.orderNumber}`,
      );

      if (sent) {
        try {
          localStorage.setItem(key, "1");
        } catch {
          // Storage failure must not break checkout.
        }
        window.clearInterval(timer);
      }
    }, 500);

    const stop = window.setTimeout(
      () => window.clearInterval(timer),
      10000,
    );

    return () => {
      window.clearInterval(timer);
      window.clearTimeout(stop);
    };
  }, [purchase]);

  return null;
}
