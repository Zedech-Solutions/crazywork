"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { AdminNav } from "./admin-nav";

// Mobile-only nav: a hamburger that opens the sidebar as a left overlay drawer,
// so it floats above content instead of taking layout width.
export function AdminMobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  // lock body scroll while the drawer is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink hover:bg-ink/5"
      >
        <Menu size={20} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-64 max-w-[80vw] flex-col bg-ink p-5 text-peach shadow-2xl">
            <div className="flex items-start justify-between">
              <Link href="/admin" onClick={() => setOpen(false)}>
                <span className="headline block text-xl tracking-[0.15em]">
                  CRAZYWORK
                </span>
                <span className="eyebrow mt-0.5 block text-ember">Admin</span>
              </Link>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="text-peach/60 hover:text-peach"
              >
                <X size={20} />
              </button>
            </div>
            <AdminNav />
            <Link
              href="/"
              className="mt-6 block rounded-lg px-3 py-2 text-xs text-peach/50 transition-colors hover:bg-peach/10 hover:text-ember"
            >
              ← Back to store
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
