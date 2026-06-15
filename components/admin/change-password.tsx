"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

// Shared change-password card — used on both the Profile and Settings pages.
// Verifies the current password and writes a new hash via Better Auth.
export function ChangePasswordCard({ className = "mt-6" }: { className?: string }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (next.length < 8) {
      setMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setMsg({ ok: false, text: "New passwords don't match." });
      return;
    }
    setBusy(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        revokeOtherSessions: true,
      });
      if (error) {
        setMsg({ ok: false, text: error.message ?? "Current password is incorrect." });
      } else {
        setMsg({ ok: true, text: "Password updated. Other sessions signed out." });
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setMsg({ ok: false, text: "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={`rounded-2xl border border-warmgrey/60 bg-sand/40 p-6 ${className}`}>
      <h2 className="subhead text-xl">Change password</h2>
      <p className="mt-1 text-sm text-brown">
        Update your admin login. Changing it signs out any other active sessions.
      </p>
      <form onSubmit={changePassword} className="mt-4 max-w-md space-y-4">
        <div>
          <Label htmlFor="cp-current">Current password</Label>
          <Input
            id="cp-current"
            type="password"
            autoComplete="current-password"
            required
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cp-new">New password</Label>
          <Input
            id="cp-new"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="cp-confirm">Confirm new password</Label>
          <Input
            id="cp-confirm"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {msg && (
          <p className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>
            {msg.text}
          </p>
        )}
        <Button type="submit" variant="accent" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </Button>
      </form>
    </section>
  );
}
