"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Mail, MessageCircle, type LucideIcon } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { SizeGuideEditor } from "@/components/admin/size-guide-editor";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { Dropdown } from "@/components/ui/dropdown";
import { Badge, Input, Label, Textarea } from "@/components/ui/field";
import type { Settings } from "@/lib/settings";
import { DEFAULT_SIZE_GUIDE, type SizeGuideTable } from "@/lib/size-guide";

interface SecretStatus {
  key: string;
  configured: boolean;
  hint: string | null;
}

const SECRET_LABELS: Record<string, string> = {
  stripe_secret_key: "Secret key",
  stripe_publishable_key: "Publishable key",
  stripe_webhook_secret: "Webhook secret",
  resend_api_key: "API key",
  resend_from_email: "From email",
  discord_webhook_url: "Webhook URL",
};

interface Provider {
  id: string;
  name: string;
  blurb: string;
  Icon: LucideIcon;
  accent: string;
  keys: string[];
}

const PROVIDERS: Provider[] = [
  {
    id: "stripe",
    name: "Stripe",
    blurb: "Cards, FPX & GrabPay (MYR) — powers checkout.",
    Icon: CreditCard,
    accent: "#635bff",
    keys: ["stripe_secret_key", "stripe_publishable_key", "stripe_webhook_secret"],
  },
  {
    id: "resend",
    name: "Resend",
    blurb: "Transactional email — confirmations & resets.",
    Icon: Mail,
    accent: "#1a1a1a",
    keys: ["resend_api_key", "resend_from_email"],
  },
  {
    id: "discord",
    name: "Discord",
    blurb: "Owner alert on every paid order.",
    Icon: MessageCircle,
    accent: "#5865f2",
    keys: ["discord_webhook_url"],
  },
];

