import { prisma } from "@/lib/db";

// A size guide is a free-form table: column headers + rows of cells. This lets
// the owner describe tees (chest/length) and shorts (waist/inseam) differently.
export interface SizeGuideTable {
  note: string;
  columns: string[];
  rows: string[][];
}

const SETTING_KEY = "sizeGuide";

export const DEFAULT_SIZE_GUIDE: SizeGuideTable = {
  note: "Measurements in cm. Our cut is athletic — size up for an oversized fit.",
  columns: ["Size", "Chest", "Length", "Fits chest"],
  rows: [
    ["S", "44–46", "66", "92–98"],
    ["M", "48–50", "68", "98–104"],
    ["L", "52–54", "70", "104–112"],
    ["XL", "56–58", "72", "112–120"],
  ],
};

export function isValidSizeGuide(value: unknown): value is SizeGuideTable {
  if (!value || typeof value !== "object") return false;
  const g = value as Record<string, unknown>;
  return (
    typeof g.note === "string" &&
    Array.isArray(g.columns) &&
    Array.isArray(g.rows)
  );
}

// Product override wins only when it is a valid table with at least one row;
// a blank/malformed override falls back to the store default.
export function resolveSizeGuide(
  override: unknown,
  fallback: SizeGuideTable,
): SizeGuideTable {
  if (isValidSizeGuide(override) && override.rows.length > 0) return override;
  return fallback;
}

export async function getDefaultSizeGuide(): Promise<SizeGuideTable> {
  const row = await prisma.siteSetting.findUnique({ where: { key: SETTING_KEY } });
  return isValidSizeGuide(row?.value) ? row.value : DEFAULT_SIZE_GUIDE;
}

export async function setDefaultSizeGuide(guide: SizeGuideTable): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key: SETTING_KEY },
    create: { key: SETTING_KEY, value: guide as object },
    update: { value: guide as object },
  });
}
