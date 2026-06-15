"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { useConfirm } from "@/components/admin/confirm";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Label } from "@/components/ui/field";

const DROP_STATUS = [
  { label: "Current", value: "current" },
  { label: "Past", value: "past" },
  { label: "Sold out", value: "soldout" },
];

interface ApiDrop {
  id: string;
  name: string;
  slug: string;
  status: "current" | "past" | "soldout";
  featuredOnHome: boolean;
  sortOrder: number;
  products: { id: string; name: string }[];
}

export default function AdminDropsPage() {
  const [drops, setDrops] = useState<ApiDrop[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const orderRef = useRef<ApiDrop[]>([]);
  const confirm = useConfirm();

  const reload = useCallback(() => {
    adminFetch<{ drops: ApiDrop[] }>("/drops")
      .then((r) => setDrops(r.drops))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  // Keep the live order in a ref so the drop handler persists the latest sequence.
  useEffect(() => {
    orderRef.current = drops;
  }, [drops]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await adminFetch("/drops", {
      method: "POST",
      body: JSON.stringify({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        status: "current",
        featuredOnHome: false,
        sortOrder: drops.length,
      }),
    }).catch((err) => setError(err.message));
    setName("");
    reload();
  }

  async function update(id: string, data: Partial<ApiDrop>) {
    await adminFetch(`/drops/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    reload();
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Delete drop",
        message: "Delete this drop? Its products stay, just unassigned.",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    await adminFetch(`/drops/${id}`, { method: "DELETE" });
    reload();
  }

  // Drag-and-drop: live-reorder the list, persist the sequence on drop.
  function reorderOver(overId: string) {
    if (!dragId || dragId === overId) return;
    setDrops((list) => {
      const from = list.findIndex((d) => d.id === dragId);
      const to = list.findIndex((d) => d.id === overId);
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
      await adminFetch("/drops/reorder", {
        method: "POST",
        body: JSON.stringify({ ids: orderRef.current.map((d) => d.id) }),
      });
      reload();
    } catch (e) {
      setError((e as Error).message);
      reload();
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="headline text-5xl">Drops</h1>
      <p className="mt-2 text-sm text-brown">
        Assign products to drops from the product editor. Tick{" "}
        <span className="font-bold">Featured on home</span> to stack a drop on the
        home page — current, past or sold-out all work. Drag to set the order they
        appear.
      </p>

      <form onSubmit={create} className="mt-6 flex max-w-md items-end gap-2">
        <div className="flex-1">
          <Label htmlFor="drop-name">New drop name</Label>
          <Input
            id="drop-name"
            placeholder="Drop 03 — Iron Season"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="accent">
          <Plus size={15} /> Create
        </Button>
      </form>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-8 space-y-4">
        {drops.map((drop) => (
          <div
            key={drop.id}
            draggable
            onDragStart={() => setDragId(drop.id)}
            onDragEnter={() => reorderOver(drop.id)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnd={persistOrder}
            onDrop={(e) => {
              e.preventDefault();
              persistOrder();
            }}
            className={`border border-warmgrey bg-sand/40 p-5 ${
              dragId === drop.id ? "opacity-50" : ""
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  aria-hidden
                  className="shrink-0 cursor-grab text-warmgrey active:cursor-grabbing"
                >
                  <GripVertical size={16} />
                </span>
                <p className="subhead truncate text-xl">{drop.name}</p>
              </div>
              <div className="flex items-center gap-3">
                <CheckboxField
                  label="Featured on home"
                  checked={drop.featuredOnHome}
                  onCheckedChange={(v) => update(drop.id, { featuredOnHome: v })}
                />
                <Dropdown
                  className="w-36"
                  value={drop.status}
                  onValueChange={(v) =>
                    update(drop.id, { status: v as ApiDrop["status"] })
                  }
                  options={DROP_STATUS}
                />
                <button
                  aria-label={`Delete ${drop.name}`}
                  className="text-warmgrey hover:text-red-700 cursor-pointer"
                  onClick={() => remove(drop.id)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <p className="mt-2 pl-6 text-xs text-brown">
              {drop.products.length === 0
                ? "No products assigned"
                : drop.products.map((p) => p.name).join(" · ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
