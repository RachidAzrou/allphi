/**
 * Datum/uur helpers.
 *
 * Intern slaan we datums op als ISO `YYYY-MM-DD` en uren als `HH:MM`, dat
 * matcht de waarde-representaties van native `<input type="date">` en
 * `<input type="time">`. Voor weergave (overzicht, PDF) gebruiken we het
 * Europese formaat `DD/MM/YYYY`.
 */

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Normaliseer willekeurige datum-input naar ISO `YYYY-MM-DD`. Lege string bij onbekend. */
export function toIsoDate(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = String(input).trim();
  if (!trimmed) return "";

  // Al ISO?
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // Europees DD/MM/YYYY (ondersteunt ook DD-MM-YYYY of DD.MM.YYYY).
  const eu = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/.exec(trimmed);
  if (eu) {
    const day = pad(Number(eu[1]));
    const month = pad(Number(eu[2]));
    let year = eu[3];
    if (year.length === 2) {
      const y = Number(year);
      year = String(y >= 70 ? 1900 + y : 2000 + y);
    }
    return `${year}-${month}-${day}`;
  }

  // Laatste poging: laat Date het proberen.
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return "";
}

/** Normaliseer uur-input naar `HH:MM`. */
export function toIsoTime(input: string | null | undefined): string {
  if (!input) return "";
  const trimmed = String(input).trim();
  if (!trimmed) return "";
  const m = /^(\d{1,2})[:h.](\d{2})/.exec(trimmed);
  if (!m) return "";
  const hh = pad(Math.min(23, Number(m[1])));
  const mm = pad(Math.min(59, Number(m[2])));
  return `${hh}:${mm}`;
}

/** ISO → Europees voor weergave. Als input al Europees is, blijft het zo. */
export function formatDateForDisplay(
  input: string | null | undefined,
): string {
  if (!input) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input).trim());
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return String(input).trim();
}

/** Zorg dat het uur er uit ziet als `HH:MM` bij weergave (gewoon passthrough als al goed). */
export function formatTimeForDisplay(
  input: string | null | undefined,
): string {
  if (!input) return "";
  return toIsoTime(input) || String(input).trim();
}
