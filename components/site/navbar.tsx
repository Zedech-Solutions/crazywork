"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, User, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCart } from "@/components/cart/cart-context";

const LINKS = [
  { href: "/shop", label: "Shop" },
  { href: "/drops", label: "Drops" },
  { href: "/collab", label: "Collab" },
  { href: "/mindset", label: "Mindset" },
  { href: "/our-story", label: "Our Story" },
  { href: "/community", label: "Community" },
];

export function Navbar() {
  const cart = useCart();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-warmgrey bg-peach/95 backdrop-blur-sm">
      <nav className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="headline text-2xl tracking-[0.18em]">
          CRAZYWORK
        </Link>

        <ul className="hidden items-center gap-5 lg:flex lg:gap-6">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={cn(
                  "eyebrow transition-colors hover:text-ember",
                  pathname.startsWith(link.href) ? "text-ember" : "text-ink",
                )}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          <Link
            href="/account"
            aria-label="Account"
            className="hover:text-ember"
          >
            <User size={19} />
          </Link>
          <button
            aria-label="Open cart"
            className="relative cursor-pointer hover:text-ember"
            onClick={cart.openDrawer}
          >
            <ShoppingBag size={19} />
            {cart.count > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center bg-ember px-1 text-[10px] font-bold text-peach">
                {cart.count}
              </span>
            )}
          </button>
          <button
            aria-label="Menu"
            className="cursor-pointer lg:hidden"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </nav>

      {mobileOpen && (
        <div className="lg:hidden">
          {/* Backdrop — dims content and closes on tap. */}
          <button
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 top-14 z-30 cursor-default bg-ink/30"
          />
          {/* Menu floats below the bar instead of pushing content down. */}
          <ul className="absolute inset-x-0 top-full z-40 border-t border-warmgrey bg-peach px-4 py-3 shadow-xl">
            {LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 subhead text-lg hover:text-ember"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
