"use client";

import { useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Gift } from "lucide-react";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

const SEEN_KEY = "crazywork-popup-seen";

interface EmailPopupProps {
  delaySeconds?: number;
  percentage?: number;
  eyebrow?: string;
  headline?: string;
  body?: string;
}

export function EmailPopup({
  delaySeconds = 6,
  percentage = 10,
  eyebrow = "First purchase",
  headline = "{percent}% off. Earned by showing up.",
  body = "Drop your email — we'll send a single-use code locked to you. No spam, just drops.",
}: EmailPopupProps) {
  const withPercent = (text: string) =>
    text.replace(/\{percent\}/g, String(percentage));
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [used, setUsed] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    const timer = setTimeout(() => setOpen(true), delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [delaySeconds]);

  // Swivel: the tag stays pinned to the left edge but pivots on that edge
  // (rotateY hinged at left center) when the user scrolls — a damped spring
  // settles it back to flat. Writes transform directly to avoid re-rendering.
  const tabRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const el = tabRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let angle = 0;
    let velocity = 0;
    let lastY = window.scrollY;
    let raf = 0;
    let running = false;

    const apply = (a: number) =>
      (el.style.transform = `perspective(600px) rotateY(${a.toFixed(2)}deg)`);

    const tick = () => {
      velocity += -0.02 * angle; // spring pull toward flat
      velocity *= 0.88; // damping
      angle += velocity;
      angle = Math.max(-28, Math.min(28, angle));
      if (Math.abs(angle) < 0.05 && Math.abs(velocity) < 0.05) {
        apply(0);
        running = false;
        return;
      }
      apply(angle);
      raf = requestAnimationFrame(tick);
    };

    const onScroll = () => {
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      velocity += Math.max(-4, Math.min(4, dy * 0.06)); // scroll impulse
      if (!running) {
        running = true;
        raf = requestAnimationFrame(tick);
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  function dismiss(value: boolean) {
    setOpen(value);
    if (!value) localStorage.setItem(SEEN_KEY, "1");
  }

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.message ?? "Something went wrong.");
      } else {
        setCode(body.code);
        setUsed(Boolean(body.used));
        setClaimed(Boolean(body.alreadyClaimed));
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        ref={tabRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Get ${percentage}% off your first purchase`}
        style={{ transformOrigin: "left center" }}
        className="group fixed left-0 top-1/2 z-40 flex -translate-y-1/2 items-stretch shadow-[2px_3px_0_rgba(26,26,26,0.28)] will-change-transform"
      >
        {/* base ember tab pinned to the edge */}
        <span className="flex flex-col items-center gap-2 rounded-r-sm bg-ember px-1.5 py-3 text-peach ring-1 ring-ink/15 group-hover:rounded-r-none">
          <Gift className="h-4 w-4 shrink-0" aria-hidden />
          <span className="relative block h-12 w-5">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap subhead text-sm tracking-[0.12em]">
              {percentage}% OFF
            </span>
          </span>
        </span>
        {/* white panel pops out on hover, carrying the rotated CRAZYWORK logo */}
        <span className="flex w-0 items-center justify-center overflow-hidden rounded-r-sm border border-transparent bg-transparent text-ink transition-[width,border-color,background-color] duration-300 ease-out group-hover:w-9 group-hover:border-ink group-hover:bg-white">
          <span className="relative block h-[4.5rem] w-5">
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 whitespace-nowrap subhead text-[11px] tracking-[0.25em]">
              CRAZYWORK
            </span>
          </span>
        </span>
      </button>
      <DialogPrimitive.Root open={open} onOpenChange={dismiss}>
        <DialogContent aria-describedby={undefined}>
        {code && used ? (
          <div className="text-center">
            <DialogTitle className="headline text-4xl">
              Already used.
            </DialogTitle>
            <p className="mt-3 text-sm text-brown">
              Your first-purchase code{" "}
              <span className="font-bold text-ink">{code}</span> has already been
              redeemed — it&apos;s one-time only. Watch the drops for the next
              offer.
            </p>
            <Button
              variant="accent"
              className="mt-5"
              onClick={() => dismiss(false)}
            >
              Got it
            </Button>
          </div>
        ) : code ? (
          <div className="text-center">
            <DialogTitle className="headline text-4xl">
              {claimed ? "Already yours." : "You’re in."}
            </DialogTitle>
            <p className="mt-3 text-sm text-brown">
              {claimed
                ? `This email already has its ${percentage}% first-purchase code:`
                : `Your ${percentage}% first-purchase code — it’s locked to this email:`}
            </p>
            <button
              className="mt-4 inline-block border border-dashed border-ember px-6 py-3 subhead text-2xl text-ember cursor-pointer"
              onClick={() => navigator.clipboard?.writeText(code)}
              title="Copy code"
            >
              {code}
            </button>
            <p className="mt-2 text-xs text-warmgrey">
              {claimed
                ? "Click to copy · already emailed when you first claimed it"
                : "Click to copy · also emailed to you"}
            </p>
          </div>
        ) : (
          <>
            <p className="eyebrow text-ember">{eyebrow}</p>
            <DialogTitle className="headline mt-1 text-4xl">
              {withPercent(headline)}
            </DialogTitle>
            <p className="mt-3 text-sm text-brown">{withPercent(body)}</p>
            <form onSubmit={subscribe} className="mt-5 flex gap-2">
              <Input
                type="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button type="submit" variant="accent" disabled={busy}>
                {busy ? "…" : "Get code"}
              </Button>
            </form>
            {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
          </>
        )}
        </DialogContent>
      </DialogPrimitive.Root>
    </>
  );
}
