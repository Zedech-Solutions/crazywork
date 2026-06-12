"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { useConfirm } from "@/components/admin/confirm";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Input, Label, Textarea } from "@/components/ui/field";

interface ApiFaq {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  sortOrder: number;
  published: boolean;
}

export default function AdminFaqsPage() {
  const [faqs, setFaqs] = useState<ApiFaq[]>([]);
  const [draft, setDraft] = useState({ question: "", answer: "", category: "" });
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const reload = useCallback(() => {
    adminFetch<{ faqs: ApiFaq[] }>("/faqs")
      .then((r) => setFaqs(r.faqs))
      .catch((e) => setError(e.message));
  }, []);
  useEffect(reload, [reload]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      await adminFetch("/faqs", {
        method: "POST",
        body: JSON.stringify({ ...draft, sortOrder: faqs.length }),
      });
      setDraft({ question: "", answer: "", category: "" });
      reload();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function update(id: string, data: Partial<ApiFaq>) {
    await adminFetch(`/faqs/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    reload();
  }

  async function remove(id: string) {
    if (
      !(await confirm({
        title: "Delete FAQ",
        message: "Delete this question and answer?",
        confirmLabel: "Delete",
        danger: true,
      }))
    )
      return;
    await adminFetch(`/faqs/${id}`, { method: "DELETE" });
    reload();
  }

  return (
    <div className="max-w-3xl">
      <h1 className="headline text-5xl">FAQs</h1>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <form onSubmit={create} className="mt-8 border border-warmgrey bg-sand/40 p-5">
        <p className="subhead text-lg">New FAQ</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-[2fr_1fr]">
          <div>
            <Label>Question</Label>
            <Input
              required
              value={draft.question}
              onChange={(e) => setDraft({ ...draft, question: e.target.value })}
            />
          </div>
          <div>
            <Label>Category</Label>
            <Input
              placeholder="Shipping / Sizing / Returns"
              value={draft.category}
              onChange={(e) => setDraft({ ...draft, category: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-3">
          <Label>Answer</Label>
          <Textarea
            required
            value={draft.answer}
            onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
          />
        </div>
        <Button type="submit" variant="accent" className="mt-4">
          <Plus size={15} /> Add FAQ
        </Button>
      </form>

      <div className="mt-8 space-y-3">
        {faqs.map((faq) => (
          <details key={faq.id} className="border border-warmgrey bg-sand/30 p-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
              <span className="subhead text-base">{faq.question}</span>
              <span className="flex items-center gap-3 text-xs text-brown">
                {faq.category ?? "General"}
                <span onClick={(e) => e.stopPropagation()}>
                  <CheckboxField
                    label="Live"
                    checked={faq.published}
                    onCheckedChange={(v) => update(faq.id, { published: v })}
                  />
                </span>
                <button
                  aria-label="Delete FAQ"
                  className="text-warmgrey hover:text-red-700 cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault();
                    remove(faq.id);
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </summary>
            <Textarea
              className="mt-3"
              defaultValue={faq.answer}
              onBlur={(e) => update(faq.id, { answer: e.target.value })}
            />
          </details>
        ))}
      </div>
    </div>
  );
}
