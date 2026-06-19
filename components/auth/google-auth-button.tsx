"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

// Shared "Continue with Google" control for the sign-in / sign-up pages.
// On success the browser redirects to Google; an error (e.g. provider not
// configured) is surfaced instead of failing silently.
export function GoogleAuthButton({
  callbackURL = "/account",
}: {
  callbackURL?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const { error: err } = await authClient.signIn.social({
      provider: "google",
      callbackURL,
      // Without this, Better Auth sends brand-new users to its default ("/")
      // instead of back where they started (e.g. /checkout). Match callbackURL.
      newUserCallbackURL: callbackURL,
    });
    if (err) {
      setError(err.message ?? "Google sign-in isn't available right now.");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-[0.18em] text-warmgrey">
        <span className="h-px flex-1 bg-warmgrey/50" />
        or
        <span className="h-px flex-1 bg-warmgrey/50" />
      </div>
      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={go}
        disabled={busy}
      >
        <GoogleIcon />
        {busy ? "Connecting…" : "Continue with Google"}
      </Button>
      {error && <p className="mt-2 text-center text-xs text-red-700">{error}</p>}
    </div>
  );
}
