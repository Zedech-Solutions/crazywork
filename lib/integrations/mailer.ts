import { Resend } from "resend";
import { getSecret } from "@/lib/secrets";
import { getSetting, type SettingKey } from "@/lib/settings";
import type { Mailer, MailTemplate } from "./types";

// Which Settings toggle gates each email scenario (admin can switch any off).
const TEMPLATE_SETTING: Record<MailTemplate, SettingKey> = {
  welcome_code: "emailWelcomeCode",
  password_reset: "emailPasswordReset",
  order_confirmation: "emailOrderConfirmation",
  order_status_change: "emailOrderStatusChange",
  drop_live: "emailDropLaunch",
};

export interface SentMail {
  to: string;
  template: MailTemplate;
  data: Record<string, unknown>;
}

const STORE = "CRAZYWORK";

// Show "CRAZYWORK" as the sender name. If the saved From already carries a
// display name ("Name <addr>"), leave it untouched.
function withSenderName(from: string): string {
  return from.includes("<") ? from : `${STORE} <${from}>`;
}

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Minimal branded shell so every email looks consistent.
function shell(body: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
    <p style="font-weight:bold;letter-spacing:2px;font-size:18px;margin:0 0 16px">${STORE}</p>
    ${body}
    <hr style="border:none;border-top:1px solid #e5ddd0;margin:24px 0" />
    <p style="font-size:12px;color:#7a6a5a">${STORE} · Wear what you train for.</p>
  </div>`;
}

interface EmailItem {
  label: string;
  image?: string | null;
}

function emailItems(data: Record<string, unknown>): EmailItem[] {
  return (Array.isArray(data.items) ? (data.items as EmailItem[]) : []).filter(
    (i) => i && typeof i.label === "string",
  );
}

// Horizontal photo strip. Email clients don't scroll, so the thumbnails are
// inline-block and wrap to the next line when there are many. Only absolute
// https URLs render — a relative/placeholder path never shows a broken image.
function photoStrip(items: EmailItem[]): string {
  const photos = items
    .filter((i) => i.image && /^https?:\/\//.test(i.image))
    .map(
      (i) =>
        `<img src="${esc(i.image)}" width="76" height="76" alt="" style="display:inline-block;width:76px;height:76px;object-fit:cover;border-radius:8px;border:1px solid #e5ddd0;margin:0 8px 8px 0;vertical-align:top" />`,
    )
    .join("");
  return photos ? `<div style="margin:16px 0;font-size:0">${photos}</div>` : "";
}

function itemList(items: EmailItem[]): string {
  return `<ul>${items.map((i) => `<li>${esc(i.label)}</li>`).join("")}</ul>`;
}

function renderTemplate(
  template: MailTemplate,
  data: Record<string, unknown>,
): { subject: string; html: string } {
  switch (template) {
    case "order_confirmation": {
      const items = emailItems(data);
      return {
        subject: `Order ${esc(data.orderNumber)} confirmed — ${STORE}`,
        html: shell(
          `<h1 style="font-size:22px">Order confirmed</h1>
           <p>Thanks for your order <strong>${esc(data.orderNumber)}</strong>.</p>
           ${photoStrip(items)}
           ${itemList(items)}
           <p style="font-size:18px"><strong>Total: RM${esc(data.total)}</strong></p>
           <p>We'll email you again when it ships.</p>`,
        ),
      };
    }
    case "order_status_change": {
      const items = emailItems(data);
      const tracking = data.trackingNumber
        ? `<p>Courier: <strong>${esc(data.courierName) || "—"}</strong> · Tracking: <strong>${esc(data.trackingNumber)}</strong></p>`
        : "";
      return {
        subject: `Order ${esc(data.orderNumber)} — ${esc(data.status)} — ${STORE}`,
        html: shell(
          `<h1 style="font-size:22px;text-transform:capitalize">Order ${esc(data.status)}</h1>
           <p>Your order <strong>${esc(data.orderNumber)}</strong> is now <strong>${esc(data.status)}</strong>.</p>
           ${photoStrip(items)}
           ${itemList(items)}
           ${tracking}`,
        ),
      };
    }
    case "welcome_code": {
      return {
        subject: `Your ${STORE} welcome code`,
        html: shell(
          `<h1 style="font-size:22px">Welcome to ${STORE}</h1>
           <p>Here's your first-order discount code:</p>
           <p style="font-size:26px;font-weight:bold;letter-spacing:3px;background:#f0e8dc;padding:12px 16px;display:inline-block">${esc(data.code)}</p>
           <p>Use it at checkout.</p>`,
        ),
      };
    }
    case "drop_live": {
      const url = esc(data.url);
      return {
        subject: `${esc(data.dropName)} just dropped — ${STORE}`,
        html: shell(
          `<h1 style="font-size:22px">It's live</h1>
           <p><strong>${esc(data.dropName)}</strong> just dropped. Limited runs — get in before it's gone.</p>
           <p><a href="${url}" style="background:#d45c00;color:#faefe0;text-decoration:none;padding:12px 24px;display:inline-block;font-weight:bold">Shop the drop</a></p>`,
        ),
      };
    }
    case "password_reset": {
      const url = esc(data.url);
      return {
        subject: `Reset your ${STORE} password`,
        html: shell(
          `<h1 style="font-size:22px">Reset your password</h1>
           <p>Click the button to set a new password. If you didn't request this, just ignore this email.</p>
           <p><a href="${url}" style="background:#d45c00;color:#faefe0;text-decoration:none;padding:12px 24px;display:inline-block;font-weight:bold">Reset password</a></p>
           <p style="font-size:12px;color:#7a6a5a">Or paste this link: ${url}</p>`,
        ),
      };
    }
  }
}

