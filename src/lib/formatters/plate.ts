const BE_PLATE_COMPACT_RE = /^([1-9])([A-Z]{3})(\d{3})$/;
const BE_PLATE_PRETTY_RE = /^([1-9])-[A-Z]{3}-\d{3}$/;
const PLACEHOLDER_PLATE_RE = /^ALL-\d+$/i;

export function isPlaceholderPlate(value: string): boolean {
  return PLACEHOLDER_PLATE_RE.test(value.trim());
}

/**
 * Normalizes Belgian plates to `2-ABC-111` style when possible.
 * Accepts input like `2ABC111`, `2 ABC 111`, `2-abc-111`.
 */
export function normalizeBelgianPlate(value: string): string {
  const raw = value.trim().toUpperCase();
  if (!raw) return "";

  if (BE_PLATE_PRETTY_RE.test(raw)) return raw;

  const compact = raw.replace(/[^A-Z0-9]/g, "");
  const m = compact.match(BE_PLATE_COMPACT_RE);
  if (!m) return raw;

  const [, d, letters, nums] = m;
  return `${d}-${letters}-${nums}`;
}

export function isValidBelgianPlate(value: string): boolean {
  const v = normalizeBelgianPlate(value);
  return BE_PLATE_PRETTY_RE.test(v);
}

