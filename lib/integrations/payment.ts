import { getSecret } from "@/lib/secrets";
import type { CheckoutOrder, PaidEvent, Payment } from "./types";

// Stub → redirects straight to the fake-success URL; the success page calls
// the fake-paid endpoint which drives the same transition a real Stripe
// webhook would. Real impl: Stripe Checkout (Cards + FPX + GrabPay, MYR).
export class StubPayment implements Payment {
  async createCheckout(order: CheckoutOrder): Promise<{ url: string; id: string }> {
    const configured = Boolean(await getSecret("stripe_secret_key"));
    if (!configured) {
      console.log(
        `[payment:stub] stripe not configured — fake checkout for ${order.orderNumber}`,
      );
    }
    return {
      url: `/checkout/success?fake=1&order=${encodeURIComponent(order.orderNumber)}`,
      id: `stub_${order.orderNumber}`,
    };
  }

  async verifyWebhook(req: Request): Promise<PaidEvent | null> {
    // Stub accepts a JSON body { orderNumber } as an already-verified event.
    // Real impl verifies the Stripe signature with stripe_webhook_secret.
    try {
      const body = (await req.json()) as { orderNumber?: string };
      if (!body.orderNumber) return null;
      return { orderNumber: body.orderNumber, paymentMethod: "stub" };
    } catch {
      return null;
    }
  }
}

export const payment: Payment = new StubPayment();
