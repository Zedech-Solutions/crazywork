"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authClient, useSession, signOut } from "@/lib/auth-client";

interface MyCode {
  code: string;
  percentage: number;
  used: boolean;
}

export default function AccountPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [code, setCode] = useState<MyCode | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isPending && !session) router.replace("/auth/sign-in");
  }, [isPending, session, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/me/code")
      .then((res) => res.json())
      .then((body) => body.ok && setCode(body))
      .catch(() => {});
  }, [session]);

  if (!session) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-14 sm:px-6">
      <p className="eyebrow text-ember">Account</p>
      <h1 className="headline mt-1 text-6xl">
        {session.user.name?.split(" ")[0] ?? "Athlete"}.
      </h1>

      <div className="mt-8 space-y-2 border border-warmgrey bg-sand/50 p-6 text-sm">
        <p>
          <span className="text-brown">Name:</span> {session.user.name}
        </p>
        <p>
          <span className="text-brown">Email:</span> {session.user.email}
        </p>
      </div>

      {code && (
        <div className="mt-6 border border-ember p-6">
          <p className="eyebrow text-ember">Your {code.percentage}% first-purchase code</p>
          {code.used ? (
            <p className="mt-2 text-sm text-brown">
              Used — that one&apos;s spent. Watch the drops for the next one.
            </p>
          ) : (
            <button
              className="mt-3 inline-flex items-center gap-3 border border-dashed border-ember px-5 py-2.5 subhead text-2xl text-ember cursor-pointer"
              onClick={() => {
                navigator.clipboard?.writeText(code.code);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {code.code}
              <Copy size={16} />
            </button>
          )}
          {copied && <p className="mt-1.5 text-xs text-brown">Copied.</p>}
          <p className="mt-2 text-xs text-warmgrey">
            Locked to your account · single use · applies at checkout
          </p>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        <Button asChild variant="outline">
          <Link href="/account/orders">My orders</Link>
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            await signOut();
            router.push("/");
            router.refresh();
          }}
        >
          Sign out
        </Button>
      </div>
    </div>
  );
}
