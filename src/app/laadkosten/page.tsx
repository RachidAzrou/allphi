"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Zap, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { eur } from "@/lib/formatters/utils";
import { cn } from "@/lib/utils";
import type { ChargingSessionOverview } from "@/types/database";

type ChargingStats = {
  aantal_sessies: number;
  totaal_kwh: number;
  totaal_kost: number;
  gemiddelde_kost_per_sessie: number;
};

type LocationAgg = {
  locatie_type: string;
  aantal_sessies: number;
  totaal_kwh: number;
  totaal_kost: number;
};

type ReimbursementAgg = {
  aantal_open: number;
  open_bedrag: number;
  aantal_betaald: number;
  betaald_bedrag: number;
};

const iosRowClass =
  "touch-manipulation flex items-center gap-3 border-b border-border/60 px-4 py-3.5 last:border-b-0 active:bg-muted/40 sm:px-4";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function computeStats(sessions: ChargingSessionOverview[]): {
  stats: ChargingStats | null;
  locations: LocationAgg[];
  reimbursement: ReimbursementAgg | null;
} {
  if (!sessions || sessions.length === 0) {
    return { stats: null, locations: [], reimbursement: null };
  }

  const aantal_sessies = sessions.length;
  const totaal_kwh = round2(
    sessions.reduce((s, r) => s + (Number(r.kwh) || 0), 0),
  );
  const totaal_kost = round2(
    sessions.reduce((s, r) => s + (Number(r.kost_eur) || 0), 0),
  );

  const grouped = new Map<string, { kwh: number; kost: number; count: number }>();
  for (const s of sessions) {
    const type = (s.locatie_type ?? "onbekend").trim() || "onbekend";
    const current = grouped.get(type) ?? { kwh: 0, kost: 0, count: 0 };
    current.kwh += Number(s.kwh) || 0;
    current.kost += Number(s.kost_eur) || 0;
    current.count += 1;
    grouped.set(type, current);
  }

  const locations = Array.from(grouped.entries())
    .map(([locatie_type, agg]) => ({
      locatie_type,
      aantal_sessies: agg.count,
      totaal_kwh: round2(agg.kwh),
      totaal_kost: round2(agg.kost),
    }))
    .sort((a, b) => b.aantal_sessies - a.aantal_sessies);

  const open = sessions.filter((s) => !s.terugbetaald);
  const betaald = sessions.filter((s) => s.terugbetaald);

  const reimbursement: ReimbursementAgg = {
    aantal_open: open.length,
    open_bedrag: round2(open.reduce((s, r) => s + (Number(r.kost_eur) || 0), 0)),
    aantal_betaald: betaald.length,
    betaald_bedrag: round2(
      betaald.reduce((s, r) => s + (Number(r.kost_eur) || 0), 0),
    ),
  };

  return {
    stats: {
      aantal_sessies,
      totaal_kwh,
      totaal_kost,
      gemiddelde_kost_per_sessie:
        aantal_sessies > 0 ? round2(totaal_kost / aantal_sessies) : 0,
    },
    locations,
    reimbursement,
  };
}

