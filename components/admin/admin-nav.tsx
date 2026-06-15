"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminFetch } from "@/components/admin/api";
import { cn } from "@/lib/utils";

const GROUPS: { label?: string; items: { href: string; label: string }[] }[] = [
  {
    label: "Store",
    items: [
      { href: "/admin", label: "Dashboard" },
      { href: "/admin/orders", label: "Orders" },
      { href: "/admin/customers", label: "Customers" },
      { href: "/admin/products", label: "Products" },
      { href: "/admin/drops", label: "Drops" },
      { href: "/admin/campaigns", label: "Campaigns" },
      { href: "/admin/codes", label: "Promo Codes" },
    ],
  },
  {
    label: "Site",
    items: [
      { href: "/admin/pages", label: "Pages" },
      { href: "/admin/content", label: "Content" },
      { href: "/admin/community", label: "Community" },
      { href: "/admin/faqs", label: "FAQs" },
    ],
  },
];

const SETTINGS = { href: "/admin/settings", label: "Settings" };

export function AdminNav() {
  const pathname = usePathname();
  const [lowStock, setLowStock] = useState(0);

  // Restock badge — re-checked on navigation so it reflects recent stock edits.
  useEffect(() => {
    adminFetch<{ count: number }>("/low-stock-count")
      .then((r) => setLowStock(r.count))
      .catch(() => {});
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const linkClass = (active: boolean) =>
    cn(
      "block rounded-lg px-3 py-2 text-xs font-medium uppercase tracking-[0.15em] transition-colors",
      active
        ? "bg-ember text-peach"
        : "text-peach/60 hover:bg-peach/10 hover:text-peach",
    );

  return (
    <nav className="mt-6 flex flex-1 flex-col overflow-y-auto">
      {GROUPS.map((group) => (
        <div key={group.label} className="mb-4">
          {group.label && (
            <p className="mb-1 px-3 text-[9px] font-bold uppercase tracking-[0.22em] text-peach/30">
              {group.label}
            </p>
          )}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const badge =
                item.href === "/admin/products" && lowStock > 0 ? lowStock : null;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    linkClass(isActive(item.href)),
                    "flex items-center justify-between gap-2",
                  )}
                >
                  <span>{item.label}</span>
                  {badge !== null && (
                    <span
                      title={`${badge} item${badge === 1 ? "" : "s"} low on stock`}
                      className="inline-flex min-w-5 items-center justify-center rounded-full bg-ember px-1.5 text-[10px] font-bold leading-5 text-peach"
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}

      {/* Settings pinned to the bottom */}
      <Link
        href={SETTINGS.href}
        className={cn("mt-auto", linkClass(isActive(SETTINGS.href)))}
      >
        {SETTINGS.label}
      </Link>
    </nav>
  );
}
