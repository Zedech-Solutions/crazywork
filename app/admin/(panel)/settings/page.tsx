"use client";

import { useCallback, useEffect, useState } from "react";
import { Info } from "lucide-react";
import { adminFetch } from "@/components/admin/api";
import { SizeGuideEditor } from "@/components/admin/size-guide-editor";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  stripe_live_secret_key: "Secret key",
  stripe_live_publishable_key: "Publishable key",
  stripe_live_webhook_secret: "Webhook secret",
  resend_api_key: "API key",
  resend_from_email: "From email",
  discord_webhook_url: "Webhook URL",
};

type StripeMode = "test" | "live";

// A setup step shown in the "How to connect" dialog. `code` is rendered as a
// command block; the "{origin}" token is swapped for the live dashboard origin
// (so the Stripe CLI target always matches whatever port you're on).
interface SetupStep {
  text: string;
  code?: string;
}

interface Provider {
  id: string;
  name: string;
  blurb: string;
  iconSrc: string;
  keys: string[];
  // Connection walkthrough, split into Test and Live tabs.
  setupSteps?: Record<StripeMode, SetupStep[]>;
  // Providers with a test/live switch list their keys per mode; the card then
  // shows a Test/Live toggle and the rows for the active mode.
  keysByMode?: Record<StripeMode, string[]>;
  // Override the default stub test endpoint with a real connectivity check.
  testEndpoint?: string;
}

