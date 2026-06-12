"use client";

import { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await authClient.signIn.email({
        email,
        password,
      });
      if (signInError) {
        setError("Wrong email or password.");
        return;
      }

      // Admin panel is superadmin-only — a valid customer login is not enough.
      const { data: session } = await authClient.getSession();
      if (session?.user.role === "superadmin") {
        // hard navigation so the server guard re-reads the fresh session cookie
        window.location.assign("/admin");
        return;
      }
      await authClient.signOut();
      setError("This account doesn't have admin access.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink px-4 text-peach">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="headline text-3xl tracking-[0.15em]">CRAZYWORK</p>
          <p className="eyebrow mt-1 text-ember">Admin Panel</p>
        </div>

        <form
          onSubmit={submit}
          className="border border-peach/15 bg-peach/[0.03] p-6"
        >
          <h1 className="subhead text-xl">Sign in to manage the store</h1>
          <div className="mt-5 space-y-4">
            <div>
              <label
                htmlFor="admin-email"
                className="eyebrow mb-1.5 block text-peach/60"
              >
                Email
              </label>
              <input
                id="admin-email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-peach/20 bg-ink px-3 py-2.5 text-sm text-peach placeholder:text-peach/30 focus:border-ember focus:outline-none"
              />
            </div>
            <div>
              <label
                htmlFor="admin-password"
                className="eyebrow mb-1.5 block text-peach/60"
              >
                Password
              </label>
              <input
                id="admin-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-peach/20 bg-ink px-3 py-2.5 text-sm text-peach placeholder:text-peach/30 focus:border-ember focus:outline-none"
              />
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-ember px-6 py-3 subhead text-sm text-peach transition-colors hover:bg-peach hover:text-ink disabled:opacity-40 cursor-pointer"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>

        <p className="mt-6 text-center text-xs text-peach/40">
          Shopping account?{" "}
          <Link href="/auth/sign-in" className="text-peach/70 hover:text-ember">
            Customer sign in →
          </Link>
        </p>
      </div>
    </div>
  );
}
