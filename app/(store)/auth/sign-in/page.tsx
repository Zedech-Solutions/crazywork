"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.signIn.email({ email, password });
    if (err) {
      setError(err.message ?? "Sign in failed.");
      setBusy(false);
    } else {
      router.push("/account");
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="headline text-6xl">Sign In</h1>
      <p className="mt-2 text-sm text-brown">Back to work.</p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="si-email">Email</Label>
          <Input id="si-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="si-password">Password</Label>
          <Input id="si-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <Button type="submit" variant="accent" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <Button
        variant="outline"
        className="mt-3 w-full"
        onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/account" })}
      >
        Continue with Google
      </Button>
      <div className="mt-6 flex justify-between text-xs text-brown">
        <Link href="/auth/forgot-password" className="hover:text-ember">
          Forgot password?
        </Link>
        <Link href="/auth/sign-up" className="hover:text-ember">
          New here? Create account →
        </Link>
      </div>
    </div>
  );
}
