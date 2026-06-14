import { describe, expect, test } from "vitest";
import { StripePayment, stripeSecretKeys } from "@/lib/integrations/payment";

const SECRETS = { secretKey: "sk_test_123", webhookSecret: "whsec_test_123" };

interface FakeOpts {
  session?: { id: string; url: string | null };
  event?: unknown;
  constructThrows?: boolean;
  balanceThrows?: boolean;
}

function fakeStripe(opts: FakeOpts = {}) {
  const calls = {
    sessions: [] as Record<string, unknown>[],
    constructEvent: [] as { payload: string; sig: string; secret: string }[],
    balance: [] as true[],
  };
  const client = {
    calls,
    checkout: {
      sessions: {
        create: async (params: Record<string, unknown>) => {
          calls.sessions.push(params);
          return opts.session ?? { id: "cs_test_1", url: "https://stripe.test/pay/cs_test_1" };
        },
      },
    },
    webhooks: {
      constructEvent: (payload: string, sig: string, secret: string) => {
        calls.constructEvent.push({ payload, sig, secret });
        if (opts.constructThrows) throw new Error("bad signature");
        return opts.event;
      },
    },
    balance: {
      retrieve: async () => {
        calls.balance.push(true);
        if (opts.balanceThrows) throw new Error("Invalid API Key provided");
        return { available: [] };
      },
    },
  };
  return client;
}

describe("stripeSecretKeys", () => {
  test("test mode → the unprefixed sandbox key names", () => {
    expect(stripeSecretKeys("test")).toEqual({
      secretKey: "stripe_secret_key",
      publishableKey: "stripe_publishable_key",
      webhookSecret: "stripe_webhook_secret",
    });
  });

  test("live mode → the stripe_live_* key names", () => {
    expect(stripeSecretKeys("live")).toEqual({
      secretKey: "stripe_live_secret_key",
      publishableKey: "stripe_live_publishable_key",
      webhookSecret: "stripe_live_webhook_secret",
    });
  });
});

function paymentWith(
  client: ReturnType<typeof fakeStripe>,
  secrets: { secretKey: string | null; webhookSecret: string | null } = SECRETS,
) {
  return new StripePayment(async () => secrets, () => client as never);
}

const ORDER = {
  orderNumber: "CW-260614-ABCD",
  totalSen: 12900,
  customerEmail: "buyer@example.com",
};

describe("StripePayment.createCheckout", () => {
  test("creates an MYR Checkout Session and returns the hosted url + id", async () => {
    const client = fakeStripe();
    const { url, id } = await paymentWith(client).createCheckout(ORDER);

    expect(client.calls.sessions).toHaveLength(1);
    const params = client.calls.sessions[0] as Record<string, any>;
    expect(params.mode).toBe("payment");
    expect(params.metadata.orderNumber).toBe(ORDER.orderNumber);
    expect(params.customer_email).toBe(ORDER.customerEmail);
    const line = params.line_items[0];
    expect(line.price_data.currency).toBe("myr");
    expect(line.price_data.unit_amount).toBe(ORDER.totalSen);
    expect(line.quantity).toBe(1);
    expect(params.success_url).toContain(ORDER.orderNumber);
    expect(params.cancel_url).toContain("/cart");

    expect(id).toBe("cs_test_1");
    expect(url).toBe("https://stripe.test/pay/cs_test_1");
  });

  test("anchors success/cancel URLs to the passed request origin", async () => {
    const client = fakeStripe();
    await paymentWith(client).createCheckout(ORDER, "http://localhost:3002");
    const params = client.calls.sessions[0] as Record<string, any>;
    expect(params.success_url).toBe(
      `http://localhost:3002/checkout/success?order=${ORDER.orderNumber}`,
    );
    expect(params.cancel_url).toBe("http://localhost:3002/cart");
  });

  test("throws when stripe_secret_key is unconfigured (Stripe-only, no fallback)", async () => {
    const client = fakeStripe();
    const unconfigured = paymentWith(client, {
      secretKey: null,
      webhookSecret: null,
    });
    await expect(unconfigured.createCheckout(ORDER)).rejects.toThrow(
      /not configured/i,
    );
    expect(client.calls.sessions).toHaveLength(0);
  });
});

