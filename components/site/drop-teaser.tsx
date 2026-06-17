import { Lock } from "lucide-react";

// Locked placeholder for an upcoming drop that has no products yet. Purely a
// teaser — it links nowhere, since there's no product to open. The drop's name
// and countdown (shown by the caller) carry the launch info.
export function DropTeaser() {
  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-warmgrey/40 bg-ink/90 py-20 text-center">
      <Lock className="size-7 text-ember" />
      <p className="subhead text-sm text-ember">Locked</p>
      <p className="text-sm text-warmgrey">Dropping soon — stay tuned.</p>
    </div>
  );
}
