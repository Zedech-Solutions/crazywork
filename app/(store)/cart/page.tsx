"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea, Label } from "@/components/ui/field";
import { useCart } from "@/components/cart/cart-context";
import { formatRM } from "@/lib/money";

export default function CartPage() {
  const cart = useCart();

  if (cart.lines.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="headline text-6xl text-warmgrey">Cart&apos;s empty.</h1>
        <p className="mt-3 text-sm text-brown">The work doesn&apos;t do itself.</p>
        <Button asChild variant="accent" size="lg" className="mt-8">
          <Link href="/shop">Shop the drop</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="headline text-6xl">Your Cart</h1>
      <div className="mt-8 grid gap-10 lg:grid-cols-[3fr_2fr]">
        <ul className="space-y-5">
          {cart.lines.map((line) => (
            <li key={line.variantId} className="flex gap-4 border-b border-sand pb-5">
              <Link
                href={`/product/${line.slug}`}
                className="relative h-32 w-26 shrink-0 overflow-hidden bg-ink"
              >
                {line.image && (
                  <Image src={line.image} alt={line.name} fill sizes="104px" className="object-cover" />
                )}
              </Link>
              <div className="flex flex-1 flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="subhead text-lg">{line.name}</p>
                    <p className="mt-0.5 text-xs text-brown">
                      {line.size} / {line.colour} · {formatRM(line.unitPriceSen)}
                    </p>
                  </div>
                  <button
                    aria-label={`Remove ${line.name}`}
                    onClick={() => cart.removeLine(line.variantId)}
                    className="text-warmgrey hover:text-ember cursor-pointer"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center border border-warmgrey">
                    <button
                      aria-label="Decrease quantity"
                      className="px-2.5 py-1.5 hover:text-ember cursor-pointer"
                      onClick={() => cart.setQuantity(line.variantId, line.quantity - 1)}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center text-sm font-medium">
                      {line.quantity}
                    </span>
                    <button
                      aria-label="Increase quantity"
                      className="px-2.5 py-1.5 hover:text-ember cursor-pointer disabled:opacity-30"
                      disabled={line.quantity >= line.maxStock}
                      onClick={() => cart.setQuantity(line.variantId, line.quantity + 1)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="font-bold">{formatRM(line.unitPriceSen * line.quantity)}</p>
                </div>
              </div>
            </li>
          ))}
        </ul>

        <aside className="h-fit border border-warmgrey bg-sand/50 p-6">
          <p className="subhead text-xl">Summary</p>
          <div className="mt-4 flex justify-between text-sm">
            <span className="text-brown">Subtotal</span>
            <span className="font-bold">{formatRM(cart.subtotalSen)}</span>
          </div>
          <p className="mt-2 text-xs text-brown">
            Tax included · Shipping &amp; discounts calculated at checkout
          </p>
          <div className="mt-5">
            <Label htmlFor="cart-note">Order note</Label>
            <Textarea
              id="cart-note"
              placeholder="Sizing requests, delivery instructions…"
              value={cart.note}
              onChange={(e) => cart.setNote(e.target.value)}
            />
          </div>
          <Button asChild variant="accent" size="lg" className="mt-5 w-full">
            <Link href="/checkout">Checkout · {formatRM(cart.subtotalSen)}</Link>
          </Button>
          <Link
            href="/shop"
            className="mt-3 block text-center eyebrow text-brown hover:text-ember"
          >
            Continue shopping
          </Link>
        </aside>
      </div>
    </div>
  );
}
