import { getSecret } from "@/lib/secrets";
import { getSetting } from "@/lib/settings";
import { mailer } from "./mailer";
import type { Notifier, OrderAlert } from "./types";

// Stub → console + in-memory log. Real impl: Discord webhook, or owner email
// via the Mailer — the owner picks the channel in Settings → Store.
export class StubNotifier implements Notifier {
  readonly alerts: OrderAlert[] = [];

  async orderPlaced(order: OrderAlert): Promise<void> {
    this.alerts.push(order);
    const channel = await getSetting("ownerAlertChannel");
    if (channel === "email") {
      const ownerEmail =
        (await getSetting("ownerAlertEmail")) ??
        process.env.SUPERADMIN_EMAIL ??
        "";
      if (ownerEmail) {
        await mailer.send(ownerEmail, "owner_order_alert", { ...order });
        return;
      }
    }
    const webhook = await getSecret("discord_webhook_url");
    console.log(
      `[notify:stub] order ${order.orderNumber} paid — ${order.itemSummary}` +
        (webhook ? "" : " (discord not configured)"),
    );
  }
}

export const notifier = new StubNotifier();
