export const METALS = ["Gold", "Silver", "Platinum"] as const;
export type Metal = (typeof METALS)[number];
