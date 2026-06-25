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
  // Mints a short-lived URL the browser can PUT a file to directly, plus the
  // public URL that file will be served from once uploaded. Lets large files
  // (e.g. videos) bypass the serverless request-body size limit.
  presignUpload(file: {
    name: string;
    contentType: string;
  }): Promise<{ uploadUrl: string; publicUrl: string }>;
}

export type MailTemplate =
  | "order_confirmation"
  | "order_status_change"
  | "welcome_code"
  | "password_reset"
  | "drop_live";

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
  reference?: string; // Stripe payment_intent / gateway reference, if any
  test?: boolean; // paid through Stripe test mode
}

export interface Payment {
  // baseUrl (the storefront origin) anchors the success/cancel redirect URLs;
  // callers pass the live request origin so it matches whatever host/port runs.
  createCheckout(
    order: CheckoutOrder,
    baseUrl?: string,
  ): Promise<{ url: string; id: string }>;
  verifyWebhook(req: Request): Promise<PaidEvent | null>;
}

export interface OrderAlertItem {
  productName: string;
  size: string;
  colour: string;
  quantity: number;
  stockLeft: number | null; // remaining stock after this order (null if variant gone)
}

export interface OrderAlert {
  orderNumber: string;
  customerName: string;
  totalSen: number;
  items: OrderAlertItem[];
  test?: boolean;
}

export interface LowStockItem {
  productName: string;
  size: string;
  colour: string;
  stockLeft: number; // remaining after the sale that crossed the threshold
}

export interface LowStockAlert {
  orderNumber: string; // the sale that pushed these variants low
  threshold: number;
  items: LowStockItem[];
  test?: boolean;
}

export interface Notifier {
  orderPlaced(order: OrderAlert): Promise<void>;
  lowStock(alert: LowStockAlert): Promise<void>;
}