// One compact row per secret — table-like: status dot · label · value · save.
function KeyRow({
  secret,
  onSaved,
}: {
  secret: SecretStatus;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await adminFetch(`/secrets/${secret.key}`, {
        method: "PUT",
        body: JSON.stringify({ value }),
      });
      setValue("");
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5 border-b border-warmgrey/30 py-2.5 last:border-0">
      <span
        title={secret.configured ? "Set" : "Empty"}
        className={`h-2 w-2 shrink-0 rounded-full ${
          secret.configured ? "bg-emerald-600" : "bg-warmgrey"
        }`}
      />
      <span className="w-28 shrink-0 text-xs font-medium text-brown">
        {SECRET_LABELS[secret.key] ?? secret.key}
      </span>
      <Input
        className="h-9 flex-1"
        type="password"
        autoComplete="off"
        placeholder={secret.hint ?? "Paste value…"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <Button
        size="sm"
        variant={value ? "accent" : "outline"}
        onClick={save}
        disabled={busy || !value}
      >
        Save
      </Button>
    </div>
  );
}

function IntegrationCard({
  provider,
  secrets,
  onSaved,
}: {
  provider: Provider;
  secrets: SecretStatus[];
  onSaved: () => void;
}) {
  const [test, setTest] = useState<string | null>(null);
  const { Icon } = provider;
  const mine = provider.keys
    .map((k) => secrets.find((s) => s.key === k))
    .filter(Boolean) as SecretStatus[];
  const setCount = mine.filter((s) => s.configured).length;
  const status =
    setCount === 0
      ? { label: "Not connected", tone: "outline" as const }
      : setCount === mine.length
        ? { label: "Connected", tone: "ember" as const }
        : { label: "Partial", tone: "sand" as const };

  async function runTest() {
    const result = await adminFetch<{ ok: boolean; message: string }>(
      `/secrets/${provider.keys[0]}/test`,
      { method: "POST", body: JSON.stringify({}) },
    );
    setTest(result.message);
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-warmgrey/60 bg-white/50">
      <div className="flex items-center gap-3 border-b border-warmgrey/60 bg-sand/40 px-4 py-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white"
          style={{ background: provider.accent }}
        >
          <Icon size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="subhead text-base leading-none">{provider.name}</p>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-brown">{provider.blurb}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={runTest}>
          Test
        </Button>
      </div>
      <div className="px-4">
        {mine.map((secret) => (
          <KeyRow key={secret.key} secret={secret} onSaved={onSaved} />
        ))}
      </div>
      {test && <p className="px-4 pb-3 pt-1 text-xs text-brown">{test}</p>}
    </div>
  );
}

export default function AdminSettingsPage() {
  const [secrets, setSecrets] = useState<SecretStatus[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const [sizeGuide, setSizeGuide] = useState<SizeGuideTable>(DEFAULT_SIZE_GUIDE);
  const [guideSaved, setGuideSaved] = useState(false);

  const reload = useCallback(() => {
    adminFetch<{ runtime: SecretStatus[] }>("/secrets")
      .then((r) => setSecrets(r.runtime))
      .catch((e) => setError(e.message));
    adminFetch<{ settings: Settings }>("/settings")
      .then((r) => setSettings(r.settings))
      .catch((e) => setError(e.message));
    adminFetch<{ sizeGuide: SizeGuideTable }>("/size-guide")
      .then((r) => setSizeGuide(r.sizeGuide))
      .catch(() => {});
  }, []);
  useEffect(reload, [reload]);

  async function saveSizeGuide() {
    setBusy(true);
    setGuideSaved(false);
    try {
      await adminFetch("/size-guide", {
        method: "PUT",
        body: JSON.stringify({ sizeGuide }),
      });
      setGuideSaved(true);
      setTimeout(() => setGuideSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    if (!settings) return;
    setBusy(true);
    setSaved(false);
    try {
      await adminFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

  return (
    <div className="max-w-3xl">
      <h1 className="headline text-5xl">Settings</h1>
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      {/* INTEGRATIONS */}
      <section className="mt-10">
        <h2 className="subhead text-2xl">Integrations</h2>
        <p className="mt-1 text-sm text-brown">
          Connect your providers. Keys are encrypted at rest (AES-256-GCM),
          decrypted in-memory at call time, and never displayed back.
        </p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {PROVIDERS.map((provider) => (
            <IntegrationCard
              key={provider.id}
              provider={provider}
              secrets={secrets}
              onSaved={reload}
            />
          ))}
        </div>
      </section>

      {/* STORE */}
      {settings && (
        <section className="mt-12 border-t border-warmgrey pt-8">
          <h2 className="subhead text-2xl">Store</h2>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <Label>West shipping (RM)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={settings.shippingWest / 100}
                onChange={(e) => set("shippingWest", Math.round(Number(e.target.value) * 100))}
              />
            </div>
            <div>
              <Label>East shipping (RM)</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={settings.shippingEast / 100}
                onChange={(e) => set("shippingEast", Math.round(Number(e.target.value) * 100))}
              />
            </div>
            <div>
              <Label>Free shipping over (RM)</Label>
              <Input
                type="number"
                min="0"
                value={settings.freeShippingThreshold / 100}
                onChange={(e) =>
                  set("freeShippingThreshold", Math.round(Number(e.target.value) * 100))
                }
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Instagram URL</Label>
              <Input
                value={settings.socialInstagram}
                onChange={(e) => set("socialInstagram", e.target.value)}
              />
            </div>
            <div>
              <Label>TikTok URL</Label>
              <Input
                value={settings.socialTiktok}
                onChange={(e) => set("socialTiktok", e.target.value)}
              />
            </div>
            <div>
              <Label>Contact email</Label>
              <Input
                value={settings.socialEmail}
                onChange={(e) => set("socialEmail", e.target.value)}
              />
            </div>
            <div>
              <Label>SSM number</Label>
              <Input
                value={settings.ssmNumber}
                onChange={(e) => set("ssmNumber", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Owner alert channel (paid orders)</Label>
              <Dropdown
                value={settings.ownerAlertChannel}
                onValueChange={(v) =>
                  set("ownerAlertChannel", v as "discord" | "email")
                }
                options={[
                  { label: "Discord webhook", value: "discord" },
                  { label: "Email", value: "email" },
                ]}
              />
            </div>
            <div>
              <Label>Owner alert email</Label>
              <Input
                value={settings.ownerAlertEmail}
                onChange={(e) => set("ownerAlertEmail", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Email popup delay (seconds)</Label>
              <Input
                type="number"
                min="0"
                value={settings.popupDelaySeconds}
                onChange={(e) => set("popupDelaySeconds", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Drop countdown until (ISO date, optional)</Label>
              <Input
                placeholder="2026-07-01T00:00:00+08:00"
                value={settings.dropCountdownUntil}
                onChange={(e) => set("dropCountdownUntil", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-warmgrey/60 bg-sand/40 p-4">
            <CheckboxField
              label="Pre-checkout upsell popup enabled"
              checked={settings.preCheckoutUpsellEnabled}
              onCheckedChange={(v) => set("preCheckoutUpsellEnabled", v)}
            />
            <div className="mt-3">
              <Label>Upsell template — slots: {"{n}"} and {"{percent}"}</Label>
              <Textarea
                className="min-h-16"
                value={settings.preCheckoutUpsellTemplate}
                onChange={(e) => set("preCheckoutUpsellTemplate", e.target.value)}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center gap-3">
            <Button variant="accent" onClick={saveSettings} disabled={busy}>
              {busy ? "Saving…" : "Save store settings"}
            </Button>
            {saved && <span className="text-sm text-emerald-700">Saved ✓</span>}
          </div>
        </section>
      )}

      {/* DEFAULT SIZE GUIDE */}
      <section className="mt-12 border-t border-warmgrey pt-8">
        <h2 className="subhead text-2xl">Default size guide</h2>
        <p className="mt-1 text-sm text-brown">
          Shown on every product that doesn&apos;t define its own. Products can
          override this with a custom chart in the product editor.
        </p>
        <div className="mt-4">
          <SizeGuideEditor value={sizeGuide} onChange={setSizeGuide} />
        </div>
        <div className="mt-5 flex items-center gap-3">
          <Button variant="accent" onClick={saveSizeGuide} disabled={busy}>
            {busy ? "Saving…" : "Save default size guide"}
          </Button>
          {guideSaved && (
            <span className="text-sm text-emerald-700">Saved ✓</span>
          )}
        </div>
      </section>
    </div>
  );
}
