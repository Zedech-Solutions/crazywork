// Placeholder for an upcoming drop that has no products yet. Purely a teaser —
// it links nowhere, since there's no product to open. The drop's name and
// countdown (shown by the caller) carry the launch info.
export function DropTeaser() {
  return (
    <div className="mt-6 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-warmgrey/70 bg-transparent py-20 text-center">
      <p className="eyebrow text-ember">Coming soon</p>
      <p className="text-sm text-brown">Dropping soon — stay tuned.</p>
    </div>
  );
}
