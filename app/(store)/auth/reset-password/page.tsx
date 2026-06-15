"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  // Better Auth appends ?token=… (and ?error=… for an expired/invalid link).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) {
      setError("This reset link is invalid or has expired. Request a new one.");
    } else {
      setToken(params.get("token"));
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (next.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!token) {
      setError("Missing reset token — open the link from your email again.");
      return;
    }
    setBusy(true);
    const { error: err } = await authClient.resetPassword({
      newPassword: next,
      token,
    });
    if (err) {
      setError(err.message ?? "Couldn't reset the password. Request a new link.");
      setBusy(false);
    } else {
      setDone(true);
      setTimeout(() => router.push("/auth/sign-in"), 1800);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="headline text-6xl">New Password</h1>
      {done ? (
        <p className="mt-4 text-sm text-emerald-700">
          Password updated. Redirecting you to sign in…
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="rp-new">New password</Label>
            <Input
              id="rp-new"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="rp-confirm">Confirm new password</Label>
            <Input
              id="rp-confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <Button type="submit" variant="accent" className="w-full" disabled={busy}>
            {busy ? "Updating…" : "Set new password"}
          </Button>
        </form>
      )}
      <p className="mt-6 text-center text-xs text-brown">
        <Link href="/auth/sign-in" className="hover:text-ember underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
