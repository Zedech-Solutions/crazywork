"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { useConfirm } from "@/components/admin/confirm";
import { CopyButton } from "@/components/admin/copy-button";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Label } from "@/components/ui/field";

interface Batch {
  label: string;
  total: number;
  used: number;
  percentage: number;
  amountOffSen: number | null;
  expiresAt: string | null;
  createdAt: string | null;
}

interface BatchCode {
  code: string;
  used: boolean;
  percentage: number;
  amountOffSen: number | null;
  redeemedBy: { orderNumber: string; customer: string; email: string } | null;
}

interface SharedCode {
  id: string;
  code: string;
  label: string | null;
  quota: number;
  redeemed: number;
  over: number;
  percentage: number;
  amountOffSen: number | null;
  expiresAt: string | null;
  createdAt: string;
}

function discountLabel(percentage: number, amountOffSen: number | null) {
  return amountOffSen
    ? `RM${(amountOffSen / 100).toFixed(2)} off`
    : `${percentage}% off`;
}

interface EditForm {
  label: string;
  discountType: "percent" | "fixed";
  value: string;
  expiresAt: string;
}

export default function AdminCodesPage() {
  const confirm = useConfirm();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  // inline edit state — which batch is being edited + its draft fields
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // create-form state
  const [label, setLabel] = useState("");
  const [prefix, setPrefix] = useState("");
  const [count, setCount] = useState("50");
  const [discountType, setDiscountType] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [expiresAt, setExpiresAt] = useState("");

  // expanded batch view
  const [openLabel, setOpenLabel] = useState<string | null>(null);
  const [codes, setCodes] = useState<BatchCode[]>([]);

  // shared quota codes
  const [sharedCodes, setSharedCodes] = useState<SharedCode[]>([]);
  const [sharedCode, setSharedCode] = useState("");
  const [sharedLabel, setSharedLabel] = useState("");
  const [sharedQuota, setSharedQuota] = useState("100");
  const [sharedDiscountType, setSharedDiscountType] = useState<"percent" | "fixed">("percent");
  const [sharedValue, setSharedValue] = useState("10");
  const [sharedExpiresAt, setSharedExpiresAt] = useState("");
  const [sharedCreating, setSharedCreating] = useState(false);
  const [sharedResult, setSharedResult] = useState<string | null>(null);

  const reload = useCallback(() => {
    adminFetch<{ batches: Batch[] }>("/code-batches")
      .then((r) => setBatches(r.batches))
      .catch((e) => setError(e.message));
    adminFetch<{ codes: SharedCode[] }>("/shared-codes")
      .then((r) => setSharedCodes(r.codes))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  async function create() {
    setCreating(true);
    setError(null);
    setResult(null);
    try {
      const r = await adminFetch<{ ok: boolean; created: number; message?: string }>(
        "/code-batches",
        {
          method: "POST",
          body: JSON.stringify({
            label,
            prefix,
            count: Number(count),
            discountType,
            value: Number(value),
            expiresAt: expiresAt || null,
          }),
        },
      );
      setResult(`Generated ${r.created} codes for “${label}”.`);
      setLabel("");
      setPrefix("");
      setCount("50");
      setValue("10");
      setExpiresAt("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function viewCodes(l: string) {
    if (openLabel === l) {
      setOpenLabel(null);
      return;
    }
    setOpenLabel(l);
    setCodes([]);
    try {
      const r = await adminFetch<{ codes: BatchCode[] }>(
        `/code-batches/${encodeURIComponent(l)}`,
      );
      setCodes(r.codes);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function startEdit(b: Batch) {
    setError(null);
    setEditing(b.label);
    setEditForm({
      label: b.label,
      discountType: b.amountOffSen ? "fixed" : "percent",
      value: b.amountOffSen
        ? (b.amountOffSen / 100).toFixed(2)
        : String(b.percentage),
      expiresAt: b.expiresAt ? b.expiresAt.slice(0, 10) : "",
    });
  }

  async function saveEdit(originalLabel: string) {
    if (!editForm) return;
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/code-batches/${encodeURIComponent(originalLabel)}`, {
        method: "PATCH",
        body: JSON.stringify({
          label: editForm.label,
          discountType: editForm.discountType,
          value: Number(editForm.value),
          expiresAt: editForm.expiresAt || null,
        }),
      });
      setEditing(null);
      setEditForm(null);
      if (openLabel === originalLabel) setOpenLabel(null);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(b: Batch) {
    if (
      !(await confirm({
        title: "Delete batch",
        message: `Delete “${b.label}” and all ${b.total} of its codes? This can't be undone. Past orders that used a code keep their record.`,
        confirmLabel: "Delete batch",
        danger: true,
      }))
    )
      return;
    setError(null);
    try {
      await adminFetch(`/code-batches/${encodeURIComponent(b.label)}`, {
        method: "DELETE",
      });
      if (openLabel === b.label) setOpenLabel(null);
      if (editing === b.label) {
        setEditing(null);
        setEditForm(null);
      }
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function exportCsv(l: string) {
    const a = document.createElement("a");
    a.href = `/api/admin/code-batches/${encodeURIComponent(l)}/export.csv`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function createShared() {
    setSharedCreating(true);
    setError(null);
    setSharedResult(null);
    try {
      await adminFetch<{ ok: boolean; id: string }>("/shared-codes", {
        method: "POST",
        body: JSON.stringify({
          code: sharedCode,
          label: sharedLabel,
          quota: Number(sharedQuota),
          discountType: sharedDiscountType,
          value: Number(sharedValue),
          expiresAt: sharedExpiresAt || null,
        }),
      });
      setSharedResult(`Created shared code “${sharedCode.toUpperCase()}”.`);
      setSharedCode("");
      setSharedLabel("");
      setSharedQuota("100");
      setSharedValue("10");
      setSharedExpiresAt("");
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSharedCreating(false);
    }
  }

  async function removeShared(s: SharedCode) {
    if (
      !(await confirm({
        title: "Delete shared code",
        message: `Delete “${s.code}”? This can't be undone. Past orders that used it keep their record.`,
        confirmLabel: "Delete code",
        danger: true,
      }))
    )
      return;
    setError(null);
    try {
      await adminFetch(`/shared-codes/${s.id}`, { method: "DELETE" });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="headline text-4xl sm:text-5xl">Promo Codes</h1>
      <p className="mt-1 text-sm text-brown">
        Generate unique single-use codes for a campaign or influencer. Each code
        works once; export them as a sheet and track which get redeemed.
      </p>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {/* CREATE BATCH */}
      <section className="mt-6 rounded-2xl border border-warmgrey/60 bg-sand/30 p-5">
        <h2 className="subhead text-xl">New code batch</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Campaign / influencer name</Label>
            <Input
              placeholder="Summer Influencer Drop"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div>
            <Label>Code prefix</Label>
            <Input
              placeholder="SUMMER"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
            />
            <p className="mt-1 text-[11px] text-warmgrey">
              e.g. SUMMER → SUMMER + random, like SUMMER4KQ9P2
            </p>
          </div>
          <div>
            <Label>How many codes</Label>
            <Input
              type="number"
              min={1}
              max={5000}
              value={count}
              onChange={(e) => setCount(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Discount</Label>
              <Dropdown
                value={discountType}
                onValueChange={(v) => setDiscountType(v as "percent" | "fixed")}
                options={[
                  { label: "Percentage", value: "percent" },
                  { label: "Fixed RM", value: "fixed" },
                ]}
              />
            </div>
            <div>
              <Label>{discountType === "percent" ? "% off" : "RM off"}</Label>
              <Input
                type="number"
                min={1}
                step={discountType === "percent" ? 1 : 0.01}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Expires (optional)</Label>
            <Input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="accent"
            onClick={create}
            disabled={creating || !label.trim() || !prefix.trim()}
          >
            <Plus size={15} /> {creating ? "Generating…" : "Generate codes"}
          </Button>
          {result && <span className="text-sm text-emerald-700">{result}</span>}
        </div>
      </section>

      {/* BATCHES */}
      <section className="mt-8 space-y-3">
        <h2 className="subhead text-xl">Batches</h2>
        {batches.length === 0 && (
          <p className="text-sm text-brown">No batches yet — generate one above.</p>
        )}
        {batches.map((b) => {
          const expanded = openLabel === b.label;
          const pct = b.total ? Math.round((b.used / b.total) * 100) : 0;
          return (
            <div
              key={b.label}
              className="rounded-2xl border border-warmgrey/60 bg-white/50"
            >
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="subhead text-base">{b.label}</p>
                  <p className="mt-0.5 text-xs text-brown">
                    {discountLabel(b.percentage, b.amountOffSen)} ·{" "}
                    <span className="font-bold text-ink">{b.used}</span>/{b.total}{" "}
                    used ({pct}%)
                    {b.expiresAt
                      ? ` · expires ${b.expiresAt.slice(0, 10)}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => viewCodes(b.label)}
                  >
                    {expanded ? "Hide codes" : "View codes"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      editing === b.label ? setEditing(null) : startEdit(b)
                    }
                  >
                    {editing === b.label ? "Cancel" : "Edit"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportCsv(b.label)}
                  >
                    Export CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => remove(b)}
                  >
                    Delete
                  </Button>
                </div>
              </div>

              {editing === b.label && editForm && (
                <div className="border-t border-warmgrey/40 p-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Label>Campaign / influencer name</Label>
                      <Input
                        value={editForm.label}
                        onChange={(e) =>
                          setEditForm((f) => f && { ...f, label: e.target.value })
                        }
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Discount</Label>
                        <Dropdown
                          value={editForm.discountType}
                          onValueChange={(v) =>
                            setEditForm(
                              (f) =>
                                f && { ...f, discountType: v as "percent" | "fixed" },
                            )
                          }
                          options={[
                            { label: "Percentage", value: "percent" },
                            { label: "Fixed RM", value: "fixed" },
                          ]}
                        />
                      </div>
                      <div>
                        <Label>
                          {editForm.discountType === "percent" ? "% off" : "RM off"}
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          step={editForm.discountType === "percent" ? 1 : 0.01}
                          value={editForm.value}
                          onChange={(e) =>
                            setEditForm((f) => f && { ...f, value: e.target.value })
                          }
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Expires (optional)</Label>
                      <Input
                        type="date"
                        value={editForm.expiresAt}
                        onChange={(e) =>
                          setEditForm(
                            (f) => f && { ...f, expiresAt: e.target.value },
                          )
                        }
                      />
                    </div>
                  </div>
                  <p className="mt-3 text-[11px] text-warmgrey">
                    Changes apply to all {b.total} codes in this batch. Orders that
                    already redeemed a code keep their original discount.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="accent"
                      size="sm"
                      disabled={saving || !editForm.label.trim()}
                      onClick={() => saveEdit(b.label)}
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditing(null);
                        setEditForm(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {expanded && (
                <div className="border-t border-warmgrey/40 p-4">
                  {codes.length === 0 ? (
                    <p className="text-sm text-brown">Loading…</p>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      <table className="w-full border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-ink text-left">
                            <th className="py-2 pr-3 eyebrow text-brown">Code</th>
                            <th className="py-2 pr-3 eyebrow text-brown">Status</th>
                            <th className="py-2 eyebrow text-brown">Redeemed by</th>
                          </tr>
                        </thead>
                        <tbody>
                          {codes.map((c) => (
                            <tr key={c.code} className="border-b border-sand">
                              <td className="py-2 pr-3">
                                <span className="inline-flex items-center gap-1.5 font-mono">
                                  {c.code}
                                  <CopyButton value={c.code} label="code" iconOnly />
                                </span>
                              </td>
                              <td className="py-2 pr-3">
                                {c.used ? (
                                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-emerald-700">
                                    Used
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-warmgrey/25 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brown">
                                    Unused
                                  </span>
                                )}
                              </td>
                              <td className="py-2 text-brown">
                                {c.redeemedBy
                                  ? `${c.redeemedBy.customer} · ${c.redeemedBy.orderNumber}`
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* SHARED QUOTA CODES */}
      <section className="mt-12 rounded-2xl border border-warmgrey/60 bg-sand/30 p-5">
        <h2 className="subhead text-xl">New shared code</h2>
        <p className="mt-1 text-sm text-brown">
          One code that everyone uses, capped by a redemption quota. The code is
          the literal text you type — no per-customer codes are generated. Each
          customer can redeem it once.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label>Code</Label>
            <Input
              placeholder="SUMMER"
              value={sharedCode}
              onChange={(e) =>
                setSharedCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
            />
            <p className="mt-1 text-[11px] text-warmgrey">
              Letters and numbers only — customers type this exactly.
            </p>
          </div>
          <div>
            <Label>Campaign name (optional)</Label>
            <Input
              placeholder="Summer Launch"
              value={sharedLabel}
              onChange={(e) => setSharedLabel(e.target.value)}
            />
          </div>
          <div>
            <Label>Quota (max redemptions)</Label>
            <Input
              type="number"
              min={1}
              value={sharedQuota}
              onChange={(e) => setSharedQuota(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Discount</Label>
              <Dropdown
                value={sharedDiscountType}
                onValueChange={(v) =>
                  setSharedDiscountType(v as "percent" | "fixed")
                }
                options={[
                  { label: "Percentage", value: "percent" },
                  { label: "Fixed RM", value: "fixed" },
                ]}
              />
            </div>
            <div>
              <Label>{sharedDiscountType === "percent" ? "% off" : "RM off"}</Label>
              <Input
                type="number"
                min={1}
                step={sharedDiscountType === "percent" ? 1 : 0.01}
                value={sharedValue}
                onChange={(e) => setSharedValue(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Expires (optional)</Label>
            <Input
              type="date"
              value={sharedExpiresAt}
              onChange={(e) => setSharedExpiresAt(e.target.value)}
            />
          </div>
        </div>
        <p className="mt-3 text-[11px] text-warmgrey">
          Quota is enforced when an order is paid. If several customers are paying
          at the exact moment the last slot is taken, those already-charged orders
          are honored — so redemptions can land slightly over the quota. Any
          overage is shown below.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="accent"
            onClick={createShared}
            disabled={sharedCreating || !sharedCode.trim()}
          >
            <Plus size={15} /> {sharedCreating ? "Creating…" : "Create shared code"}
          </Button>
          {sharedResult && (
            <span className="text-sm text-emerald-700">{sharedResult}</span>
          )}
        </div>
      </section>

      <section className="mt-8 space-y-3">
        <h2 className="subhead text-xl">Shared codes</h2>
        {sharedCodes.length === 0 && (
          <p className="text-sm text-brown">
            No shared codes yet — create one above.
          </p>
        )}
        {sharedCodes.map((s) => {
          const pct = s.quota ? Math.round((s.redeemed / s.quota) * 100) : 0;
          return (
            <div
              key={s.id}
              className="rounded-2xl border border-warmgrey/60 bg-white/50 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="subhead inline-flex items-center gap-1.5 text-base font-mono">
                    {s.code}
                    <CopyButton value={s.code} label="code" iconOnly />
                  </p>
                  <p className="mt-0.5 text-xs text-brown">
                    {s.label ? `${s.label} · ` : ""}
                    {discountLabel(s.percentage, s.amountOffSen)} ·{" "}
                    <span className="font-bold text-ink">{s.redeemed}</span>/
                    {s.quota} redeemed ({pct}%)
                    {s.over > 0 && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                        {s.over} over quota
                      </span>
                    )}
                    {s.expiresAt ? ` · expires ${s.expiresAt.slice(0, 10)}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-red-300 text-red-700 hover:bg-red-50"
                    onClick={() => removeShared(s)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
