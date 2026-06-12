import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function RootNotFound() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-warmgrey">
        <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
          <Link href="/" className="headline text-2xl tracking-[0.18em]">
            CRAZYWORK
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-2xl flex-1 px-4 py-28 text-center">
        <p className="headline text-[10rem] leading-none text-ember/25">404</p>
        <h1 className="headline mt-2 text-5xl">This page skipped leg day.</h1>
        <p className="mt-3 text-sm text-brown">
          Whatever you were after isn&apos;t here. The work, however, continues.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild variant="accent">
            <Link href="/shop">Shop the drop</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
