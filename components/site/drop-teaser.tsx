// Placeholder for an upcoming drop that has no products yet. Purely a teaser —
// it links nowhere, since there's no product to open. The drop's name and
// countdown (shown by the caller) carry the launch info.
export function DropTeaser() {
  return (
    <div className="mt-6 flex items-center justify-center rounded-2xl border border-dashed border-warmgrey/70 bg-transparent py-24 text-center">
      <p className="headline text-6xl text-ember sm:text-7xl">Coming soon</p>
    </div>
  );
}
