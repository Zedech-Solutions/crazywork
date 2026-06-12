"use client";

import { Pencil, ShoppingBag, User } from "lucide-react";
import { cn } from "@/lib/utils";

// Shared building blocks for the live page previews (home, mindset, drops, …).
export function Hotspot({
  label,
  region,
  onEdit,
}: {
  label: string;
  region: string;
  onEdit?: (r: string) => void;
}) {
  if (!onEdit) return null;
  return (
    <button
      type="button"
      onClick={() => onEdit(region)}
      className="absolute right-2 top-2 z-20 inline-flex items-center gap-1 rounded-full bg-ember px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-peach shadow-lg transition-transform hover:scale-105"
    >
      <Pencil size={11} /> {label}
    </button>
  );
}

export function Region({
  children,
  className,
  editable,
}: {
  children: React.ReactNode;
  className?: string;
  editable?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative",
        editable &&
          "outline-2 outline-transparent transition-[outline-color] hover:outline-dashed hover:outline-ember/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

const NAV = ["Shop", "Drops", "Collab", "Mindset", "Our Story", "Community", "Blog"];

// Static announcement bar + nav skeleton, used by the non-home previews where
// those are not editable (they're edited on the Home tab).
export function PreviewChrome() {
  return (
    <>
      <div className="bg-ember px-4 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-peach">
        Free shipping over RM150
      </div>
      <header className="flex h-12 items-center justify-between border-b border-warmgrey px-4">
        <span className="headline text-lg tracking-[0.15em]">CRAZYWORK</span>
        <nav className="hidden gap-4 md:flex">
          {NAV.map((n) => (
            <span key={n} className="eyebrow text-[9px] text-ink">
              {n}
            </span>
          ))}
        </nav>
        <div className="flex gap-3 text-ink">
          <User size={15} />
          <ShoppingBag size={15} />
        </div>
      </header>
    </>
  );
}

export function PreviewFooter({ tagline, blurb }: { tagline: string; blurb: string }) {
  return (
    <footer className="bg-ink px-6 py-10 text-peach">
      <p className="headline text-3xl tracking-[0.15em]">CRAZYWORK</p>
      <p className="mt-1 eyebrow text-ember">{tagline}</p>
      <p className="mt-3 max-w-xs text-xs text-peach/60">{blurb}</p>
    </footer>
  );
}
