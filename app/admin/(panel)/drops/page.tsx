"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { useConfirm } from "@/components/admin/confirm";
import { Button } from "@/components/ui/button";
import { Dropdown } from "@/components/ui/dropdown";
import { Input, Label } from "@/components/ui/field";

const DROP_STATUS = [
  { label: "Current (featured on home)", value: "current" },
  { label: "Past", value: "past" },
  { label: "Sold out", value: "soldout" },
];

interface ApiDrop {
  id: string;
  name: string;
  slug: string;
  status: "current" | "past" | "soldout";
  sortOrder: number;
  products: { id: string; name: string }[];
}

export default function AdminDropsPage() {
  const [drops, setDrops] = useState<ApiDrop[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const reload = useCallback(() => {
    adminFetch<{ drops: ApiDrop[] }>("/drops")
      .then((r) => setDrops(r.drops))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await adminFetch("/drops", {
      method: "POST",
      body: JSON.stringify({
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        status: "current",
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

  return (
    <div className="max-w-3xl">
      <h1 className="headline text-5xl">Drops</h1>
      <p className="mt-2 text-sm text-brown">
        Assign products to drops from the product editor. Statuses: current
        (featured on home), past, soldout (everything shows sold out).
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
          <div key={drop.id} className="border border-warmgrey bg-sand/40 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="subhead text-xl">{drop.name}</p>
              <div className="flex items-center gap-2">
                <Dropdown
                  className="w-52"
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
            <p className="mt-2 text-xs text-brown">
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