function webhookReq(body: unknown, sig: string | null = "t=1,v1=sig") {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sig !== null) headers["stripe-signature"] = sig;
  return new Request("http://localhost/api/webhook/payment", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function completedEvent(orderNumber: string, paymentIntent = "pi_test_123") {
  return {
    type: "checkout.session.completed",
    data: { object: { metadata: { orderNumber }, payment_intent: paymentIntent } },
  };
}

describe("StripePayment.verifyWebhook", () => {
  test("returns a PaidEvent for a signature-verified checkout.session.completed", async () => {
    const client = fakeStripe({ event: completedEvent(ORDER.orderNumber) });
    const result = await paymentWith(client).verifyWebhook(webhookReq({ raw: 1 }));

    expect(result).toEqual({
      orderNumber: ORDER.orderNumber,
      paymentMethod: "stripe",
      reference: "pi_test_123",
      test: true,
    });
    // signature was checked with the webhook secret + the request's signature header
    expect(client.calls.constructEvent).toHaveLength(1);
    expect(client.calls.constructEvent[0].secret).toBe(SECRETS.webhookSecret);
    expect(client.calls.constructEvent[0].sig).toBe("t=1,v1=sig");
  });

  test("flags live-mode payments as test:false (live secret key)", async () => {
    const client = fakeStripe({ event: completedEvent(ORDER.orderNumber) });
    const result = await paymentWith(client, {
      secretKey: "sk_live_999",
      webhookSecret: "whsec_live",
    }).verifyWebhook(webhookReq({}));
    expect(result?.test).toBe(false);
  });

  test("returns null when the signature fails verification", async () => {
    const client = fakeStripe({ constructThrows: true });
    const result = await paymentWith(client).verifyWebhook(webhookReq({}));
    expect(result).toBeNull();
  });

  test("ignores non-checkout.session.completed events", async () => {
    const client = fakeStripe({
      event: { type: "payment_intent.created", data: { object: {} } },
    });
    const result = await paymentWith(client).verifyWebhook(webhookReq({}));
    expect(result).toBeNull();
  });

  test("returns null when the stripe-signature header is absent", async () => {
    const client = fakeStripe({ event: completedEvent(ORDER.orderNumber) });
    const result = await paymentWith(client).verifyWebhook(
      webhookReq({}, null),
    );
    expect(result).toBeNull();
    expect(client.calls.constructEvent).toHaveLength(0);
  });

  test("returns null when Stripe is unconfigured", async () => {
    const client = fakeStripe({ event: completedEvent(ORDER.orderNumber) });
    const result = await paymentWith(client, {
      secretKey: null,
      webhookSecret: null,
    }).verifyWebhook(webhookReq({}));
    expect(result).toBeNull();
    expect(client.calls.constructEvent).toHaveLength(0);
  });
});

describe("StripePayment.verifyConnection", () => {
  test("ok when Stripe accepts the key (reports the mode from the key prefix)", async () => {
    const client = fakeStripe();
    const result = await paymentWith(client).verifyConnection();
    expect(result.ok).toBe(true);
    expect(result.message).toMatch(/test/i);
    expect(client.calls.balance).toHaveLength(1);
  });

  test("not ok when no secret key is saved (no Stripe call)", async () => {
    const client = fakeStripe();
    const result = await paymentWith(client, {
      secretKey: null,
      webhookSecret: null,
    }).verifyConnection();
    expect(result.ok).toBe(false);
    expect(client.calls.balance).toHaveLength(0);
  });

  test("not ok when Stripe rejects the key", async () => {
    const client = fakeStripe({ balanceThrows: true });
    const result = await paymentWith(client).verifyConnection();
    expect(result.ok).toBe(false);
  });
});
