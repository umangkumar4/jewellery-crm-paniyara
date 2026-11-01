export const METALS = ["Gold", "Silver", "Diamond"] as const;
export type Metal = (typeof METALS)[number];
