"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TbBolt } from "react-icons/tb";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { cn } from "@/lib/utils";
import { eur } from "@/lib/formatters/utils";
import type { FleetChargingMonthlyOverview } from "@/types/database";

type ApiPayload =
  | { ok: true; rows: FleetChargingMonthlyOverview[] }
  | { ok: false; error?: string };

function monthLabel(isoMonth: string): string {
  const s = (isoMonth ?? "").trim();
  if (!s) return "—";
  try {
    const d = new Date(`${s}T00:00:00.000Z`);
    return new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" }).format(d);
  } catch {
    return s;
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

type MonthAgg = {
  maand: string;
  aantal_sessies: number;
  totaal_kwh: number;
  totaal_kost: number;
  open_kost: number;
};

type PersonAgg = {
  medewerker_id: string;
  label: string;
  emailadres: string;
  aantal_sessies: number;
  totaal_kwh: number;
  totaal_kost: number;
  open_kost: number;
};

export function FleetManagerChargingClient(props: {
  userEmail: string;
  userDisplayName: string;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<FleetChargingMonthlyOverview[]>([]);

  const [peoplePage, setPeoplePage] = useState(0);
  const peoplePageSize = 10;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams();
      p.set("limit", "1500");
      const res = await fetch(`/api/fleet/charging/overview?${p.toString()}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as ApiPayload;
      if (!res.ok || !json.ok) throw new Error(("error" in json && json.error) || "load_failed");
      setRows(Array.isArray(json.rows) ? json.rows : []);
    } catch (e) {
      console.error(e);
      setRows([]);
      setError("Kon fleet laadkosten niet laden.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const computed = useMemo(() => {
    const monthMap = new Map<string, MonthAgg>();
    const personMap = new Map<string, PersonAgg>();

    let totaal_kost = 0;
    let open_kost = 0;
    let totaal_kwh = 0;
    let aantal_sessies = 0;

    for (const r of rows) {
      const maand = String(r.maand ?? "").slice(0, 10);
      const kwh = Number(r.totaal_kwh) || 0;
      const kost = Number(r.totaal_kost) || 0;
      const open = Number(r.open_kost) || 0;
      const count = Number(r.aantal_sessies) || 0;

      totaal_kost += kost;
      open_kost += open;
      totaal_kwh += kwh;
      aantal_sessies += count;

      const m = monthMap.get(maand) ?? {
        maand,
        aantal_sessies: 0,
        totaal_kwh: 0,
        totaal_kost: 0,
        open_kost: 0,
      };
      m.aantal_sessies += count;
      m.totaal_kwh += kwh;
      m.totaal_kost += kost;
      m.open_kost += open;
      monthMap.set(maand, m);

      const medewerker_id = String(r.medewerker_id ?? "");
      const label = [r.voornaam, r.naam].filter(Boolean).join(" ").trim() || r.emailadres || "—";
      const p = personMap.get(medewerker_id) ?? {
        medewerker_id,
        label,
        emailadres: r.emailadres,
        aantal_sessies: 0,
        totaal_kwh: 0,
        totaal_kost: 0,
        open_kost: 0,
      };
      p.aantal_sessies += count;
      p.totaal_kwh += kwh;
      p.totaal_kost += kost;
      p.open_kost += open;
      personMap.set(medewerker_id, p);
    }

    const months = Array.from(monthMap.values())
      .map((m) => ({
        ...m,
        totaal_kwh: round2(m.totaal_kwh),
        totaal_kost: round2(m.totaal_kost),
        open_kost: round2(m.open_kost),
      }))
      .sort((a, b) => String(b.maand).localeCompare(String(a.maand)));

    const people = Array.from(personMap.values())
      .map((p) => ({
        ...p,
        totaal_kwh: round2(p.totaal_kwh),
        totaal_kost: round2(p.totaal_kost),
        open_kost: round2(p.open_kost),
      }))
      .sort((a, b) => b.totaal_kost - a.totaal_kost);

    return {
      totals: {
        aantal_sessies,
        totaal_kwh: round2(totaal_kwh),
        totaal_kost: round2(totaal_kost),
        open_kost: round2(open_kost),
      },
      months,
      people,
    };
  }, [rows]);

  const peopleTotalPages = useMemo(() => {
    return Math.max(1, Math.ceil(computed.people.length / peoplePageSize));
  }, [computed.people.length]);

  const safePeoplePage = useMemo(() => {
    if (computed.people.length === 0) return 0;
    return Math.max(0, Math.min(peoplePage, peopleTotalPages - 1));
  }, [computed.people.length, peoplePage, peopleTotalPages]);

  const pagedPeople = useMemo(() => {
    const start = safePeoplePage * peoplePageSize;
    return computed.people.slice(start, start + peoplePageSize);
  }, [computed.people, safePeoplePage]);

  useEffect(() => {
    // Reset to page 1 when the dataset changes (filters, refresh).
    setPeoplePage(0);
  }, [computed.people.length]);

  const iosRowClass =
    "touch-manipulation flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-b-0 active:bg-muted/40 sm:px-4";

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader
        userEmail={props.userEmail}
        userDisplayName={props.userDisplayName}
        showFleetManagerNav
      />

      {loading ? (
        <LoadingState subtitle="We halen fleet laadkosten op…" />
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
                    <TbBolt className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                    Laadkosten
                  </h1>
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  Overzicht per maand en per medewerker op basis van laadsessies.
                </p>
              </div>
            </div>
          </header>

          <section className="mt-8 sm:mt-10" aria-label="Samenvatting">
            <h2 className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Samenvatting
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  key: "sessions",
                  label: "Sessies",
                  value: String(computed.totals.aantal_sessies),
                  tone: "neutral",
                },
                {
                  key: "kwh",
                  label: "Verbruik",
                  value: `${computed.totals.totaal_kwh} kWh`,
                  tone: "neutral",
                },
                {
                  key: "total",
                  label: "Totale kost",
                  value: eur(computed.totals.totaal_kost),
                  tone: "neutral",
                },
                {
                  key: "open",
                  label: "Open kost",
                  value: eur(computed.totals.open_kost),
                  tone: "warn",
                },
              ].map((kpi) => (
                <div
                  key={kpi.key}
                  className={cn(
                    "rounded-2xl border p-4 shadow-[0_20px_40px_rgba(24,28,32,0.06)]",
                    "bg-card/90 backdrop-blur-sm",
                    kpi.tone === "warn"
                      ? "border-amber-500/30 bg-amber-500/[0.06]"
                      : "border-border",
                  )}
                >
                  <p
                    className={cn(
                      "text-[12px] font-semibold uppercase tracking-wide",
                      kpi.tone === "warn"
                        ? "text-amber-800/80 dark:text-amber-200/80"
                        : "text-muted-foreground",
                    )}
                  >
                    {kpi.label}
                  </p>
                  <p className="mt-1 text-[22px] font-heading font-extrabold tracking-tight text-foreground">
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 sm:mt-10" aria-label="Per maand">
            <h2 className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Per maand
            </h2>
            <div className="app-ios-group">
              {computed.months.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">Geen data.</div>
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(180px,1.2fr)_110px_110px_140px_140px] gap-3 border-b border-border/60 bg-card/40 px-4 py-2.5 text-[12px] font-semibold text-muted-foreground sm:grid">
                    <span>Maand</span>
                    <span className="text-right">Sessies</span>
                    <span className="text-right">kWh</span>
                    <span className="text-right">Kost</span>
                    <span className="text-right">Open</span>
                  </div>

                  {computed.months.map((m) => (
                    <div
                      key={m.maand}
                      className={cn(
                        iosRowClass,
                        "sm:grid sm:grid-cols-[minmax(180px,1.2fr)_110px_110px_140px_140px] sm:items-center sm:gap-3",
                      )}
                    >
                      <div className="min-w-0 sm:col-span-1">
                        <p className="text-[16px] font-semibold leading-snug">{monthLabel(m.maand)}</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground sm:hidden">
                          {m.aantal_sessies} sessies — {m.totaal_kwh} kWh — {eur(m.totaal_kost)}
                          {m.open_kost > 0 ? ` — open: ${eur(m.open_kost)}` : ""}
                        </p>
                      </div>

                      <div className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground sm:block">
                        {m.aantal_sessies}
                      </div>
                      <div className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground sm:block">
                        {m.totaal_kwh}
                      </div>
                      <div className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground sm:block">
                        {eur(m.totaal_kost)}
                      </div>
                      <div className="hidden text-right text-[14px] font-semibold tabular-nums sm:block">
                        <span
                          className={cn(
                            m.open_kost > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                          )}
                        >
                          {m.open_kost > 0 ? eur(m.open_kost) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>

          <section className="mt-8 sm:mt-10" aria-label="Per medewerker">
            <h2 className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              Per medewerker (top)
            </h2>
            <div className="app-ios-group">
              {computed.people.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">Geen data.</div>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-card/40 px-4 py-2.5">
                    <p className="text-[12px] font-semibold text-muted-foreground">
                      Pagina{" "}
                      <span className="tabular-nums text-foreground">
                        {safePeoplePage + 1}
                      </span>{" "}
                      /{" "}
                      <span className="tabular-nums text-foreground">
                        {peopleTotalPages}
                      </span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPeoplePage((p) => Math.max(0, p - 1))}
                        disabled={safePeoplePage === 0}
                        className="h-9 w-9 rounded-lg border border-border bg-card text-[16px] font-semibold shadow-sm hover:bg-muted/40 disabled:opacity-40"
                        aria-label="Vorige pagina"
                      >
                        &lt;
                      </button>
                      <button
                        type="button"
                        onClick={() => setPeoplePage((p) => p + 1)}
                        disabled={safePeoplePage >= peopleTotalPages - 1}
                        className="h-9 w-9 rounded-lg border border-border bg-card text-[16px] font-semibold shadow-sm hover:bg-muted/40 disabled:opacity-40"
                        aria-label="Volgende pagina"
                      >
                        &gt;
                      </button>
                    </div>
                  </div>

                  <div className="hidden grid-cols-[minmax(240px,1.4fr)_110px_110px_140px_140px] gap-3 border-b border-border/60 bg-card/40 px-4 py-2.5 text-[12px] font-semibold text-muted-foreground sm:grid">
                    <span>Medewerker</span>
                    <span className="text-right">Sessies</span>
                    <span className="text-right">kWh</span>
                    <span className="text-right">Kost</span>
                    <span className="text-right">Open</span>
                  </div>

                  {pagedPeople.map((p) => (
                    <div
                      key={p.medewerker_id}
                      className={cn(
                        iosRowClass,
                        "sm:grid sm:grid-cols-[minmax(240px,1.4fr)_110px_110px_140px_140px] sm:items-center sm:gap-3",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[16px] font-semibold leading-snug">{p.label}</p>
                        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground sm:hidden">
                          {p.aantal_sessies} sessies — {p.totaal_kwh} kWh — {eur(p.totaal_kost)}
                          {p.open_kost > 0 ? ` — open: ${eur(p.open_kost)}` : ""}
                        </p>
                      </div>

                      <div className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground sm:block">
                        {p.aantal_sessies}
                      </div>
                      <div className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground sm:block">
                        {p.totaal_kwh}
                      </div>
                      <div className="hidden text-right text-[14px] font-semibold tabular-nums text-foreground sm:block">
                        {eur(p.totaal_kost)}
                      </div>
                      <div className="hidden text-right text-[14px] font-semibold tabular-nums sm:block">
                        <span
                          className={cn(
                            p.open_kost > 0 ? "text-amber-700 dark:text-amber-300" : "text-muted-foreground",
                          )}
                        >
                          {p.open_kost > 0 ? eur(p.open_kost) : "—"}
                        </span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

