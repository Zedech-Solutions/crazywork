"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input, Label, Select } from "@/components/ui/field";
import { useCart } from "@/components/cart/cart-context";
import { useSession } from "@/lib/auth-client";
import { formatRM } from "@/lib/money";
import { ALL_STATES, zoneForState } from "@/lib/states";

interface Quote {
  subtotal: number;
  discountAmount: number;
  discountLabel: string | null;
  shippingFee: number;
  freeShippingApplied: boolean;
  total: number;
}

export default function CheckoutPage() {
  const cart = useCart();
  const { data: session } = useSession();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    state: "Selangor",
  });
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<string | null>(null);
  const upsellShown = useRef(false);

  useEffect(() => {
    if (session?.user && !form.email) {
      setForm((f) => ({
        ...f,
        email: session.user.email,
        name: f.name || (session.user.name ?? ""),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const zone = zoneForState(form.state);
  const items = cart.lines.map((l) => ({
    variantId: l.variantId,
    quantity: l.quantity,
  }));
  const itemsKey = JSON.stringify(items);

  const refreshQuote = useCallback(
    async (withCode: string | null) => {
      if (items.length === 0) return;
      setCodeError(null);
      const res = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          shippingZone: zone,
          code: withCode,
          email: form.email,
        }),
      });
      const body = await res.json();
      if (body.ok) {
        setQuote(body.pricing);
        setAppliedCode(withCode);
      } else if (body.error === "invalid_code") {
        setCodeError(body.message);
        setAppliedCode(null);
        refreshQuote(null);
      } else {
        setQuote(null);
        setSubmitError(body.message ?? "Cart problem — please review.");
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsKey, zone, form.email],
  );

  useEffect(() => {
    refreshQuote(appliedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey, zone]);

  async function placeOrder() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          shippingZone: zone,
          code: appliedCode,
          customer: { ...form },
          orderNote: cart.note || null,
        }),
      });
      const body = await res.json();
      if (!body.ok) {
        setSubmitError(body.message ?? "Could not place the order.");
        setSubmitting(false);
        return;
      }
      window.location.href = body.url;
    } catch {
      setSubmitError("Network problem — try again.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!upsellShown.current) {
      upsellShown.current = true; // once per checkout attempt, never blocks
      try {
        const res = await fetch("/api/checkout/upsell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const body = await res.json();
        if (body.show) {
          setUpsell(body.message);
          return;
        }
      } catch {
        // upsell is best-effort
      }
    }
    await placeOrder();
  }

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="headline text-5xl text-warmgrey">Nothing to check out.</h1>
        <Button asChild variant="accent" className="mt-8">
          <Link href="/shop">Back to the shop</Link>
        </Button>
      </div>
    );
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    ) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="headline text-6xl">Checkout</h1>
      <form onSubmit={handleSubmit} className="mt-8 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="co-name">Full name</Label>
              <Input id="co-name" required {...field("name")} />
            </div>
            <div>
              <Label htmlFor="co-email">Email</Label>
              <Input id="co-email" type="email" required {...field("email")} />
            </div>
          </div>
          <div>
            <Label htmlFor="co-phone">Phone</Label>
            <Input id="co-phone" type="tel" placeholder="01X-XXXXXXX" {...field("phone")} />
          </div>
          <div>
            <Label htmlFor="co-address">Address</Label>
            <Input id="co-address" required placeholder="Street, unit, postcode, city" {...field("address")} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="co-state">State</Label>
              <Select id="co-state" {...field("state")}>
                {ALL_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Shipping zone</Label>
              <p className="border border-warmgrey bg-sand px-3 py-2.5 text-sm capitalize">
                {zone} Malaysia
              </p>
            </div>
          </div>
          <div>
            <Label htmlFor="co-code">Discount code</Label>
            <div className="flex gap-2">
              <Input
                id="co-code"
                placeholder="CRAZY…"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => refreshQuote(code.trim() || null)}
              >
                Apply
              </Button>
            </div>
            {codeError && <p className="mt-1.5 text-xs text-red-700">{codeError}</p>}
            {appliedCode && quote?.discountLabel === appliedCode && (
              <p className="mt-1.5 text-xs text-ember">Code {appliedCode} applied.</p>
            )}
          </div>
        </div>

        <aside className="h-fit border border-warmgrey bg-sand/50 p-6">
          <p className="subhead text-xl">Order Summary</p>
          <ul className="mt-4 space-y-2 text-sm">
            {cart.lines.map((l) => (
              <li key={l.variantId} className="flex justify-between gap-3">
                <span className="text-brown">
                  {l.quantity}× {l.name} ({l.size}/{l.colour})
                </span>
                <span>{formatRM(l.unitPriceSen * l.quantity)}</span>
              </li>
            ))}
          </ul>
          {quote && (
            <div className="mt-4 space-y-1.5 border-t border-warmgrey pt-4 text-sm">
              <p className="flex justify-between">
                <span className="text-brown">Subtotal</span>
                <span>{formatRM(quote.subtotal)}</span>
              </p>
              {quote.discountAmount > 0 && (
                <p className="flex justify-between text-ember">
                  <span>Discount — {quote.discountLabel}</span>
                  <span>−{formatRM(quote.discountAmount)}</span>
                </p>
              )}
              <p className="flex justify-between">
                <span className="text-brown">
                  Shipping ({zone}){quote.freeShippingApplied ? " · free" : ""}
                </span>
                <span>
                  {quote.shippingFee === 0 ? "FREE" : formatRM(quote.shippingFee)}
                </span>
              </p>
              <p className="flex justify-between border-t border-warmgrey pt-2 text-base font-bold">
                <span>Total</span>
                <span>{formatRM(quote.total)}</span>
              </p>
            </div>
          )}
          {submitError && <p className="mt-3 text-xs text-red-700">{submitError}</p>}
          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="mt-5 w-full"
            disabled={submitting || !quote}
          >
            {submitting ? "Placing order…" : `Pay ${quote ? formatRM(quote.total) : ""}`}
          </Button>
          <p className="mt-3 text-center text-[11px] text-brown">
            Stub payment — cards/FPX/GrabPay wired at launch
          </p>
        </aside>
      </form>

      {/* PRE-CHECKOUT UPSELL — once per attempt, never blocks */}
      <DialogPrimitive.Root
        open={upsell !== null}
        onOpenChange={(open) => !open && setUpsell(null)}
      >
        <DialogContent aria-describedby={undefined}>
          <p className="eyebrow text-ember">Almost there</p>
          <DialogTitle className="headline mt-1 text-4xl">{upsell}</DialogTitle>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/shop">Add more</Link>
            </Button>
            <Button
              variant="accent"
              className="flex-1"
              onClick={() => {
                setUpsell(null);
                placeOrder();
              }}
            >
              Continue to checkout →
            </Button>
          </div>
        </DialogContent>
      </DialogPrimitive.Root>
    </div>
  );
}
