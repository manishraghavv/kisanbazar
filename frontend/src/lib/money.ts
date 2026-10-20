/** Display helpers for money. The API sends Decimal values as strings, so everything is coerced for display only. */
export function formatRupees(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const isZero = (value: number | string | null | undefined): boolean => Number(value ?? 0) === 0;
