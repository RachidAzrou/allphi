/** DB-waarden voor `fleet_escalations.status` */
export type FleetEscalationStatus = "unread" | "open" | "resolved";

export function normalizeFleetEscalationStatus(raw: string | null | undefined): FleetEscalationStatus {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if (s === "unread" || s === "open" || s === "resolved") return s;
  if (s === "queued") return "unread";
  if (s === "sending" || s === "sent" || s === "failed") return "open";
  if (s === "resolved") return "resolved";
  return "open";
}

/** Korte label voor UI (Nederlands). */
export function fleetEscalationLabelNl(status: string | null | undefined): string {
  const n = normalizeFleetEscalationStatus(status);
  if (n === "unread") return "Nieuw";
  if (n === "open") return "Open";
  return "Afgehandeld";
}

/** Kleuren voor status-pillen (zonder layout: combineer met `EscalationStatusBadge` of `cn()`). */
export function fleetEscalationBadgeClass(status: string | null | undefined): string {
  const n = normalizeFleetEscalationStatus(status);
  if (n === "unread") {
    return "bg-violet-500/[0.15] text-violet-900 shadow-sm ring-1 ring-inset ring-violet-500/35 dark:text-violet-100 dark:ring-violet-400/30";
  }
  if (n === "open") {
    return "bg-sky-500/[0.12] text-sky-950 shadow-sm ring-1 ring-inset ring-sky-500/30 dark:text-sky-100 dark:ring-sky-400/25";
  }
  return "bg-emerald-500/[0.12] text-emerald-900 shadow-sm ring-1 ring-inset ring-emerald-500/30 dark:text-emerald-100 dark:ring-emerald-400/25";
}

/** Klein bolletje in lijsten. */
export function fleetEscalationDotClass(status: string | null | undefined): string {
  const n = normalizeFleetEscalationStatus(status);
  if (n === "unread") return "bg-violet-500 ring-1 ring-violet-300/80 dark:ring-violet-500/50";
  if (n === "open") return "bg-sky-500 ring-1 ring-sky-300/80 dark:ring-sky-500/50";
  return "bg-emerald-500/90 ring-1 ring-emerald-300/50 dark:ring-emerald-500/40";
}

export function isFleetEscalationActiveStatus(status: string | null | undefined): boolean {
  return normalizeFleetEscalationStatus(status) !== "resolved";
}

/**
 * Rijen die bij openen als "gelezen" naar `open` gezet moeten worden.
 * Ondersteunt migratie-overslag: `queued` (oud) ≈ ongelezen.
 */
export function isEscalationUnreadLike(status: string | null | undefined): boolean {
  const s = String(status ?? "")
    .trim()
    .toLowerCase();
  return s === "unread" || s === "queued";
}

/** CustomEvent om het sidebar-teller (nieuwe items) te verversen. */
export const FLEET_INBOX_POLL_EVENT = "allphi:fleet-inbox-refresh";
