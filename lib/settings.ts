import { prisma } from "@/lib/db";
import { rm } from "@/lib/money";

// Non-secret store settings (SiteSetting key/value JSON). Money values in sen.

export const SETTING_DEFAULTS = {
  shippingWest: rm(8),
  shippingEast: rm(15),
  freeShippingThreshold: rm(150),
  socialInstagram: "https://instagram.com/crazywork.my",
  socialTiktok: "",
  socialEmail: "hello@crazywork.my",
  ssmNumber: "",
  ownerAlertChannel: "discord" as "discord" | "email",
  ownerAlertEmail: "",
  popupDelaySeconds: 6,
  preCheckoutUpsellEnabled: true,
  preCheckoutUpsellTemplate:
    "Almost there! Add {n} more and save {percent}% on your cart",
  announcementBar: "FREE SHIPPING OVER RM150 · WEST & EAST MALAYSIA",
  dropCountdownUntil: "", // ISO date — shows a countdown on the featured drop when set
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = { [K in SettingKey]: (typeof SETTING_DEFAULTS)[K] extends infer T ? (T extends string ? string : T extends number ? number : T extends boolean ? boolean : T) : never };

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.siteSetting.findMany();
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return { ...SETTING_DEFAULTS, ...stored } as Settings;
}

export async function getSetting<K extends SettingKey>(
  key: K,
): Promise<Settings[K]> {
  const row = await prisma.siteSetting.findUnique({ where: { key } });
  return (row ? (row.value as Settings[K]) : SETTING_DEFAULTS[key]) as Settings[K];
}

export async function setSetting<K extends SettingKey>(
  key: K,
  value: Settings[K],
): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value: value as object },
    update: { value: value as object },
  });
}
