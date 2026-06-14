import { getCheckoutSuccessContent } from "@/lib/content";
import { CheckoutSuccess } from "./success-client";

export default async function CheckoutSuccessPage() {
  const content = await getCheckoutSuccessContent();
  return <CheckoutSuccess content={content} />;
}
