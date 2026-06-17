// Countdown instants are stored as unambiguous ISO strings in Malaysia time
// (+08:00). A <input type="datetime-local"> edits wall-clock digits with no
// offset, so we strip the offset for the picker and re-attach it on save.
export const MYT_OFFSET = "+08:00";

export function isoToLocalInput(iso: string): string {
  // Any instant (e.g. UTC "2026-06-30T16:00:00.000Z") → its MYT wall clock
  // "2026-07-01T00:00", so the picker shows the digits the admin entered.
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Date(d.getTime() + 8 * 3_600_000).toISOString().slice(0, 16);
}

export function localInputToIso(local: string): string {
  // "2026-07-01T00:00" → "2026-07-01T00:00:00+08:00"
  return local ? `${local}:00${MYT_OFFSET}` : "";
}
