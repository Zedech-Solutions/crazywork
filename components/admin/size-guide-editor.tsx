"use client";

import { Columns3, Plus, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/field";
import type { SizeGuideTable } from "@/lib/size-guide";

// Editable columns + rows grid. Used for the store default (Settings) and the
// per-product override (product editor).
export function SizeGuideEditor({
  value,
  onChange,
}: {
  value: SizeGuideTable;
  onChange: (next: SizeGuideTable) => void;
}) {
  const cols = value.columns.length || 1;

  function setColumn(i: number, text: string) {
    onChange({
      ...value,
      columns: value.columns.map((c, j) => (j === i ? text : c)),
    });
  }

  function setCell(r: number, c: number, text: string) {
    onChange({
      ...value,
      rows: value.rows.map((row, ri) =>
        ri === r ? row.map((cell, ci) => (ci === c ? text : cell)) : row,
      ),
    });
  }

  function addColumn() {
    onChange({
      ...value,
      columns: [...value.columns, ""],
      rows: value.rows.map((row) => [...row, ""]),
    });
  }

  function removeColumn(i: number) {
    if (value.columns.length <= 1) return;
    onChange({
      ...value,
      columns: value.columns.filter((_, j) => j !== i),
      rows: value.rows.map((row) => row.filter((_, j) => j !== i)),
    });
  }

  function addRow() {
    onChange({ ...value, rows: [...value.rows, Array(cols).fill("")] });
  }

  function removeRow(r: number) {
    onChange({ ...value, rows: value.rows.filter((_, ri) => ri !== r) });
  }

  return (
    <div className="space-y-3">
      <Input
        placeholder="Note, e.g. Measurements in cm — size up for an oversized fit."
        value={value.note}
        onChange={(e) => onChange({ ...value, note: e.target.value })}
      />

      <div className="overflow-x-auto rounded-xl border border-warmgrey/60 bg-sand/30 p-2">
        <table className="border-separate border-spacing-1.5">
          <thead>
            <tr>
              {value.columns.map((col, i) => (
                <th key={i} className="p-0 text-left align-bottom">
                  <div className="mb-0.5 flex items-center justify-between px-1">
                    <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-brown">
                      Col {i + 1}
                    </span>
                    <button
                      type="button"
                      aria-label="Remove column"
                      className="text-warmgrey hover:text-red-700 cursor-pointer disabled:opacity-30"
                      disabled={value.columns.length <= 1}
                      onClick={() => removeColumn(i)}
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <Input
                    className="w-28 py-1.5 font-bold"
                    placeholder={i === 0 ? "Size" : "Heading"}
                    value={col}
                    onChange={(e) => setColumn(i, e.target.value)}
                  />
                </th>
              ))}
              <th className="px-1 align-bottom">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-ember/60 px-2.5 py-2 text-xs font-medium text-ember hover:bg-ember/10 cursor-pointer"
                  onClick={addColumn}
                >
                  <Columns3 size={13} /> Column
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {value.rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c} className="p-0">
                    <Input
                      className="w-28 py-1.5"
                      value={row[c] ?? ""}
                      onChange={(e) => setCell(r, c, e.target.value)}
                    />
                  </td>
                ))}
                <td className="px-1 text-center">
                  <button
                    type="button"
                    aria-label="Remove row"
                    className="text-warmgrey hover:text-red-700 cursor-pointer"
                    onClick={() => removeRow(r)}
                  >
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ember/60 px-3 py-2 text-xs font-medium text-ember hover:bg-ember/10 cursor-pointer"
        onClick={addRow}
      >
        <Plus size={13} /> Add row
      </button>
    </div>
  );
}
