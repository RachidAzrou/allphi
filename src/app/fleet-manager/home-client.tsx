"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { TbLayoutDashboard } from "react-icons/tb";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { cn } from "@/lib/utils";
import { EscalationStatusBadge } from "@/components/escalation-status-badge";
import { fleetEscalationLabelNl, normalizeFleetEscalationStatus } from "@/lib/fleet/escalation-status";
import { eur } from "@/lib/formatters/utils";
import type { FleetChargingMonthlyOverview } from "@/types/database";

type Escalation = {
  id: string;
  status: string;
  subject: string | null;
  created_at: string;
};

function normalizeEscalationSubject(subject: string | null, fallbackEmail?: string | null): string {
  const raw = (subject ?? "").trim();
  if (!raw) return fallbackEmail ? `Escalatie — ${fallbackEmail} — Vraag` : "Escalatie — Vraag";
  // Legacy
  if (/^Fleet vraag \(escalatie\)\s+—\s+/i.test(raw)) {
    return raw.replace(/^Fleet vraag \(escalatie\)\s+—\s+/i, "Escalatie — ");
  }
  // New canonical
  if (/^Escalatie\s+—\s+/i.test(raw)) return raw;
  return `Escalatie — ${raw}`;
}

type ChargingApiPayload =
  | { ok: true; rows: FleetChargingMonthlyOverview[] }
  | { ok: false; error?: string };

type BarDatum = { key: string; label: string; value: number; sublabel?: string };
type PieDatum = { key: string; label: string; value: number; sublabel?: string };