const PROVIDERS: Provider[] = [
  {
    id: "stripe",
    name: "Stripe",
    blurb: "Cards, FPX & GrabPay (MYR) — powers checkout.",
    iconSrc: "/images/integrations/stripe.jpg",
    keys: ["stripe_secret_key", "stripe_publishable_key", "stripe_webhook_secret"],
    keysByMode: {
      test: [
        "stripe_secret_key",
        "stripe_publishable_key",
        "stripe_webhook_secret",
      ],
      live: [
        "stripe_live_secret_key",
        "stripe_live_publishable_key",
        "stripe_live_webhook_secret",
      ],
    },
    testEndpoint: "/integrations/stripe/test",
    setupSteps: {
      test: [
        {
          text: "In Stripe, turn the Test mode toggle ON (top-right). Go to Developers → API keys.",
        },
        {
          text: "Copy the Secret key (sk_test_…) and Publishable key (pk_test_…). With this card's toggle on Test, paste each into the matching field below and press Save.",
        },
        {
          text: "Settings → Payment methods: enable Cards, FPX and GrabPay (they appear at checkout automatically).",
        },
        {
          text: "Get the webhook signing secret. Install the Stripe CLI (brew install stripe/stripe-cli/stripe), run stripe login, then run this and leave it open in its own terminal:",
          code: "stripe listen --forward-to {origin}/api/webhook/payment",
        },
        {
          text: "The CLI prints a whsec_… — paste it into the Webhook secret field below and press Save. The badge flips to Connected.",
        },
        {
          text: "Test it: checkout on the storefront, pay with card 4242 4242 4242 4242 (any future expiry / CVC). The webhook marks the order paid.",
        },
      ],
      live: [
        {
          text: "Live needs your store deployed at a public HTTPS URL — Stripe can't reach localhost for live events, so there's no CLI here.",
        },
        {
          text: "Activate your Stripe account (submit business details) so live charges + FPX/GrabPay work.",
        },
        {
          text: "Turn the Stripe Test-mode toggle OFF. Developers → API keys → copy the live Secret key (sk_live_…) and Publishable key (pk_live_…).",
        },
        {
          text: "Switch this card's toggle to Live, paste those into the fields below, press Save.",
        },
        {
          text: "Developers → Webhooks → Add endpoint. URL: https://<your-live-domain>/api/webhook/payment, event checkout.session.completed.",
        },
        {
          text: "Reveal that endpoint's Signing secret (whsec_…) → paste into the Webhook secret field below → Save. ⚠ Live = real cards and real charges.",
        },
      ],
    },
  },
  {
    id: "resend",
    name: "Resend",
    blurb: "Transactional email — confirmations & resets.",
    iconSrc: "/images/integrations/resend.jpg",
    keys: ["resend_api_key", "resend_from_email"],
  },
  {
    id: "discord",
    name: "Discord",
    blurb: "Owner alert on every paid order.",
    iconSrc: "/images/integrations/discord.png",
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

// Info-icon dialog with the provider's connection walkthrough, split into Test
// and Live tabs. The "{origin}" token in any step command is replaced with the
// live dashboard origin so the Stripe CLI target matches whatever port you run.
function SetupDialog({
  provider,
  mode,
}: {
  provider: Provider;
  mode: StripeMode;
}) {
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [tab, setTab] = useState<StripeMode>(mode);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  if (!provider.setupSteps) return null;
  const steps = provider.setupSteps[tab];

  return (
    <Dialog>
      <DialogTrigger
        className="shrink-0 cursor-pointer text-brown hover:text-ember"
        aria-label={`How to connect ${provider.name}`}
        title="How to connect"
      >
        <Info size={16} />
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogTitle className="subhead text-xl">
          Connect {provider.name}
        </DialogTitle>
        <p className="mt-1 text-xs text-brown">{provider.blurb}</p>

        <div className="mt-3 flex w-fit rounded-lg border border-warmgrey/60 p-0.5">
          {(["test", "live"] as StripeMode[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1 text-xs font-semibold capitalize transition-colors ${
                tab === t
                  ? t === "live"
                    ? "bg-ember text-white"
                    : "bg-ink text-peach"
                  : "text-brown hover:text-ink"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <ol className="mt-4 max-h-[60vh] space-y-3 overflow-y-auto pr-1">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-sm text-ink">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-peach">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="leading-snug">{step.text}</p>
                {step.code && (
                  <pre className="mt-1.5 overflow-x-auto rounded-md border border-ink/20 bg-ink/5 px-2.5 py-1.5 text-xs">
                    <code>{step.code.replace("{origin}", origin)}</code>
                  </pre>
                )}
              </div>
            </li>
          ))}
        </ol>
      </DialogContent>
    </Dialog>
  );
}

function IntegrationCard({
  provider,
  secrets,
  onSaved,
  mode,
  onModeChange,
}: {
  provider: Provider;
  secrets: SecretStatus[];
  onSaved: () => void;
  mode: StripeMode;
  onModeChange: (mode: StripeMode) => void;
}) {
  const [test, setTest] = useState<string | null>(null);
  const activeKeys = provider.keysByMode
    ? provider.keysByMode[mode]
    : provider.keys;
  const mine = activeKeys
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
    setTest("Testing…");
    try {
      const result = await adminFetch<{ ok: boolean; message: string }>(
        provider.testEndpoint ?? `/secrets/${activeKeys[0]}/test`,
        { method: "POST", body: JSON.stringify({}) },
      );
      setTest(result.message);
    } catch (e) {
      setTest((e as Error).message);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-warmgrey/60 bg-white/50">
      <div className="flex items-center gap-3 border-b border-warmgrey/60 bg-sand/40 px-4 py-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={provider.iconSrc}
          alt={`${provider.name} logo`}
          className="h-10 w-10 shrink-0 rounded-xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="subhead text-base leading-none">{provider.name}</p>
            <Badge tone={status.tone}>{status.label}</Badge>
          </div>
          <p className="mt-1 truncate text-xs text-brown">{provider.blurb}</p>
        </div>
        <SetupDialog provider={provider} mode={mode} />
        <Button size="sm" variant="ghost" onClick={runTest}>
          Test
        </Button>
      </div>
      {provider.keysByMode && (
        <div className="flex items-center justify-between gap-2 border-b border-warmgrey/30 px-4 py-2.5">
          <span className="text-xs font-medium text-brown">
            Active connection
          </span>
          <div className="flex rounded-lg border border-warmgrey/60 p-0.5">
            {(["test", "live"] as StripeMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onModeChange(m)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors ${
                  mode === m
                    ? m === "live"
                      ? "bg-ember text-white"
                      : "bg-ink text-peach"
                    : "text-brown hover:text-ink"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
      )}
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

  // Stripe Test/Live switch — persists immediately so checkout flips at once.
  async function setStripeMode(mode: StripeMode) {
    setSettings((s) => (s ? { ...s, stripeMode: mode } : s));
    try {
      await adminFetch("/settings", {
        method: "PATCH",
        body: JSON.stringify({ stripeMode: mode }),
      });
      reload();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const stripeMode = (settings?.stripeMode as StripeMode | undefined) ?? "test";

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
              mode={stripeMode}
              onModeChange={setStripeMode}
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
            <div>
              <Label>Low-stock alert at (units)</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={settings.lowStockThreshold}
                onChange={(e) =>
                  set("lowStockThreshold", Math.max(0, Math.floor(Number(e.target.value))))
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
              label="Show test orders (Stripe test-mode payments)"
              checked={settings.showTestOrders}
              onCheckedChange={(v) => set("showTestOrders", v)}
            />
            <p className="mt-1 text-[11px] text-warmgrey">
              When on, orders paid through Stripe test keys appear in the Orders
              list (tagged TEST) and are also sent to the Discord webhook.
            </p>
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
