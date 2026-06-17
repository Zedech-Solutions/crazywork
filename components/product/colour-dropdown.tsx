"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ColourOption {
  value: string;
  available: boolean;
}

// Custom colour picker for the sticky add-to-cart bar. Replaces the native
// <select> (whose OS-styled menu clashed with the glassy bar) with a themed
// popover. Opens upward since the bar sits at the bottom of the viewport.
export function ColourDropdown({
  value,
  options,
  onChange,
  className,
}: {
  value: string;
  options: ColourOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const i = options.findIndex((o) => o.value === value);
    setActiveIndex(i < 0 ? 0 : i);
    listRef.current?.focus();
  }, [open, value, options]);

  function commit(option: ColourOption) {
    if (!option.available) return;
    onChange(option.value);
    setOpen(false);
  }

  function onListKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const option = options[activeIndex];
      if (option) commit(option);
    }
  }

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Colour"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-full bg-white/40 px-3 subhead text-xs text-ink transition-colors hover:bg-white/70 focus:outline-none focus:ring-2 focus:ring-ink/30"
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          role="listbox"
          tabIndex={-1}
          onKeyDown={onListKeyDown}
          className="absolute bottom-full left-0 z-50 mb-2 max-h-60 w-max min-w-full overflow-y-auto rounded-2xl border border-white/60 bg-peach/95 p-1.5 shadow-[0_14px_44px_rgba(26,26,26,0.3)] backdrop-blur-2xl focus:outline-none"
        >
          {options.map((option, i) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="option" aria-selected={selected}>
                <button
                  type="button"
                  disabled={!option.available}
                  onClick={() => commit(option)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={cn(
                    "flex w-full items-center justify-between gap-4 whitespace-nowrap rounded-xl px-3 py-2 text-left subhead text-xs transition-colors",
                    selected
                      ? "bg-ink text-peach"
                      : i === activeIndex
                        ? "bg-ink/10 text-ink"
                        : "text-ink",
                    !option.available && "cursor-not-allowed opacity-40",
                  )}
                >
                  <span className={cn(!option.available && "line-through")}>
                    {option.value}
                  </span>
                  {!option.available && (
                    <span className="text-[0.625rem] text-brown">Sold out</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
