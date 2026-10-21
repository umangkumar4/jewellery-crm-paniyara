export function formatInr(value: number): string {
  return `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatWeight(grams: number): string {
  return `${grams.toLocaleString("en-IN", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} g`;
}
