"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { ChangePasswordCard } from "@/components/admin/change-password";
import { Input, Label } from "@/components/ui/field";
import { authClient, useSession } from "@/lib/auth-client";

export default function AdminProfilePage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [nameSaved, setNameSaved] = useState(false);

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
      <ChangePasswordCard />
    </div>
  );
}
