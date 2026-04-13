/**
 * Format a number as euro currency (e.g. €12,50).
 */
export function eur(value: number | null | undefined): string {
  if (value == null) return "—";
  return `€${value.toLocaleString("nl-BE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Format an ISO date string to a readable Dutch date (e.g. 6 april 2026).
 */
export function datum(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("nl-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
