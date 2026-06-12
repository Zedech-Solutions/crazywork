"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { SizeGuideTable } from "@/lib/size-guide";

export function SizeGuide({ guide }: { guide: SizeGuideTable }) {
  return (
    <Dialog>
      <DialogTrigger className="eyebrow text-brown underline-offset-4 hover:text-ember hover:underline cursor-pointer">
        Size guide ▸
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle className="headline text-3xl">Size Guide</DialogTitle>
        {guide.note && <p className="mt-2 text-xs text-brown">{guide.note}</p>}
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-ink text-left">
              {guide.columns.map((h, i) => (
                <th key={i} className="py-2 eyebrow text-brown">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((row, r) => (
              <tr key={r} className="border-b border-sand">
                {row.map((cell, c) => (
                  <td
                    key={c}
                    className={c === 0 ? "py-2.5 subhead" : "py-2.5 text-brown"}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}
