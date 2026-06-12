export const WEST_STATES = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Kuala Lumpur",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Putrajaya",
  "Selangor",
  "Terengganu",
] as const;

export const EAST_STATES = ["Labuan", "Sabah", "Sarawak"] as const;

export const ALL_STATES = [...WEST_STATES, ...EAST_STATES].sort();

export function zoneForState(state: string): "west" | "east" {
  return (EAST_STATES as readonly string[]).includes(state) ? "east" : "west";
}
