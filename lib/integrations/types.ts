// External integration contracts. The one-shot ships Stub* implementations;
// swapping to real SDKs (R2 / Resend / Stripe / Discord) is a one-file change
// per provider. Every impl reads its keys via getSecret() and no-ops
// gracefully when unconfigured.

export interface UploadedFile {
  name: string;
  contentType: string;
  bytes: Buffer;
}

export interface Storage {
  upload(file: UploadedFile): Promise<{ url: string }>;
  delete(url: string): Promise<void>;
}

export type MailTemplate =
  | "order_confirmation"
  | "order_status_change"
  | "owner_order_alert"
  | "welcome_code"
  | "password_reset";

export interface Mailer {
  send(
    to: string,
    template: MailTemplate,
    data: Record<string, unknown>,
  ): Promise<void>;
}

export interface CheckoutOrder {
  orderNumber: string;
  totalSen: number;
  customerEmail: string;
}

export interface PaidEvent {
  orderNumber: string;
  paymentMethod: string;
}

export interface Payment {
  createCheckout(order: CheckoutOrder): Promise<{ url: string; id: string }>;
  verifyWebhook(req: Request): Promise<PaidEvent | null>;
}

export interface OrderAlert {
  orderNumber: string;
  customerName: string;
  totalSen: number;
  itemSummary: string;
}

export interface Notifier {
  orderPlaced(order: OrderAlert): Promise<void>;
}
