"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GripVertical, Plus, Trash2, X } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/admin/confirm";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Badge, Input, Label, Textarea } from "@/components/ui/field";
import { evaluateCart, type CampaignType } from "@/lib/discount";
import { formatRM, rm } from "@/lib/money";

interface TierRow {
  threshold: string; // minQty or RM subtotal, as typed
  percent: string;
}

interface CampaignForm {
  id?: string;
  name: string;
  type: CampaignType;
  active: boolean;
  startAt: string;
  endAt: string;
  priority: string;
  stacksWithCodes: boolean;
  tiers: TierRow[]; // quantity_tier / cart_total_tier
  buyQty: string; // buy_x_get_y
  percent: string; // buy_x_get_y
  minSubtotal: string; // free_shipping_over (RM)
}

interface ApiCampaign {
  id: string;
  name: string;
  type: CampaignType;
  rules: Record<string, unknown>;
  active: boolean;
  startAt: string | null;
  endAt: string | null;
  priority: number;
  stacksWithCodes: boolean;
}

const TYPE_LABELS: Record<CampaignType, string> = {
  quantity_tier: "Quantity tiers (buy more, save more)",
  cart_total_tier: "Cart total tiers (spend more, save more)",
  buy_x_get_y: "Buy X = Y% off",
  free_shipping_over: "Free shipping over RM…",
};

const EMPTY: CampaignForm = {
  name: "",
  type: "quantity_tier",
  active: true,
  startAt: "",
  endAt: "",
  priority: "0",
  stacksWithCodes: false,
  tiers: [{ threshold: "2", percent: "5" }],
  buyQty: "2",
  percent: "5",
  minSubtotal: "150",
};

function toForm(c: ApiCampaign): CampaignForm {
  const rules = c.rules ?? {};
  const tiers = ((rules.tiers as { minQty?: number; minSubtotal?: number; percent: number }[]) ?? []).map(
    (t) => ({
      threshold:
        c.type === "cart_total_tier"
          ? String((t.minSubtotal ?? 0) / 100)
          : String(t.minQty ?? 0),
      percent: String(t.percent),
    }),
  );
  return {
    id: c.id,
    name: c.name,
    type: c.type,
    active: c.active,
    startAt: c.startAt ? c.startAt.slice(0, 10) : "",
    endAt: c.endAt ? c.endAt.slice(0, 10) : "",
    priority: String(c.priority),
    stacksWithCodes: c.stacksWithCodes,
    tiers: tiers.length ? tiers : EMPTY.tiers,
    buyQty: String((rules.buyQty as number) ?? 2),
    percent: String((rules.percent as number) ?? 5),
    minSubtotal: String(((rules.minSubtotal as number) ?? 15000) / 100),
  };
}

function toRules(form: CampaignForm): Record<string, unknown> {
  switch (form.type) {
    case "quantity_tier":
      return {
        tiers: form.tiers.map((t) => ({
          minQty: Number(t.threshold),
          percent: Number(t.percent),
        })),
      };
    case "cart_total_tier":
      return {
        tiers: form.tiers.map((t) => ({
          minSubtotal: rm(Number(t.threshold)),
          percent: Number(t.percent),
        })),
      };
    case "buy_x_get_y":
      return { buyQty: Number(form.buyQty), percent: Number(form.percent) };
    case "free_shipping_over":
      return { minSubtotal: rm(Number(form.minSubtotal)) };
  }
}

interface SampleRow {
  qty: string;
  price: string;
  cost: string;
}

