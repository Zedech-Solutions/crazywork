"use client";

import { useEffect, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

const SEEN_KEY = "crazywork-popup-seen";

export function EmailPopup({ delaySeconds = 6 }: { delaySeconds?: number }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (localStorage.getItem(SEEN_KEY)) return;
    const timer = setTimeout(() => setOpen(true), delaySeconds * 1000);
    return () => clearTimeout(timer);
  }, [delaySeconds]);

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
      }
    } catch {
      setError("Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={dismiss}>
      <DialogContent aria-describedby={undefined}>
        {code ? (
          <div className="text-center">
            <DialogTitle className="headline text-4xl">You&apos;re in.</DialogTitle>
            <p className="mt-3 text-sm text-brown">
              Your 10% first-purchase code — it&apos;s locked to this email:
            </p>
            <button
              className="mt-4 inline-block border border-dashed border-ember px-6 py-3 subhead text-2xl text-ember cursor-pointer"
              onClick={() => navigator.clipboard?.writeText(code)}
              title="Copy code"
            >
              {code}
            </button>
            <p className="mt-2 text-xs text-warmgrey">Click to copy · also emailed to you</p>
          </div>
        ) : (
          <>
            <p className="eyebrow text-ember">First purchase</p>
            <DialogTitle className="headline mt-1 text-4xl">
              10% off. Earned by showing up.
            </DialogTitle>
            <p className="mt-3 text-sm text-brown">
              Drop your email — we&apos;ll send a single-use code locked to you.
              No spam, just drops.
            </p>
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
  );
}