// Resend-backed transactional email. Reads keys from the runtime secret store
// (Settings → Integrations). Records every send to `sent` for tests; makes no
// external call under NODE_ENV=test or when Resend isn't configured (it logs
// instead — the same graceful no-op pattern as the Discord notifier).
export class ResendMailer implements Mailer {
  readonly sent: SentMail[] = [];

  async send(
    to: string,
    template: MailTemplate,
    data: Record<string, unknown>,
  ): Promise<void> {
    // Admin can disable any scenario in Settings → Email notifications.
    if (!(await getSetting(TEMPLATE_SETTING[template]))) {
      console.log(`[mail] ${template} → ${to} (disabled in settings)`);
      return;
    }

    this.sent.push({ to, template, data });
    if (process.env.NODE_ENV === "test") return;

    const apiKey = await getSecret("resend_api_key");
    const from = await getSecret("resend_from_email");
    if (!apiKey || !from) {
      console.log(`[mail] ${template} → ${to} (Resend not configured — not sent)`);
      return;
    }

    const { subject, html } = renderTemplate(template, data);
    try {
      const { error } = await new Resend(apiKey).emails.send({
        from: withSenderName(from),
        to,
        subject,
        html,
      });
      if (error) console.error("[mail] Resend rejected the send", error);
    } catch (e) {
      console.error("[mail] Resend send failed", e);
    }
  }

  // Connectivity check for the Settings "Test" button (mirrors Stripe's).
  async verifyConnection(): Promise<{ ok: boolean; message: string }> {
    const apiKey = await getSecret("resend_api_key");
    const from = await getSecret("resend_from_email");
    if (!apiKey) return { ok: false, message: "No Resend API key saved." };
    if (!from) return { ok: false, message: "Set the From email as well." };
    try {
      const { error } = await new Resend(apiKey).domains.list();
      // A restricted (sending-only) key can't list domains but is still valid —
      // only an auth failure means the key itself is wrong.
      if (error?.name === "invalid_api_key") {
        return { ok: false, message: "Resend rejected this API key." };
      }
      if (error?.name === "restricted_api_key") {
        return { ok: true, message: "Connected (sending-only key)." };
      }
      return { ok: true, message: "Connected to Resend." };
    } catch {
      return { ok: false, message: "Couldn't reach Resend." };
    }
  }
}

export const mailer = new ResendMailer();