/** Live calculator — pure client-side preview of the evaluator. No save needed. */
function LiveCalculator({ form }: { form: CampaignForm }) {
  const [rows, setRows] = useState<SampleRow[]>([
    { qty: "2", price: "100", cost: "60" },
  ]);
  const [shipping, setShipping] = useState("8");

  const result = useMemo(() => {
    const items = rows
      .filter((r) => Number(r.qty) > 0 && Number(r.price) > 0)
      .map((r) => ({ unitPrice: rm(Number(r.price)), quantity: Number(r.qty) }));
    const pricing = evaluateCart({
      items,
      campaigns: [
        {
          id: "preview",
          name: form.name || "This campaign",
          type: form.type,
          rules: toRules(form),
          active: true,
          startAt: null,
          endAt: null,
          priority: Number(form.priority) || 0,
          stacksWithCodes: form.stacksWithCodes,
        },
      ],
      shippingFee: rm(Number(shipping) || 0),
    });
    const totalCost = rows.reduce(
      (s, r) => s + rm(Number(r.cost) || 0) * (Number(r.qty) || 0),
      0,
    );
    const margin = pricing.subtotal - pricing.discountAmount - totalCost;
    return { pricing, totalCost, margin };
  }, [rows, shipping, form]);

  return (
    <aside className="h-fit border border-ink bg-ink p-5 text-peach">
      <p className="subhead text-lg text-ember">Live Preview</p>
      <p className="mt-1 text-xs text-peach/60">
        Sample cart — updates as you edit the rules. Nothing is saved.
      </p>
      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-[60px_1fr_1fr_24px] gap-2 text-[10px] uppercase tracking-[0.18em] text-peach/50">
          <span>Qty</span>
          <span>Price RM</span>
          <span>Cost RM</span>
          <span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[60px_1fr_1fr_24px] items-center gap-2">
            {(["qty", "price", "cost"] as const).map((key) => (
              <input
                key={key}
                type="number"
                min="0"
                className="border border-peach/30 bg-transparent px-2 py-1.5 text-sm focus:border-ember focus:outline-none"
                value={row[key]}
                onChange={(e) =>
                  setRows(rows.map((r, j) => (j === i ? { ...r, [key]: e.target.value } : r)))
                }
              />
            ))}
            <button
              aria-label="Remove row"
              className="text-peach/40 hover:text-ember cursor-pointer"
              onClick={() => setRows(rows.filter((_, j) => j !== i))}
            >
              <X size={13} />
            </button>
          </div>
        ))}
        <button
          className="text-xs text-ember hover:underline cursor-pointer"
          onClick={() => setRows([...rows, { qty: "1", price: "100", cost: "" }])}
        >
          + add line
        </button>
        <div className="flex items-center gap-2 pt-1 text-xs text-peach/60">
          Shipping RM
          <input
            type="number"
            min="0"
            className="w-20 border border-peach/30 bg-transparent px-2 py-1 text-sm text-peach focus:border-ember focus:outline-none"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
          />
        </div>
      </div>

      <dl className="mt-5 space-y-1.5 border-t border-peach/20 pt-4 text-sm">
        <div className="flex justify-between">
          <dt className="text-peach/60">Subtotal</dt>
          <dd>{formatRM(result.pricing.subtotal)}</dd>
        </div>
        <div className="flex justify-between text-ember">
          <dt>Discount{result.pricing.discountLabel ? ` (${result.pricing.discountLabel})` : ""}</dt>
          <dd>−{formatRM(result.pricing.discountAmount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-peach/60">
            Shipping{result.pricing.freeShippingApplied ? " (waived)" : ""}
          </dt>
          <dd>{formatRM(result.pricing.shippingFee)}</dd>
        </div>
        <div className="flex justify-between border-t border-peach/20 pt-2 text-base font-bold">
          <dt>Customer pays</dt>
          <dd>{formatRM(result.pricing.total)}</dd>
        </div>
        {result.totalCost > 0 && (
          <div className="flex justify-between pt-1 text-xs">
            <dt className="text-peach/60">Your margin (after cost)</dt>
            <dd className={result.margin < 0 ? "text-red-400" : "text-emerald-400"}>
              {formatRM(result.margin)}
            </dd>
          </div>
        )}
      </dl>
    </aside>
  );
}

// The pre-checkout upsell rides on campaign tiers ("add {n} more, save
// {percent}%"), so its config lives here next to the campaigns that drive it.
// Persists straight to store settings via the partial-merge PATCH.
function UpsellPanel() {
  const [enabled, setEnabled] = useState(true);
  const [template, setTemplate] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminFetch<{
      settings: {
        preCheckoutUpsellEnabled: boolean;
        preCheckoutUpsellTemplate: string;
      };
    }>("/settings")
      .then((r) => {
        setEnabled(r.settings.preCheckoutUpsellEnabled);
        setTemplate(r.settings.preCheckoutUpsellTemplate);
      })
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await adminFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify({
          preCheckoutUpsellEnabled: enabled,
          preCheckoutUpsellTemplate: template,
        }),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <section className="mt-8 rounded-2xl border border-warmgrey/60 bg-sand/30 p-5">
      <h2 className="subhead text-xl">Pre-checkout upsell</h2>
      <p className="mt-1 text-sm text-brown">
        A nudge shown just before checkout when the cart is close to the next
        tier — &ldquo;add {"{n}"} more, save {"{percent}"}%&rdquo;. Driven by the
        quantity / cart-total tiers in the campaigns above.
      </p>
      <div className="mt-4">
        <CheckboxField
          label="Pre-checkout upsell popup enabled"
          checked={enabled}
          onCheckedChange={setEnabled}
        />
        <div className="mt-3">
          <Label>Upsell template — slots: {"{n}"} and {"{percent}"}</Label>
          <Textarea
            className="min-h-16"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button variant="accent" size="sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save upsell"}
          </Button>
          {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
        </div>
      </div>
    </section>
  );
}

