"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminFetch } from "@/components/admin/api";
import { formatRM } from "@/lib/money";
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
      { href: "/admin/content", label: "Collab" },
      { href: "/admin/community", label: "Community" },
      { href: "/admin/faqs", label: "FAQs" },
    ],
  },
];

const SETTINGS = { href: "/admin/settings", label: "Settings" };

export function AdminNav() {
  const pathname = usePathname();
  const [lowStock, setLowStock] = useState(0);
  const [newOrders, setNewOrders] = useState(0);
  const [newOrdersTotal, setNewOrdersTotal] = useState(0);

  // Sidebar badges — re-checked on navigation so they reflect recent activity.
  useEffect(() => {
    adminFetch<{ count: number }>("/low-stock-count")
      .then((r) => setLowStock(r.count))
      .catch(() => {});
    adminFetch<{ count: number; totalSen: number }>("/new-orders-count")
      .then((r) => {
        setNewOrders(r.count);
        setNewOrdersTotal(r.totalSen);
      })
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
              let badge: number | null = null;
              let badgeTitle = "";
              let badgeTone = "bg-ember"; // new orders
              if (item.href === "/admin/products" && lowStock > 0) {
                badge = lowStock;
                badgeTitle = `${lowStock} item${lowStock === 1 ? "" : "s"} low on stock`;
                badgeTone = "bg-red-600"; // low stock — needs restocking
              } else if (item.href === "/admin/orders" && newOrders > 0) {
                badge = newOrders;
                badgeTitle = `${newOrders} new paid order${newOrders === 1 ? "" : "s"} · ${formatRM(newOrdersTotal)} paid`;
              }
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
                      title={badgeTitle}
                      className={cn(
                        "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold leading-none text-peach",
                        badgeTone,
                      )}
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
