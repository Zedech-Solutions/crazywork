"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  discounts: { label: string; amount: number; source: string }[];
  shippingFee: number;
  freeShippingApplied: boolean;
  total: number;
}

// The cart lives in its own localStorage store (crazywork-cart). This holds the
// rest of the checkout — delivery form + applied code — so the whole attempt
// survives a login round-trip.
const CHECKOUT_KEY = "crazywork-checkout";
const CHECKOUT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // drop stale saved details after a week
const UPSELL_KEY = "crazywork-checkout-upsell-seen";

export default function CheckoutPage() {
  const cart = useCart();
  const { data: session } = useSession();
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    postcode: "",
    city: "",
    state: "Selangor",
  });
  const [code, setCode] = useState("");
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [upsell, setUpsell] = useState<string | null>(null);
  const [upsellPercent, setUpsellPercent] = useState<number | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const upsellShown = useRef(false);
  const hydrated = useRef(false);
  const pendingCode = useRef<string | null>(null);

  // Restore a saved checkout — after leaving to add items, or being sent to log
  // in before applying a code. localStorage (not sessionStorage) so it survives
  // the OAuth redirect and a closed tab. A restored code is held in pendingCode
  // and auto-applied once the user is logged in (guests still can't apply).
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CHECKOUT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        const fresh = !parsed.ts || Date.now() - parsed.ts < CHECKOUT_TTL_MS;
        if (!fresh) {
          localStorage.removeItem(CHECKOUT_KEY);
        } else {
          if (parsed.form) setForm((f) => ({ ...f, ...parsed.form }));
          if (parsed.code) {
            setCode(parsed.code);
            pendingCode.current = parsed.code;
          }
        }
      }
    } catch {
      // ignore corrupt storage
    }
    upsellShown.current = sessionStorage.getItem(UPSELL_KEY) === "1";
    hydrated.current = true;
  }, []);

  // Persist form + code so navigating away (or logging in) and back keeps them.
  useEffect(() => {
    if (hydrated.current)
      localStorage.setItem(
        CHECKOUT_KEY,
        JSON.stringify({ form, code, ts: Date.now() }),
      );
  }, [form, code]);

  useEffect(() => {
    if (!session?.user) return;
    setForm((f) =>
      f.email
        ? f
        : {
            ...f,
            email: session.user.email,
            name: f.name || (session.user.name ?? ""),
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const zone = zoneForState(form.state);
  const items = cart.lines.map((l) => ({
    variantId: l.variantId,
    quantity: l.quantity,
  }));
  const itemsKey = JSON.stringify(items);
  // One idempotency key per distinct cart — stable across double-clicks and
  // network retries of the same order, fresh when the cart changes. Stops a
  // second click from creating a duplicate order (and a duplicate stock hold).
  const idempotencyKey = useMemo(
    () => globalThis.crypto?.randomUUID?.() ?? `idem-${Date.now()}`,
    [itemsKey],
  );

  const refreshQuote = useCallback(
    async (withCode: string | null) => {
      if (items.length === 0) return;
      const priceFor = async (codeToTry: string | null) => {
        const res = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items,
            shippingZone: zone,
            code: codeToTry,
            email: form.email,
          }),
        });
        return res.json();
      };

      const body = await priceFor(withCode);
      if (body.ok) {
        setQuote(body.pricing);
        setAppliedCode(withCode);
        setCodeError(null);
      } else if (body.error === "invalid_code") {
        // Show why the code was rejected, but keep pricing correct (no code).
        setCodeError(body.message ?? "That code can't be applied.");
        setAppliedCode(null);
        const noCode = await priceFor(null);
        if (noCode.ok) setQuote(noCode.pricing);
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

  // Came back from logging in with a code they'd entered as a guest — apply it
  // now that they're allowed to. Server re-validates it against their account.
  useEffect(() => {
    if (session?.user && pendingCode.current && cart.lines.length > 0) {
      const c = pendingCode.current;
      pendingCode.current = null;
      refreshQuote(c.trim() || null);
    }
  }, [session, cart.lines.length, refreshQuote]);

  async function placeOrder() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
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
      localStorage.removeItem(CHECKOUT_KEY); // order placed — don't restore it
      window.location.href = body.url;
    } catch {
      setSubmitError("Network problem — try again.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!upsellShown.current) {
      // Show the upsell at most once per session — not on a repeat checkout.
      upsellShown.current = true;
      sessionStorage.setItem(UPSELL_KEY, "1");
      try {
        const res = await fetch("/api/checkout/upsell", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items }),
        });
        const body = await res.json();
        if (body.show) {
          setUpsell(body.message);
          setUpsellPercent(typeof body.percent === "number" ? body.percent : null);
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
            <Input id="co-phone" type="tel" placeholder="0123456789" {...field("phone")} />
          </div>
          <div>
            <Label htmlFor="co-address">Address</Label>
            <Input id="co-address" required placeholder="Street, unit, building" {...field("address")} />
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="co-postcode">Postcode</Label>
              <Input
                id="co-postcode"
                required
                inputMode="numeric"
                placeholder="50450"
                {...field("postcode")}
              />
            </div>
            <div>
              <Label htmlFor="co-city">City</Label>
              <Input
                id="co-city"
                required
                placeholder="Kuala Lumpur"
                {...field("city")}
              />
            </div>
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
                onClick={() => {
                  if (!session?.user) {
                    setLoginPrompt(true);
                    return;
                  }
                  refreshQuote(code.trim() || null);
                }}
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
              {quote.discounts && quote.discounts.length > 0
                ? quote.discounts.map((d, i) => (
                    <p key={i} className="flex justify-between text-ember">
                      <span>Discount — {d.label}</span>
                      <span>−{formatRM(d.amount)}</span>
                    </p>
                  ))
                : quote.discountAmount > 0 && (
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
          {upsellPercent != null && (
            <p className="mt-2 inline-block rounded-full bg-ember px-4 py-1.5 subhead text-sm text-peach">
              Save {upsellPercent}% off
            </p>
          )}
          <DialogTitle className="headline mt-2 text-4xl">{upsell}</DialogTitle>
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

      {/* LOG-IN PROMPT — codes are tied to an account, so guests sign in first */}
      <DialogPrimitive.Root open={loginPrompt} onOpenChange={setLoginPrompt}>
        <DialogContent aria-describedby={undefined}>
          <p className="eyebrow text-ember">One step first</p>
          <DialogTitle className="headline mt-2 text-4xl">
            Log in to use a code.
          </DialogTitle>
          <p className="mt-3 text-sm text-brown">
            Discount codes are locked to your account. Sign in and we&apos;ll
            bring you right back to your checkout.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="flex-1">
              <Link href="/auth/sign-up?redirect=/checkout">Create account</Link>
            </Button>
            <Button asChild variant="accent" className="flex-1">
              <Link href="/auth/sign-in?redirect=/checkout">Sign in →</Link>
            </Button>
          </div>
        </DialogContent>
      </DialogPrimitive.Root>
    </div>
  );
}
