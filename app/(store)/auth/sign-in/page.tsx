"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { authClient } from "@/lib/auth-client";

// Only allow same-site relative redirects (e.g. "/checkout"), never an
// absolute URL pointing off-site.
function safeRedirect(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/account";
}

function SignIn() {
  const router = useRouter();
  const redirectTo = safeRedirect(useSearchParams().get("redirect"));
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
      router.push(redirectTo);
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
      <GoogleAuthButton callbackURL={redirectTo} />
      <div className="mt-6 flex justify-between text-xs text-brown">
        <Link href="/auth/forgot-password" className="hover:text-ember">
          Forgot password?
        </Link>
        <Link
          href={`/auth/sign-up?redirect=${encodeURIComponent(redirectTo)}`}
          className="hover:text-ember"
        >
          New here? Create account →
        </Link>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  );
}
