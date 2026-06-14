import Stripe from "stripe";
import { getSecret, type RuntimeSecretKey } from "@/lib/secrets";
import { getSetting } from "@/lib/settings";
import type { CheckoutOrder, PaidEvent, Payment } from "./types";

export type StripeMode = "test" | "live";

// The subset of the Stripe SDK this module uses — lets tests inject a fake.
export interface StripeClientLike {
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
      ): Promise<{ id: string; url: string | null }>;
    };
  };
  webhooks: {
    constructEvent(payload: string, sig: string, secret: string): Stripe.Event;
  };
  balance: {
    retrieve(): Promise<unknown>;
  };
}

export interface StripeSecrets {
  secretKey: string | null;
  webhookSecret: string | null;
}

// Which encrypted-secret rows hold the credentials for a given mode. The
// unprefixed trio is the test/sandbox set; live keys are namespaced so both
// sets can be stored at once and switched with the stripeMode setting.
export function stripeSecretKeys(mode: StripeMode): {
  secretKey: RuntimeSecretKey;
  publishableKey: RuntimeSecretKey;
  webhookSecret: RuntimeSecretKey;
} {
  return mode === "live"
    ? {
        secretKey: "stripe_live_secret_key",
        publishableKey: "stripe_live_publishable_key",
        webhookSecret: "stripe_live_webhook_secret",
      }
    : {
        secretKey: "stripe_secret_key",
        publishableKey: "stripe_publishable_key",
        webhookSecret: "stripe_webhook_secret",
      };
}

type LoadSecrets = () => Promise<StripeSecrets>;
type MakeClient = (secretKey: string) => StripeClientLike;

async function defaultLoadSecrets(): Promise<StripeSecrets> {
  const mode = (await getSetting("stripeMode")) as StripeMode;
  const keys = stripeSecretKeys(mode);
  const [secretKey, webhookSecret] = await Promise.all([
    getSecret(keys.secretKey),
    getSecret(keys.webhookSecret),
  ]);
  return { secretKey, webhookSecret };
}

const defaultMakeClient: MakeClient = (secretKey) =>
  new Stripe(secretKey) as unknown as StripeClientLike;

// Prefer the live request origin; fall back to the configured app URL.
function resolveBaseUrl(baseUrl?: string): string {
  return (baseUrl || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

// Stripe Checkout (Cards + FPX + GrabPay, MYR). Enabled methods are controlled
// from the Stripe Dashboard, so the session omits payment_method_types. Secrets
// live in the admin Settings (getSecret), never env. Stripe-only: createCheckout
// throws when unconfigured — there is no fake fallback.
export class StripePayment implements Payment {
  constructor(
    private loadSecrets: LoadSecrets = defaultLoadSecrets,
    private makeClient: MakeClient = defaultMakeClient,
  ) {}

  async createCheckout(
    order: CheckoutOrder,
    baseUrl?: string,
  ): Promise<{ url: string; id: string }> {
    const { secretKey } = await this.loadSecrets();
    if (!secretKey) throw new Error("Stripe is not configured.");
    const base = resolveBaseUrl(baseUrl);
    const stripe = this.makeClient(secretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: order.customerEmail,
      metadata: { orderNumber: order.orderNumber },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "myr",
            unit_amount: order.totalSen,
            product_data: { name: `CRAZYWORK order ${order.orderNumber}` },
          },
        },
      ],
      success_url: `${base}/checkout/success?order=${encodeURIComponent(order.orderNumber)}`,
      cancel_url: `${base}/cart`,
    });
    if (!session.url) throw new Error("Stripe did not return a checkout URL.");
    return { url: session.url, id: session.id };
  }

  async verifyWebhook(req: Request): Promise<PaidEvent | null> {
    const { secretKey, webhookSecret } = await this.loadSecrets();
    if (!secretKey || !webhookSecret) return null;
    const signature = req.headers.get("stripe-signature");
    if (!signature) return null;

    const payload = await req.text();
    const stripe = this.makeClient(secretKey);
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch {
      return null; // bad signature or malformed payload
    }
    if (event.type !== "checkout.session.completed") return null;

    const session = event.data.object as Stripe.Checkout.Session;
    const orderNumber = session.metadata?.orderNumber;
    if (!orderNumber) return null;
    const reference =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? session.id);
    return {
      orderNumber,
      paymentMethod: "stripe",
      reference,
      test: !secretKey.startsWith("sk_live"),
    };
  }

  // Real connectivity check for the admin "Test" button: pings Stripe with the
  // active mode's secret key. A successful balance fetch proves the key is valid.
  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    const { secretKey } = await this.loadSecrets();
    if (!secretKey) {
      return { ok: false, message: "No secret key saved for this mode." };
    }
    const mode = secretKey.startsWith("sk_live") ? "live" : "test";
    try {
      await this.makeClient(secretKey).balance.retrieve();
      return { ok: true, message: `Connected to Stripe (${mode} mode).` };
    } catch {
      return { ok: false, message: "Stripe rejected this secret key." };
    }
  }
}

export const payment = new StripePayment();
