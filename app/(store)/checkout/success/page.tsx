"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { useCart } from "@/components/cart/cart-context";

function SuccessInner() {
  const params = useSearchParams();
  const cart = useCart();
  const orderNumber = params.get("order");
  const isFake = params.get("fake") === "1";
  const [state, setState] = useState<"working" | "done" | "failed">(
    isFake && orderNumber ? "working" : "done",
  );
  const fired = useRef(false);

  useEffect(() => {
    if (!isFake || !orderNumber || fired.current) return;
    fired.current = true;
    // Stub payment: drive the same paid transition a real webhook would.
    fetch("/api/checkout/fake-paid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderNumber }),
    })
      .then((res) => setState(res.ok ? "done" : "failed"))
      .catch(() => setState("failed"));
    cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFake, orderNumber]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <p className="eyebrow text-ember">Order confirmed</p>
      <h1 className="headline mt-2 text-7xl">
        {state === "failed" ? "Hmm." : "Earned."}
      </h1>
      {state === "failed" ? (
        <p className="mt-4 text-sm text-brown">
          Payment confirmation didn&apos;t go through — check{" "}
          <Link href="/orders/lookup" className="text-ember underline">
            order lookup
          </Link>{" "}
          or contact us.
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm text-brown">
            {orderNumber ? (
              <>
                Order <span className="font-bold text-ink">{orderNumber}</span> is in.
              </>
            ) : (
              "Your order is in."
            )}{" "}
            A confirmation email is on the way. We pack, you train.
          </p>
        </>
      )}
      <div className="mt-10 flex justify-center gap-3">
        <Button asChild variant="accent">
          <Link href="/shop">Keep shopping</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/orders/lookup">Track order</Link>
        </Button>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense>
      <SuccessInner />
    </Suspense>
  );
}
