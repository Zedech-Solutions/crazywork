"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { authClient, useSession } from "@/lib/auth-client";

export default function AdminProfilePage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session?.user.name) setName(session.user.name);
  }, [session]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaved(false);
    await authClient.updateUser({ name });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 2500);
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (next.length < 8) {
      setPwMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }
    if (next !== confirm) {
      setPwMsg({ ok: false, text: "New passwords don't match." });
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
        setPwMsg({
          ok: false,
          text: error.message ?? "Current password is incorrect.",
        });
      } else {
        setPwMsg({ ok: true, text: "Password updated. Other sessions signed out." });
        setCurrent("");
        setNext("");
        setConfirm("");
      }
    } catch {
      setPwMsg({ ok: false, text: "Something went wrong. Try again." });
    } finally {
      setBusy(false);
    }
  }

  if (!session) return <p className="text-sm text-brown">Loading…</p>;

  return (
    <div className="max-w-xl">
      <h1 className="headline text-5xl">Profile</h1>
      <p className="mt-2 text-sm text-brown">
        Your admin account. Email is fixed; update your name or password below.
      </p>

      {/* IDENTITY */}
      <section className="mt-8 rounded-2xl border border-warmgrey/60 bg-sand/40 p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ember text-lg font-bold text-peach">
            {session.user.email.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="subhead text-lg leading-none">{session.user.name}</p>
            <p className="mt-1 text-xs text-brown">{session.user.email}</p>
          </div>
        </div>
        <form onSubmit={saveName} className="flex items-end gap-2">
          <div className="flex-1">
            <Label htmlFor="pf-name">Display name</Label>
            <Input
              id="pf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Save
          </Button>
          {nameSaved && (
            <span className="self-center text-sm text-emerald-700">Saved ✓</span>
          )}
        </form>
      </section>

      {/* PASSWORD */}
      <section className="mt-6 rounded-2xl border border-warmgrey/60 bg-sand/40 p-6">
        <h2 className="subhead text-xl">Change password</h2>
        <form onSubmit={changePassword} className="mt-4 space-y-4">
          <div>
            <Label htmlFor="pf-current">Current password</Label>
            <Input
              id="pf-current"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pf-new">New password</Label>
            <Input
              id="pf-new"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pf-confirm">Confirm new password</Label>
            <Input
              id="pf-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {pwMsg && (
            <p
              className={`text-xs ${pwMsg.ok ? "text-emerald-700" : "text-red-700"}`}
            >
              {pwMsg.text}
            </p>
          )}
          <Button type="submit" variant="accent" disabled={busy}>
            {busy ? "Updating…" : "Update password"}
          </Button>
        </form>
      </section>
    </div>
  );
}
