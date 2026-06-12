"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Minus, Plus, Trash2, X } from "lucide-react";
import { SheetContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { formatRM } from "@/lib/money";
import { useCart } from "./cart-context";

export function CartDrawer() {
  const cart = useCart();
  const router = useRouter();
  const [noteOpen, setNoteOpen] = useState(false);

  return (
    <DialogPrimitive.Root
      open={cart.isOpen}
      onOpenChange={(open) => (open ? cart.openDrawer() : cart.closeDrawer())}
    >
      <SheetContent aria-describedby={undefined}>
        <div className="flex items-center justify-between border-b border-warmgrey px-5 py-4">
          <DialogPrimitive.Title className="subhead text-xl">
            Your Cart{cart.count > 0 ? ` (${cart.count})` : ""}
          </DialogPrimitive.Title>
          <DialogPrimitive.Close
            aria-label="Close cart"
            className="text-brown hover:text-ember cursor-pointer"
          >
            <X size={20} />
          </DialogPrimitive.Close>
        </div>

        {cart.lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
            <p className="headline text-3xl text-warmgrey">Nothing yet.</p>
            <p className="text-sm text-brown">The work doesn&apos;t do itself.</p>
            <Button variant="accent" onClick={cart.closeDrawer} asChild>
              <Link href="/shop">Shop the drop</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <ul className="space-y-4">
                {cart.lines.map((line) => (
                  <li
                    key={line.variantId}
                    className="flex gap-3 border-b border-sand pb-4"
                  >
                    <Link
                      href={`/product/${line.slug}`}
                      onClick={cart.closeDrawer}
                      className="relative h-24 w-20 shrink-0 overflow-hidden bg-ink"
                    >
                      {line.image && (
                        <Image
                          src={line.image}
                          alt={line.name}
                          fill
                          sizes="80px"
                          className="object-cover"
                        />
                      )}
                    </Link>
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="subhead text-sm leading-tight">
                            {line.name}
                          </p>
                          <p className="mt-0.5 text-xs text-brown">
                            {line.size} / {line.colour}
                          </p>
                        </div>
                        <button
                          aria-label={`Remove ${line.name}`}
                          onClick={() => cart.removeLine(line.variantId)}
                          className="text-warmgrey hover:text-ember cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="flex items-center border border-warmgrey">
                          <button
                            aria-label="Decrease quantity"
                            className="px-2 py-1 hover:text-ember cursor-pointer"
                            onClick={() =>
                              cart.setQuantity(line.variantId, line.quantity - 1)
                            }
                          >
                            <Minus size={13} />
                          </button>
                          <span className="w-7 text-center text-sm font-medium">
                            {line.quantity}
                          </span>
                          <button
                            aria-label="Increase quantity"
                            className="px-2 py-1 hover:text-ember cursor-pointer disabled:opacity-30"
                            disabled={line.quantity >= line.maxStock}
                            onClick={() =>
                              cart.setQuantity(line.variantId, line.quantity + 1)
                            }
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                        <p className="text-sm font-bold">
                          {formatRM(line.unitPriceSen * line.quantity)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                className="mt-4 eyebrow text-brown hover:text-ember cursor-pointer"
                onClick={() => setNoteOpen((v) => !v)}
              >
                {noteOpen ? "− Hide order note" : "+ Add order note"}
              </button>
              {noteOpen && (
                <Textarea
                  className="mt-2"
                  placeholder="Sizing requests, delivery instructions…"
                  value={cart.note}
                  onChange={(e) => cart.setNote(e.target.value)}
                />
              )}
            </div>

            <div className="border-t border-warmgrey px-5 py-4">
              <p className="mb-3 text-center text-xs text-brown">
                Tax included · Shipping calculated at checkout
              </p>
              <Button
                variant="accent"
                size="lg"
                className="w-full"
                onClick={() => {
                  cart.closeDrawer();
                  router.push("/checkout");
                }}
              >
                Checkout · {formatRM(cart.subtotalSen)}
              </Button>
              <Link
                href="/cart"
                onClick={cart.closeDrawer}
                className="mt-3 block text-center eyebrow text-brown hover:text-ember"
              >
                View Cart
              </Link>
            </div>
          </>
        )}
      </SheetContent>
    </DialogPrimitive.Root>
  );
}