function formatDay(ts: string) {
  try {
    return new Intl.DateTimeFormat("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

function currentMonthIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

function formatAgeShort(createdAt: string): string {
  const t = new Date(createdAt).getTime();
  if (!Number.isFinite(t)) return "—";
  const minutes = Math.max(0, Math.floor((Date.now() - t) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours}u`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function FleetManagerHomeClient(props: {
  userEmail: string;
  userDisplayName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [completedAangiftesCount, setCompletedAangiftesCount] = useState(0);
  const [chargingRows, setChargingRows] = useState<FleetChargingMonthlyOverview[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [escRes, chargeRes, aangiftesRes] = await Promise.all([
        fetch("/api/fleet-manager/escalations", { credentials: "same-origin" }),
        fetch(`/api/fleet/charging/overview?from=${encodeURIComponent(currentMonthIso())}&limit=500`, {
          credentials: "same-origin",
        }),
        fetch("/api/fleet-manager/aangiftes?status=completed", { credentials: "same-origin" }),
      ]);

      const escJson = (await escRes.json()) as { escalations?: Escalation[]; error?: string };
      if (!escRes.ok) throw new Error(escJson.error ?? "escalations_failed");

      const chargeJson = (await chargeRes.json()) as ChargingApiPayload;
      if (!chargeRes.ok || !chargeJson.ok) {
        // Laadkosten is nice-to-have; escalaties blijven het belangrijkste.
        setChargingRows([]);
      } else {
        setChargingRows(Array.isArray(chargeJson.rows) ? chargeJson.rows : []);
      }

      const aangiftesJson = (await aangiftesRes.json()) as { aangiftes?: unknown[]; error?: string };
      if (!aangiftesRes.ok) {
        // Aangiftes is important but shouldn't break dashboard loading.
        setCompletedAangiftesCount(0);
      } else {
        setCompletedAangiftesCount(Array.isArray(aangiftesJson.aangiftes) ? aangiftesJson.aangiftes.length : 0);
      }

      setEscalations(Array.isArray(escJson.escalations) ? escJson.escalations : []);
    } catch (e) {
      console.error(e);
      setError("Kon dashboard niet laden.");
      setEscalations([]);
      setCompletedAangiftesCount(0);
      setChargingRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const computed = useMemo(() => {
    const open = escalations.filter((e) => normalizeFleetEscalationStatus(e.status) !== "resolved");
    const resolved = escalations.filter((e) => normalizeFleetEscalationStatus(e.status) === "resolved");
    const recent = [...escalations].slice(0, 6);
    const oldestOpen = [...open].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))[0] ?? null;

    const totaalKost = chargingRows.reduce((s, r) => s + (Number(r.totaal_kost) || 0), 0);
    const openKost = chargingRows.reduce((s, r) => s + (Number(r.open_kost) || 0), 0);
    const sessies = chargingRows.reduce((s, r) => s + (Number(r.aantal_sessies) || 0), 0);

    const escStatusMap = new Map<string, number>();
    for (const e of escalations) {
      const k = String(e.status ?? "").trim() || "unknown";
      escStatusMap.set(k, (escStatusMap.get(k) ?? 0) + 1);
    }
    const escByStatus: BarDatum[] = Array.from(escStatusMap.entries())
      .map(([status, count]) => ({
        key: status,
        label: fleetEscalationLabelNl(status),
        value: count,
      }))
      .sort((a, b) => b.value - a.value);

    const chargingLocMap = new Map<string, { kost: number; sessies: number }>();
    for (const r of chargingRows) {
      const k = String(r.locatie_type ?? "").trim() || "onbekend";
      const kost = Number(r.totaal_kost) || 0;
      const count = Number(r.aantal_sessies) || 0;
      const cur = chargingLocMap.get(k) ?? { kost: 0, sessies: 0 };
      cur.kost += kost;
      cur.sessies += count;
      chargingLocMap.set(k, cur);
    }
    const chargingByLocation: BarDatum[] = Array.from(chargingLocMap.entries())
      .map(([loc, v]) => ({
        key: loc,
        label: loc === "thuis" ? "thuis" : loc === "publiek" ? "publiek" : loc,
        value: v.kost,
        sublabel: `${v.sessies} sessies`,
      }))
      .sort((a, b) => b.value - a.value);

    return {
      esc: {
        openCount: open.length,
        resolvedCount: resolved.length,
        recent,
        oldestOpenAge: oldestOpen ? formatAgeShort(oldestOpen.created_at) : null,
      },
      aangiftes: {
        completedCount: completedAangiftesCount,
      },
      charging: { totaalKost, openKost, sessies, byLocation: chargingByLocation },
      charts: { escByStatus },
    };
  }, [escalations, chargingRows, completedAangiftesCount]);

  const cardClass =
    "app-card app-card-hover block rounded-2xl p-4 sm:p-5 no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30";

  const renderDonut = (rows: PieDatum[], opts?: { valueFormatter?: (n: number) => string }) => {
    if (!rows || rows.length === 0) {
      return <div className="px-4 py-4 text-sm text-muted-foreground">Geen data.</div>;
    }

    const cleaned = rows
      .map((r) => ({ ...r, value: Number(r.value) || 0 }))
      .filter((r) => r.value > 0)
      .slice(0, 6);

    const total = cleaned.reduce((s, r) => s + r.value, 0);
    if (!Number.isFinite(total) || total <= 0) {
      return <div className="px-4 py-4 text-sm text-muted-foreground">Geen data.</div>;
    }

    // Cool palette (blue tints) with clearer contrast between segments.
    // For known keys (thuis/publiek) we force light vs dark blue so it’s always obvious.
    const palette = [
      "text-sky-400",
      "text-blue-700",
      "text-indigo-600",
      "text-cyan-600",
      "text-sky-600",
      "text-blue-600",
    ];

    const keyColor = (key: string, idx: number) => {
      const k = (key ?? "").trim().toLowerCase();
      if (k === "thuis") return "text-sky-400";
      if (k === "publiek") return "text-blue-700";
      return palette[idx % palette.length];
    };

    // Donut via stroke-dasharray on circles (percent-based)
    let offset = 25; // start at top (12 o'clock)
    const segments = cleaned.map((r, idx) => {
      const pct = (r.value / total) * 100;
      const dash = `${pct} ${100 - pct}`;
      const seg = (
        <circle
          key={r.key}
          cx="21"
          cy="21"
          r="15.915"
          fill="transparent"
          stroke="currentColor"
          strokeWidth="6"
          strokeDasharray={dash}
          strokeDashoffset={offset}
          className={keyColor(r.key, idx)}
          strokeLinecap="butt"
        />
      );
      offset -= pct;
      return seg;
    });

    return (
      <div className="px-4 py-4">
        <div className="flex flex-col items-center gap-5">
          <div className="relative h-[140px] w-[140px] shrink-0">
            <svg viewBox="0 0 42 42" className="h-full w-full" aria-hidden="true">
              <circle
                cx="21"
                cy="21"
                r="15.915"
                fill="transparent"
                stroke="currentColor"
                strokeWidth="6"
                className="text-muted/40"
              />
              {segments}
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Totaal</p>
              <p className="mt-0.5 text-[14px] font-heading font-extrabold tracking-tight text-foreground">
                {opts?.valueFormatter ? opts.valueFormatter(total) : String(total)}
              </p>
            </div>
          </div>

          <ul className="w-full max-w-[22rem] space-y-2">
            {cleaned.map((r, idx) => (
              <li key={r.key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "mt-[2px] inline-block h-2.5 w-2.5 rounded-full ring-1 ring-border/40",
                        keyColor(r.key, idx),
                      )}
                      style={{ backgroundColor: "currentColor" }}
                      aria-hidden="true"
                    />
                    <p className="truncate text-[13px] font-semibold text-foreground">
                      {String(r.label ?? "—").toUpperCase()}
                    </p>
                  </div>
                  {r.sublabel ? <p className="mt-0.5 text-[12px] text-muted-foreground">{r.sublabel}</p> : null}
                </div>
                <p className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">
                  {opts?.valueFormatter ? opts.valueFormatter(r.value) : String(r.value)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  };

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader
        userEmail={props.userEmail}
        userDisplayName={props.userDisplayName}
        showFleetManagerNav
      />

      {loading ? (
        <LoadingState subtitle="We bouwen je fleet dashboard op…" />
      ) : error ? (
        <main className="app-page-shell app-page-shell-wide">
          <ErrorState message={error} onRetry={() => void load()} />
        </main>
      ) : (
        <main className="app-page-shell app-page-shell-wide">
          <header className="touch-manipulation pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm"
                    aria-hidden="true"
                  >
                    <TbLayoutDashboard className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                    Dashboard
                  </h1>
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  Snel overzicht en shortcuts naar je belangrijkste acties.
                </p>
              </div>
            </div>
          </header>

          <section className="mt-7 grid gap-3 sm:mt-8 sm:grid-cols-2 lg:grid-cols-4">
            <Link href="/fleet-manager/inbox" className={cardClass}>
              <p className="text-[13px] font-medium text-muted-foreground">Inbox</p>
              <p className="mt-1 text-[22px] font-heading font-extrabold tracking-tight text-foreground">
                {computed.esc.openCount}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                niet afgehandeld
                {computed.esc.oldestOpenAge ? (
                  <span className="ml-2 text-muted-foreground/80">· oudste {computed.esc.oldestOpenAge}</span>
                ) : null}
              </p>
            </Link>

            <Link href="/fleet-manager/aangiftes" className={cardClass}>
              <p className="text-[13px] font-medium text-muted-foreground">Afgehandeld</p>
              <p className="mt-1 text-[22px] font-heading font-extrabold tracking-tight text-foreground">
                {computed.aangiftes.completedCount}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">afgewerkte aangiftes</p>
            </Link>

            <Link href="/fleet-manager/laadkosten" className={cardClass}>
              <p className="text-[13px] font-medium text-muted-foreground">Laadkosten (maand)</p>
              <p className="mt-1 text-[18px] font-heading font-extrabold tracking-tight text-foreground">
                {eur(computed.charging.totaalKost)}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {computed.charging.sessies} sessies — open {eur(computed.charging.openKost)}
              </p>
            </Link>

            <Link href="/fleet-manager/laadkosten" className={cardClass}>
              <p className="text-[13px] font-medium text-muted-foreground">Top laadlocatie (maand)</p>
              <p className="mt-1 text-[18px] font-heading font-extrabold tracking-tight text-foreground">
                {eur(computed.charging.byLocation?.[0]?.value ?? 0)}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {computed.charging.byLocation?.[0]
                  ? `${computed.charging.byLocation[0].label} — ${computed.charging.byLocation[0].sublabel ?? ""}`.trim()
                  : "Geen sessies"}
              </p>
            </Link>
          </section>

          <section className="mt-8 sm:mt-10" aria-label="Grafieken">
            <h2 className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Grafieken
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              <div className="app-ios-group">
                <div className="px-4 py-3.5">
                  <p className="text-[14px] font-semibold text-foreground">Escalaties per status</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Laatste {escalations.length} items
                  </p>
                </div>
                {renderDonut(computed.charts.escByStatus, { valueFormatter: (n) => String(Number(n) || 0) })}
              </div>

              <div className="app-ios-group">
                <div className="px-4 py-3.5">
                  <p className="text-[14px] font-semibold text-foreground">Laadkosten per locatie</p>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Deze maand — totaal {eur(computed.charging.totaalKost)}
                  </p>
                </div>
                {renderDonut(computed.charging.byLocation, { valueFormatter: (n) => eur(Number(n) || 0) })}
              </div>
            </div>
          </section>

          <section className="mt-8 sm:mt-10" aria-label="Recente doorgestuurde vragen">
            <div className="flex items-end justify-between gap-3 px-1 pb-2">
              <h2 className="text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
                Recente doorgestuurde vragen
              </h2>
              <Link
                href="/fleet-manager/escalations"
                className="text-[12px] font-semibold text-primary hover:underline"
              >
                Bekijk alles
              </Link>
            </div>
            <div className="app-ios-group">
              {computed.esc.recent.length === 0 ? (
                <div className="px-4 py-5 text-sm text-muted-foreground">Geen escalaties gevonden.</div>
              ) : (
                <ul className="divide-y divide-border/60">
                  {computed.esc.recent.map((e) => (
                    <li key={e.id}>
                      <Link
                        href={`/fleet-manager/escalations/${encodeURIComponent(e.id)}`}
                        className={cn(
                          "touch-manipulation block px-4 py-3.5 no-underline transition-colors",
                          "hover:bg-muted/30 active:bg-muted/40",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] font-semibold leading-snug text-foreground">
                              {normalizeEscalationSubject(e.subject)}
                            </p>
                            <p className="mt-1 text-[12px] text-muted-foreground">
                              {formatDay(e.created_at)}
                            </p>
                          </div>
                          <EscalationStatusBadge className="shrink-0" size="compact" status={e.status} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

