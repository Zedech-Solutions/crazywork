"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

// "Notify me" button that opens a dialog to capture an email. Everyone who signs
// up is emailed once when the drop launches (admin flips it upcoming → current).
export function NotifyMe({
  dropId,
  dropName,
}: {
  dropId: string;
  dropName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const what = dropName ?? "this drop";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    setMessage("");
    try {
      const res = await fetch(`/api/drops/${dropId}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await res.json();
      if (!res.ok || !body.ok) {
        setState("error");
        setMessage(body.message ?? "Something went wrong.");
        return;
      }
      setState("done");
    } catch {
      setState("error");
      setMessage("Something went wrong.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setState("idle");
          setEmail("");
          setMessage("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="accent">Notify me</Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        {state === "done" ? (
          <div className="text-center">
            <DialogTitle className="headline text-3xl">
              You&apos;re on the list
            </DialogTitle>
            <p className="mt-3 text-sm text-brown">
              We&apos;ll email you the moment {what} goes live.
            </p>
            <Button
              variant="accent"
              className="mt-6"
              onClick={() => setOpen(false)}
            >
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={submit}>
            <DialogTitle className="headline text-3xl">Get notified</DialogTitle>
            <p className="mt-2 text-sm text-brown">
              Drop your email and we&apos;ll tell you when {what} drops.
            </p>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mt-4"
            />
            {state === "error" && (
              <p className="mt-2 text-xs text-red-700">{message}</p>
            )}
            <Button
              type="submit"
              variant="accent"
              className="mt-4 w-full"
              disabled={state === "loading"}
            >
              {state === "loading" ? "…" : "Notify me"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
