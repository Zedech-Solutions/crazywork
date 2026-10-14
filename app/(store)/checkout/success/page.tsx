import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getSecret } from "@/lib/secrets";
import { getCheckoutSuccessContent } from "@/lib/content";
import { CheckoutSuccess } from "./success-client";
import PurchaseEvent, {
  type PurchaseData,
} from "./purchase-event";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string | string[];
  }>;
}) {
  const content = await getCheckoutSuccessContent();
  const params = await searchParams;
  const sessionId = params.session_id;

  let purchase: PurchaseData | null = null;

  if (
    typeof sessionId === "string" &&
    sessionId.startsWith("cs_live_")
  ) {
    try {
      const secret = await getSecret("stripe_live_secret_key");

      if (secret) {
        const stripe = new Stripe(secret);
        const session =
          await stripe.checkout.sessions.retrieve(sessionId);

        const orderNumber = session.metadata?.orderNumber;

        if (
          session.livemode &&
          session.mode === "payment" &&
          session.status === "complete" &&
          session.payment_status === "paid" &&
          session.currency === "myr" &&
          session.amount_total !== null &&
          orderNumber
        ) {
          const order = await prisma.order.findUnique({
            where: { orderNumber },
            select: {
              orderNumber: true,
              total: true,
              items: {
                select: {
                  productId: true,
                  quantity: true,
                  unitPrice: true,
                },
              },
            },
          });

          if (
            order &&
            Math.round(Number(order.total) * 100) ===
              session.amount_total
          ) {
            purchase = {
              orderNumber: order.orderNumber,
              value: session.amount_total / 100,
              contents: order.items.map((item) => ({
                id: item.productId,
                quantity: item.quantity,
                item_price: Number(item.unitPrice),
              })),
            };
          }
        }
      }
    } catch {
      console.error("Could not verify Meta purchase tracking.");
    }
  }

  return (
    <>
      <CheckoutSuccess content={content} />
      {purchase && <PurchaseEvent purchase={purchase} />}
    </>
  );
}
