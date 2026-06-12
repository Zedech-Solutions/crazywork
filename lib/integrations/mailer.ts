import { getSecret } from "@/lib/secrets";
import type { Mailer, MailTemplate } from "./types";

export interface SentMail {
  to: string;
  template: MailTemplate;
  data: Record<string, unknown>;
}

// Stub → console + in-memory log (assertable in tests). Real impl: Resend.
export class StubMailer implements Mailer {
  readonly sent: SentMail[] = [];

  async send(
    to: string,
    template: MailTemplate,
    data: Record<string, unknown>,
  ): Promise<void> {
    const from = (await getSecret("resend_from_email")) ?? "store@crazywork.my";
    this.sent.push({ to, template, data });
    console.log(`[mail:stub] ${template} → ${to} (from ${from})`);
  }
}

export const mailer = new StubMailer();
