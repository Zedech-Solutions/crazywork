"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/field";
import { GoogleAuthButton } from "@/components/auth/google-auth-button";
import { authClient } from "@/lib/auth-client";

function safeRedirect(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/account";
}

function SignUp() {
  const router = useRouter();
  const redirectTo = safeRedirect(useSearchParams().get("redirect"));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.signUp.email({ name, email, password });
    if (err) {
      setError(err.message ?? "Sign up failed.");
      setBusy(false);
    } else {
      router.push(redirectTo);
      router.refresh();
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="headline text-6xl">Join Us</h1>
      <p className="mt-2 text-sm text-brown">
        Create an account — your 10% first-purchase code comes with it.
      </p>
      <form onSubmit={submit} className="mt-8 space-y-4">
        <div>
          <Label htmlFor="su-name">Name</Label>
          <Input id="su-name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="su-email">Email</Label>
          <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="su-password">Password</Label>
          <Input
            id="su-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-red-700">{error}</p>}
        <Button type="submit" variant="accent" className="w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </Button>
      </form>
      <GoogleAuthButton callbackURL={redirectTo} />
      <p className="mt-6 text-center text-xs text-brown">
        Already have an account?{" "}
        <Link
          href={`/auth/sign-in?redirect=${encodeURIComponent(redirectTo)}`}
          className="hover:text-ember underline"
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense fallback={null}>
      <SignUp />
    </Suspense>
  );
}
