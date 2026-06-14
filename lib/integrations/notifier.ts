import { getSecret } from "@/lib/secrets";
import { getSetting } from "@/lib/settings";
import type { Notifier, OrderAlert } from "./types";

const rm = (sen: number) => (sen / 100).toFixed(2);

// One "1× Product (M/Black) — 4 left" line per item.
function itemLine(i: OrderAlert["items"][number]): string {
  const left = i.stockLeft != null ? ` — **${i.stockLeft} left**` : "";
  return `${i.quantity}× ${i.productName} (${i.size}/${i.colour})${left}`;
}

// Posts a paid-order alert to the configured Discord webhook as a rich embed.
// Test-mode orders (paid through Stripe test keys) only notify when the owner
// has enabled "show test orders" in Settings, and always carry a [TEST] tag.
export class DiscordNotifier implements Notifier {
  readonly alerts: OrderAlert[] = [];

  async orderPlaced(order: OrderAlert): Promise<void> {
    this.alerts.push(order);

    if (order.test && !(await getSetting("showTestOrders"))) {
      return; // owner hasn't opted to surface test traffic
    }

    const webhook = await getSecret("discord_webhook_url");
    // No external calls in tests; unconfigured falls back to a log line.
    if (!webhook || process.env.NODE_ENV === "test") {
      console.log(
        `[notify] order ${order.orderNumber} paid${webhook ? "" : " (discord not configured)"}`,
      );
      return;
    }

    const embed = {
      title: `${order.test ? "🧪 [TEST] " : "🛒 "}New order ${order.orderNumber}`,
      color: order.test ? 0xf59e0b : 0xea580c, // amber for test, ember for live
      fields: [
        { name: "Customer", value: order.customerName || "—", inline: true },
        { name: "Total", value: `RM${rm(order.totalSen)}`, inline: true },
        {
          name: "Items",
          value: order.items.map(itemLine).join("\n") || "—",
        },
      ],
      footer: { text: "CRAZYWORK" },
      timestamp: new Date().toISOString(),
    };

    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [embed] }),
      });
    } catch (e) {
      console.error("[notify] discord webhook failed", e);
    }
  }
}

export const notifier = new DiscordNotifier();
