"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function AdminUserMenu({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const initial = email.charAt(0).toUpperCase();

  async function logout() {
    setBusy(true);
    await authClient.signOut();
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <Link
        href="/admin/profile"
        className="hidden items-center gap-2.5 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-sand sm:flex"
        title="Profile & password"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ember text-sm font-bold text-peach">
          {initial}
        </span>
        <span className="text-xs text-brown">{email}</span>
      </Link>
      <button
        onClick={logout}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-full border border-warmgrey px-3.5 py-1.5 text-xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-peach disabled:opacity-40 cursor-pointer"
      >
        <LogOut size={14} />
        {busy ? "Signing out…" : "Log out"}
      </button>
    </div>
  );
}