export default function LaadkostenPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [sessions, setSessions] = useState<ChargingSessionOverview[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        router.replace("/login");
        return;
      }
      setUserEmail(user.email);

      const { data: medewerker } = await supabase
        .from("medewerkers")
        .select("voornaam, naam")
        .eq("emailadres", user.email)
        .maybeSingle();
      if (medewerker) {
        const volledigeNaam = [medewerker.voornaam, medewerker.naam]
          .filter((s) => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
          .join(" ");
        if (volledigeNaam) setUserDisplayName(volledigeNaam);
      }

      const { data, error } = await supabase
        .from("v_charging_sessions_overview")
        .select("sessie_id, datumtijd_start, datumtijd_einde, kwh, kost_eur, locatie_type, terugbetaald")
        .eq("emailadres", user.email)
        .order("datumtijd_start", { ascending: false })
        .limit(1000);

      if (cancelled) return;

      if (error) {
        console.error(error);
        toast.error("Kon je laadkosten niet laden.");
        setError("Kon je laadkosten niet laden.");
        setSessions([]);
        setLoading(false);
        return;
      }

      setSessions(((data as ChargingSessionOverview[]) ?? []).filter(Boolean));
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const computed = useMemo(() => computeStats(sessions), [sessions]);

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />

      {loading ? (
        <LoadingState subtitle="We halen je laadkosten op…" />
      ) : error ? (
        <main className="app-page-shell">
          <ErrorState
            message={error}
            onRetry={() => {
              router.refresh();
            }}
          />
        </main>
      ) : (
        <main className="app-page-shell">
          <header className="touch-manipulation pt-1">
            <div className="flex items-start gap-3">
              <Zap
                className="mt-0.5 size-7 shrink-0 text-primary sm:size-8"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                  Mijn laadkosten
                </h1>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  Overzicht op basis van geregistreerde laadsessies. Terugbetalingen
                  worden typisch maandelijks verwerkt.
                </p>
              </div>
            </div>
          </header>

          {!computed.stats ? (
            <section className="mt-8 sm:mt-10">
              <div className="app-ios-group">
                <div className={iosRowClass}>
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold leading-snug">
                      Nog geen laadsessies gevonden
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                      Zodra er laadsessies binnenkomen, zie je hier je kWh, kosten en
                      terugbetalingsstatus.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section aria-labelledby="laadkosten-summary-heading" className="mt-8 sm:mt-10">
                <h2
                  id="laadkosten-summary-heading"
                  className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Overzicht
                </h2>
                <div className="app-ios-group">
                  {[
                    {
                      label: "Aantal sessies",
                      value: String(computed.stats.aantal_sessies),
                    },
                    { label: "Totaal geladen", value: `${computed.stats.totaal_kwh} kWh` },
                    { label: "Totale kosten", value: eur(computed.stats.totaal_kost) },
                    {
                      label: "Gemiddeld per sessie",
                      value: eur(computed.stats.gemiddelde_kost_per_sessie),
                    },
                  ].map((row) => (
                    <div key={row.label} className={iosRowClass}>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-muted-foreground">
                          {row.label}
                        </p>
                        <p className="mt-0.5 text-[16px] font-semibold leading-snug">
                          {row.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section aria-labelledby="laadkosten-locatie-heading" className="mt-8 sm:mt-10">
                <h2
                  id="laadkosten-locatie-heading"
                  className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Thuis vs. publiek
                </h2>
                <div className="app-ios-group">
                  {computed.locations.map((l) => (
                    <div
                      key={l.locatie_type}
                      className={cn(iosRowClass, "hover:bg-muted/30 transition-colors")}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[16px] font-semibold leading-snug capitalize">
                          {l.locatie_type}
                        </p>
                        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                          {l.aantal_sessies} sessies — {l.totaal_kwh} kWh — {eur(l.totaal_kost)}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-5 shrink-0 text-muted-foreground/35"
                        strokeWidth={2}
                        aria-hidden
                      />
                    </div>
                  ))}
                </div>
              </section>

              {computed.reimbursement ? (
                <section aria-labelledby="laadkosten-reimb-heading" className="mt-8 sm:mt-10">
                  <h2
                    id="laadkosten-reimb-heading"
                    className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Terugbetaling
                  </h2>
                  <div className="app-ios-group">
                    {[
                      {
                        label: "Open sessies",
                        value: String(computed.reimbursement.aantal_open),
                      },
                      {
                        label: "Openstaand bedrag",
                        value: eur(computed.reimbursement.open_bedrag),
                      },
                      {
                        label: "Verwerkte sessies",
                        value: String(computed.reimbursement.aantal_betaald),
                      },
                      {
                        label: "Terugbetaald",
                        value: eur(computed.reimbursement.betaald_bedrag),
                      },
                    ].map((row) => (
                      <div key={row.label} className={iosRowClass}>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-muted-foreground">
                            {row.label}
                          </p>
                          <p className="mt-0.5 text-[16px] font-semibold leading-snug">
                            {row.value}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          )}
        </main>
      )}
    </div>
  );
}

