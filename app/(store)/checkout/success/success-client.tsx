"use client";

import { Suspense, useEffect, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/admin/copy-button";
import { useCart } from "@/components/cart/cart-context";
import type { CheckoutSuccessContent } from "@/lib/content";

function SuccessInner({ content }: { content: CheckoutSuccessContent }) {
  const params = useSearchParams();
  const cart = useCart();
  const orderNumber = params.get("order");
  const cleared = useRef(false);

  // Stripe redirects here after a successful payment; the order is marked paid
  // out-of-band by the signed webhook. Just clear the cart once on arrival.
  useEffect(() => {
    if (cleared.current) return;
    cleared.current = true;
    cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasImage = Boolean(content.backgroundImage);

  return (
    <section className="relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-24">
      {/* Blurred background — uploaded image, or a soft white wash by default. */}
      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={content.backgroundImage}
          alt=""
          aria-hidden
          className="absolute inset-0 -z-10 h-full w-full scale-110 object-cover blur-2xl brightness-95"
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-white"
        >
          <div className="absolute left-1/2 top-1/3 h-[60vh] w-[60vh] -translate-x-1/2 rounded-full bg-ember/25 blur-3xl" />
          <div className="absolute bottom-0 right-1/4 h-[40vh] w-[40vh] rounded-full bg-sand/60 blur-3xl" />
        </div>
      )}

      {/* Frosted card */}
      <div className="w-full max-w-xl rounded-3xl border border-ink/10 bg-white/55 px-8 py-12 text-center shadow-[0_20px_60px_-20px_rgba(26,26,26,0.35)] backdrop-blur-md">
        <p className="eyebrow text-ember">Order confirmed</p>
        <h1 className="headline mt-2 text-7xl text-ink">{content.heading}</h1>
        <p className="mt-4 text-sm text-brown">
          {orderNumber ? (
            <>
              Order{" "}
              <span className="inline-flex items-center gap-1 align-middle font-bold text-ink">
                {orderNumber}
                <CopyButton value={orderNumber} label="order number" iconOnly />
              </span>{" "}
              is in.{" "}
            </>
          ) : (
            "Your order is in. "
          )}
          {content.subheading}
        </p>
        <div className="mt-10 flex justify-center gap-3">
          <Button asChild variant="accent">
            <Link href="/shop">Keep shopping</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/orders/lookup">Track order</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function CheckoutSuccess({ content }: { content: CheckoutSuccessContent }) {
  return (
    <Suspense>
      <SuccessInner content={content} />
    </Suspense>
  );
}
