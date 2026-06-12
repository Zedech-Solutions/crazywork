"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(isActive(item.href))}
              >
                {item.label}
              </Link>
            ))}
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
