type MetaWindow = Window & {
  fbq?: (...args: unknown[]) => void;
};

export function trackMeta(
  event: "AddToCart" | "InitiateCheckout" | "Purchase",
  data: Record<string, unknown>,
  eventId?: string,
): boolean {
  if (typeof window === "undefined") return false;

  const fbq = (window as MetaWindow).fbq;
  if (!fbq) return false;

  if (eventId) {
    fbq("track", event, data, { eventID: eventId });
  } else {
    fbq("track", event, data);
  }

  return true;
}