export default function AdminCampaignsPage() {
  const [campaigns, setCampaigns] = useState<ApiCampaign[]>([]);
  const [form, setForm] = useState<CampaignForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const orderRef = useRef<ApiCampaign[]>([]);
  const confirm = useConfirm();

  const reload = useCallback(() => {
    adminFetch<{ campaigns: ApiCampaign[] }>("/campaigns")
      .then((r) => setCampaigns(r.campaigns))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  // Keep a ref to the live order so the drop handler reads the latest sequence
  // (it's mutated mid-drag by reorderOver, after this render's closure).
  useEffect(() => {
    orderRef.current = campaigns;
  }, [campaigns]);

  function reorderOver(overId: string) {
    if (!dragId || dragId === overId) return;
    setCampaigns((list) => {
      const from = list.findIndex((c) => c.id === dragId);
      const to = list.findIndex((c) => c.id === overId);
      if (from === -1 || to === -1) return list;
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function persistOrder() {
    if (!dragId) return;
    setDragId(null);
    try {
      await adminFetch("/campaigns/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: orderRef.current.map((c) => c.id) }),
      });
      reload();
    } catch (e) {
      setError((e as Error).message);
      reload(); // restore the saved order if the write failed
    }
  }

  async function save() {
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        rules: toRules(form),
        active: form.active,
        startAt: form.startAt || null,
        endAt: form.endAt ? `${form.endAt}T23:59:59` : null,
        priority: Number(form.priority) || 0,
        stacksWithCodes: form.stacksWithCodes,
      };
      if (form.id) {
        await adminFetch(`/campaigns/${form.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await adminFetch("/campaigns", { method: "POST", body: JSON.stringify(payload) });
      }
      setForm(null);
      reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Delete campaign",
        message: "Delete this discount campaign?",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    await adminFetch(`/campaigns/${id}`, { method: "DELETE" });
    reload();
  }

  if (form) {
    const set = <K extends keyof CampaignForm>(key: K, value: CampaignForm[K]) =>
      setForm((f) => (f ? { ...f, [key]: value } : f));
    const isTiered = form.type === "quantity_tier" || form.type === "cart_total_tier";

    return (
      <div>
        <div className="flex items-center justify-between">
          <h1 className="headline text-5xl">{form.id ? "Edit Campaign" : "New Campaign"}</h1>
          <Button variant="ghost" onClick={() => setForm(null)}>
            <X size={16} /> Close
          </Button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Name</Label>
                <Input
                  placeholder="Bundle & Save"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div>
                <Label>Type</Label>
                <Dropdown
                  value={form.type}
                  onValueChange={(v) => set("type", v as CampaignType)}
                  options={(Object.keys(TYPE_LABELS) as CampaignType[]).map(
                    (t) => ({ label: TYPE_LABELS[t], value: t }),
                  )}
                />
              </div>
            </div>

            {/* type-specific form */}
            {isTiered && (
              <div className="border border-warmgrey bg-sand/40 p-4">
                <div className="grid grid-cols-[1fr_1fr_24px] gap-2 eyebrow text-brown">
                  <span>
                    {form.type === "quantity_tier" ? "Min items" : "Min subtotal (RM)"}
                  </span>
                  <span>Discount %</span>
                  <span />
                </div>
                <div className="mt-2 space-y-2">
                  {form.tiers.map((tier, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_24px] items-center gap-2">
                      <Input
                        type="number"
                        min="1"
                        value={tier.threshold}
                        onChange={(e) =>
                          set(
                            "tiers",
                            form.tiers.map((t, j) =>
                              j === i ? { ...t, threshold: e.target.value } : t,
                            ),
                          )
                        }
                      />
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        value={tier.percent}
                        onChange={(e) =>
                          set(
                            "tiers",
                            form.tiers.map((t, j) =>
                              j === i ? { ...t, percent: e.target.value } : t,
                            ),
                          )
                        }
                      />
                      <button
                        aria-label="Remove tier"
                        className="text-warmgrey hover:text-red-700 cursor-pointer"
                        onClick={() => set("tiers", form.tiers.filter((_, j) => j !== i))}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="mt-3 text-xs text-ember hover:underline cursor-pointer"
                  onClick={() => set("tiers", [...form.tiers, { threshold: "", percent: "" }])}
                >
                  + add tier
                </button>
              </div>
            )}
            {form.type === "buy_x_get_y" && (
              <div className="grid max-w-sm grid-cols-2 gap-4 border border-warmgrey bg-sand/40 p-4">
                <div>
                  <Label>Buy (items)</Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.buyQty}
                    onChange={(e) => set("buyQty", e.target.value)}
                  />
                </div>
                <div>
                  <Label>Get % off cart</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={form.percent}
                    onChange={(e) => set("percent", e.target.value)}
                  />
                </div>
              </div>
            )}
            {form.type === "free_shipping_over" && (
              <div className="max-w-sm border border-warmgrey bg-sand/40 p-4">
                <Label>Free shipping when subtotal ≥ (RM)</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.minSubtotal}
                  onChange={(e) => set("minSubtotal", e.target.value)}
                />
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <Label>Starts</Label>
                <Input
                  type="date"
                  value={form.startAt}
                  onChange={(e) => set("startAt", e.target.value)}
                />
              </div>
              <div>
                <Label>Ends</Label>
                <Input
                  type="date"
                  value={form.endAt}
                  onChange={(e) => set("endAt", e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-warmgrey">
              Priority is set by drag-and-drop order on the Campaigns list — no
              number to guess. When two campaigns give the same discount, the one
              higher in the list wins.
            </p>
            <div className="flex flex-wrap gap-6 text-sm">
              <CheckboxField
                label="Active"
                checked={form.active}
                onCheckedChange={(v) => set("active", v)}
              />
              <CheckboxField
                label="Stack promo codes on top of this campaign"
                checked={form.stacksWithCodes}
                onCheckedChange={(v) => set("stacksWithCodes", v)}
              />
            </div>
            <p className="text-xs text-warmgrey">
              By default the engine applies only the single largest discount
              (best campaign or promo code). Turn on stacking to let a promo code
              add on top of this campaign — both then show as separate lines at
              checkout.
            </p>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex gap-3 border-t border-warmgrey pt-5">
              <Button variant="accent" onClick={save} disabled={busy || !form.name.trim()}>
                {busy ? "Saving…" : "Save campaign"}
              </Button>
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancel
              </Button>
            </div>
          </div>

          <LiveCalculator form={form} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="headline text-4xl sm:text-5xl">Campaigns</h1>
        <Button
          variant="accent"
          className="w-full sm:w-auto"
          onClick={() => setForm({ ...EMPTY })}
        >
          <Plus size={16} /> New campaign
        </Button>
      </div>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {campaigns.length > 1 && (
        <p className="mt-6 text-xs text-brown">
          Drag to reorder — the higher a campaign sits, the higher its priority
          when two give the same discount.
        </p>
      )}
      <div className="mt-3 space-y-3">
        {campaigns.map((c) => (
          <div
            key={c.id}
            draggable
            onDragStart={() => setDragId(c.id)}
            onDragEnter={() => reorderOver(c.id)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={persistOrder}
            onDrop={(e) => {
              e.preventDefault();
              persistOrder();
            }}
            className={`flex flex-wrap items-center justify-between gap-3 border border-warmgrey bg-sand/40 p-4 ${
              dragId === c.id ? "opacity-50" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden
                className="shrink-0 cursor-grab text-warmgrey active:cursor-grabbing"
              >
                <GripVertical size={16} />
              </span>
              <button
                className="min-w-0 text-left cursor-pointer"
                onClick={() => setForm(toForm(c))}
              >
                <p className="subhead text-lg hover:text-ember">{c.name}</p>
                <p className="mt-0.5 text-xs text-brown">
                  {TYPE_LABELS[c.type]}
                  {c.startAt ? ` · from ${c.startAt.slice(0, 10)}` : ""}
                  {c.endAt ? ` · until ${c.endAt.slice(0, 10)}` : ""}
                </p>
              </button>
            </div>
            <div className="flex items-center gap-3">
              <Badge tone={c.active ? "ember" : "outline"}>
                {c.active ? "active" : "off"}
              </Badge>
              <button
                aria-label={`Delete ${c.name}`}
                className="text-warmgrey hover:text-red-700 cursor-pointer"
                onClick={() => remove(c.id)}
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {campaigns.length === 0 && (
          <p className="text-sm text-brown">No campaigns yet — create the first one.</p>
        )}
      </div>

      <UpsellPanel />
    </div>
  );
}
