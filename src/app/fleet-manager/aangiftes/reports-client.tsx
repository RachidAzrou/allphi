"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TbCarCrash } from "react-icons/tb";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { cn } from "@/lib/utils";
import Link from "next/link";

type Aangifte = {
  id: string;
  status: "submitted" | "completed" | string;
  created_at: string;
  updated_at: string;
  email_status: string | null;
  medewerker_id: number | null;
  fleet_unread?: boolean;
  summary: {
    stad: string | null;
    datum: string | null;
    nummerplaat: string | null;
    bestuurderNaam: string | null;
  };
};

const tabs: Array<{ id: "submitted" | "completed" | "all"; label: string }> = [
  { id: "submitted", label: "Nieuw" },
  { id: "completed", label: "Afgewerkt" },
  { id: "all", label: "Alles" },
];

function formatTimestamp(ts: string) {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

function rowTitle(a: Aangifte) {
  const bits = [
    a.summary.stad,
    a.summary.datum,
    a.summary.bestuurderNaam,
    a.summary.nummerplaat ? `(${a.summary.nummerplaat})` : null,
  ].filter(Boolean);
  return bits.length ? bits.join(" — ") : `Aangifte ${a.id.slice(0, 8)}`;
}

export function FleetManagerAangiftesClient(props: { userEmail: string; userDisplayName: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"submitted" | "completed" | "all">("submitted");
  const [aangiftes, setAangiftes] = useState<Aangifte[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fleet-manager/aangiftes?status=${encodeURIComponent(tab)}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as { aangiftes?: Aangifte[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "load_failed");
      setAangiftes(Array.isArray(json.aangiftes) ? json.aangiftes : []);
    } catch (e) {
      console.error(e);
      setError("Kon aangiftes niet laden.");
      setAangiftes([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const submitted = aangiftes.filter((a) => a.status === "submitted").length;
    const completed = aangiftes.filter((a) => a.status === "completed").length;
    return { submitted, completed, total: aangiftes.length };
  }, [aangiftes]);

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader userEmail={props.userEmail} userDisplayName={props.userDisplayName} showFleetManagerNav />

      {loading ? (
        <LoadingState subtitle="We halen de aangiftes op…" />
      ) : error ? (
        <main className="app-page-shell app-page-shell-wide">
          <ErrorState onRetry={() => void load()} message={error} />
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
                    <TbCarCrash className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                    Aangiftes
                  </h1>
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  Overzicht van verzonden ongevalaangiftes vanuit de app.
                </p>
              </div>
            </div>
          </header>

          <section className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((t) => {
                const active = t.id === tab;
                const count =
                  t.id === "submitted"
                    ? counts.submitted
                    : t.id === "completed"
                      ? counts.completed
                      : counts.total;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] font-semibold shadow-sm transition-colors",
                      active
                        ? t.id === "submitted"
                          ? "border-primary/35 bg-primary/[0.07] text-foreground"
                          : t.id === "completed"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                            : "border-border bg-card text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {t.label}
                    <span className={cn("ml-2 tabular-nums", active ? "text-muted-foreground/80" : "text-muted-foreground/70")}>
                      {count}
                    </span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => void load()}
                className="ml-auto rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-muted-foreground shadow-sm hover:bg-muted/40"
              >
                Refresh
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {aangiftes.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Geen aangiftes in deze lijst.
                </div>
              ) : (
                aangiftes.map((a) => (
                  <Link
                    key={a.id}
                    href={`/fleet-manager/aangiftes/${encodeURIComponent(a.id)}`}
                    className="block rounded-2xl border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-foreground">{rowTitle(a)}</p>
                        <p className="mt-1 text-[12px] text-muted-foreground">
                          Laatst bijgewerkt: {formatTimestamp(a.updated_at)}
                          {a.email_status ? ` • Email: ${a.email_status}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {a.fleet_unread ? (
                          <span
                            className="inline-flex h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-red-500/20"
                            aria-label="Nieuw"
                          />
                        ) : null}
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-semibold",
                            a.status === "completed"
                              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                              : "border-primary/25 bg-primary/[0.06] text-primary",
                          )}
                        >
                          {a.status === "completed" ? "Afgewerkt" : "Nieuw"}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

