"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Label, Textarea } from "@/components/ui/field";
import { formatRM, toSen } from "@/lib/money";

interface Variant {
  id: string;
  size: string;
  colour: string;
  stock: number;
}
interface Product {
  id: string;
  name: string;
  basePrice: string;
  status: "active" | "draft";
  variants: Variant[];
}
interface Line {
  productId: string;
  variantId: string;
  quantity: number;
}

const STATUS_OPTIONS = [
  { label: "Paid", value: "paid" },
  { label: "Delivered", value: "delivered" },
  { label: "Processing", value: "processing" },
  { label: "Shipped", value: "shipped" },
  { label: "Pending (no stock change)", value: "pending" },
];

const PAYMENT_OPTIONS = [
  { label: "Cash", value: "cash" },
  { label: "Bank transfer", value: "bank_transfer" },
  { label: "FPX / DuitNow", value: "fpx" },
  { label: "Card (in person)", value: "card" },
  { label: "Stripe", value: "stripe" },
  { label: "Other / offline", value: "offline" },
];

export function NewOrderDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [lines, setLines] = useState<Line[]>([
    { productId: "", variantId: "", quantity: 1 },
  ]);
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [status, setStatus] = useState("paid");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [addCustomer, setAddCustomer] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && products.length === 0) {
      adminFetch<{ products: Product[] }>("/products")
        .then((r) => setProducts(r.products))
        .catch((e) => setError(e.message));
    }
  }, [open, products.length]);

  const [restock, setRestock] = useState<Record<string, string>>({});

  const byId = new Map(products.map((p) => [p.id, p]));
  const deductsStock = status !== "pending";

  function variantOf(line: Line): Variant | undefined {
    return byId.get(line.productId)?.variants.find((v) => v.id === line.variantId);
  }

  // Lines whose qty is more than what's on the shelf (only matters when stock
  // will actually be deducted, i.e. status isn't Pending).
  type Exceeded = { i: number; line: Line; variant: Variant };
  const exceeded: Exceeded[] = (
    deductsStock
      ? lines.map((line, i) => {
          const v = variantOf(line);
          return line.variantId && v && line.quantity > v.stock
            ? { i, line, variant: v }
            : null;
        })
      : []
  ).filter((x): x is Exceeded => x !== null);

  async function applyRestock(variantId: string) {
    const value = restock[variantId];
    const stock = Math.max(0, Math.round(Number(value)));
    if (!Number.isFinite(stock)) return;
    try {
      await adminFetch(`/variants/${variantId}`, {
        method: "PATCH",
        body: JSON.stringify({ stock }),
      });
      // reflect the new stock locally so the warning clears
      setProducts((ps) =>
        ps.map((p) => ({
          ...p,
          variants: p.variants.map((v) =>
            v.id === variantId ? { ...v, stock } : v,
          ),
        })),
      );
      setRestock((r) => {
        const next = { ...r };
        delete next[variantId];
        return next;
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function reset() {
    setLines([{ productId: "", variantId: "", quantity: 1 }]);
    setCustomer({ name: "", email: "", phone: "" });
    setStatus("paid");
    setPaymentMethod("cash");
    setAmount("");
    setNote("");
    setAddCustomer(true);
    setError(null);
  }

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  const totalSen = lines.reduce((sum, l) => {
    const p = byId.get(l.productId);
    return p ? sum + toSen(p.basePrice) * l.quantity : sum;
  }, 0);

  async function submit() {
    setError(null);
    const items = lines
      .filter((l) => l.variantId)
      .map((l) => ({ variantId: l.variantId, quantity: l.quantity }));
    if (!items.length) return setError("Add at least one item.");
    if (!customer.name.trim()) return setError("Customer name is required.");
    if (exceeded.length > 0) {
      return setError(
        "Some items exceed available stock — lower the quantity or restock below.",
      );
    }
    const totalSen = amount.trim()
      ? Math.round(parseFloat(amount) * 100)
      : undefined;
    if (totalSen != null && !Number.isFinite(totalSen)) {
      return setError("Amount charged is not a valid number.");
    }
    setBusy(true);
    try {
      await adminFetch("/orders", {
        method: "POST",
        body: JSON.stringify({
          items,
          customer,
          status,
          note,
          totalSen,
          createCustomer: addCustomer,
          paymentMethod,
        }),
      });
      setOpen(false);
      reset();
      onCreated();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <Plus size={14} /> New order
        </Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[88vh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto"
      >
        <DialogTitle className="headline text-3xl">New order</DialogTitle>
        <p className="mt-1 text-xs text-brown">
          For offline / walk-in sales. Stock is deducted unless status is Pending.
        </p>

        {/* line items */}
        <div className="mt-4 space-y-3">
          {lines.map((line, i) => {
            const product = byId.get(line.productId);
            return (
              <div
                key={i}
                className="flex flex-wrap items-end gap-2 rounded-lg border border-warmgrey/60 bg-sand/30 p-3"
              >
                <div className="min-w-[160px] flex-1">
                  <Label>Product</Label>
                  <Dropdown
                    value={line.productId || "none"}
                    onValueChange={(v) =>
                      updateLine(i, { productId: v === "none" ? "" : v, variantId: "" })
                    }
                    options={[
                      { label: "Select…", value: "none" },
                      ...products.map((p) => ({ label: p.name, value: p.id })),
                    ]}
                  />
                </div>
                <div className="min-w-[150px] flex-1">
                  <Label>Variant</Label>
                  <Dropdown
                    value={line.variantId || "none"}
                    onValueChange={(v) =>
                      updateLine(i, { variantId: v === "none" ? "" : v })
                    }
                    options={[
                      { label: "Select…", value: "none" },
                      ...(product?.variants ?? []).map((v) => ({
                        label: `${v.size}/${v.colour} · ${v.stock} left`,
                        value: v.id,
                      })),
                    ]}
                  />
                </div>
                <div className="w-20">
                  <Label>Qty</Label>
                  <Input
                    type="number"
                    min={1}
                    value={line.quantity}
                    onChange={(e) =>
                      updateLine(i, {
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                  />
                </div>
                <button
                  aria-label="Remove item"
                  className="p-2 text-warmgrey hover:text-red-700 cursor-pointer"
                  onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            );
          })}
          <button
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-ember/60 px-3 py-2 text-xs font-medium text-ember hover:bg-ember/10 cursor-pointer"
            onClick={() =>
              setLines((ls) => [...ls, { productId: "", variantId: "", quantity: 1 }])
            }
          >
            <Plus size={13} /> Add item
          </button>
        </div>

        {/* customer */}
        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <Label>Customer name *</Label>
            <Input
              value={customer.name}
              onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))}
            />
          </div>
          <div>
            <Label>Email (optional)</Label>
            <Input
              value={customer.email}
              onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))}
            />
          </div>
          <div>
            <Label>Phone (optional)</Label>
            <Input
              value={customer.phone}
              onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))}
            />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <Label>Status</Label>
            <Dropdown value={status} onValueChange={setStatus} options={STATUS_OPTIONS} />
          </div>
          <div>
            <Label>Payment method</Label>
            <Dropdown
              value={paymentMethod}
              onValueChange={setPaymentMethod}
              options={PAYMENT_OPTIONS}
            />
          </div>
        </div>

        <div className="mt-3">
          <Label>Note (optional)</Label>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={1}
          />
        </div>

        <div className="mt-3">
          <CheckboxField
            label="Save as a customer account"
            checked={addCustomer}
            onCheckedChange={setAddCustomer}
          />
          <p className="mt-1 text-[11px] text-warmgrey">
            {addCustomer
              ? "Creates a customer record by email (shows in Customers). Email required."
              : "Off → private sale: the order is recorded but won't appear in Customers at all."}
          </p>
        </div>

        {/* stock-exceeded warning + fixes */}
        {exceeded.length > 0 && (
          <div className="mt-4 space-y-2 rounded-lg border border-red-300 bg-red-50 p-3">
            <p className="text-sm font-bold text-red-700">
              These quantities exceed what&apos;s in stock:
            </p>
            {exceeded.map(({ i, line, variant }) => {
              const product = byId.get(line.productId);
              return (
                <div
                  key={variant.id}
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <span className="font-medium">
                    {product?.name} ({variant.size}/{variant.colour}) — ordered{" "}
                    {line.quantity}, only{" "}
                    <span className="font-bold">{variant.stock}</span> left.
                  </span>
                  <button
                    onClick={() => updateLine(i, { quantity: variant.stock })}
                    className="rounded border border-ink px-2 py-0.5 font-medium hover:bg-ink hover:text-peach cursor-pointer"
                  >
                    Use {variant.stock}
                  </button>
                  <span className="text-brown">or restock to</span>
                  <Input
                    type="number"
                    min={0}
                    className="w-20 py-0.5"
                    placeholder={String(line.quantity)}
                    value={restock[variant.id] ?? ""}
                    onChange={(e) =>
                      setRestock((r) => ({ ...r, [variant.id]: e.target.value }))
                    }
                  />
                  <button
                    onClick={() => applyRestock(variant.id)}
                    className="rounded border border-ember px-2 py-0.5 font-medium text-ember hover:bg-ember hover:text-peach cursor-pointer"
                  >
                    Set stock
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-warmgrey/60 pt-4">
          <div>
            <Label>Amount charged (RM)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              className="w-32"
              placeholder={(totalSen / 100).toFixed(2)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <p className="mt-1 text-[11px] text-warmgrey">
              Items total {formatRM(totalSen)} · leave blank to charge full price
            </p>
          </div>
          <Button variant="accent" onClick={submit} disabled={busy}>
            {busy ? "Creating…" : "Create order"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
