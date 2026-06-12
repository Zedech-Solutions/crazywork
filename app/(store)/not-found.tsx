import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-28 text-center">
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
  );
}
