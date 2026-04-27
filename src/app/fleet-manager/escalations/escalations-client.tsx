"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { TbListDetails } from "react-icons/tb";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { cn } from "@/lib/utils";
import { EscalationStatusBadge } from "@/components/escalation-status-badge";

type Escalation = {
  id: string;
  conversation_id: string | null;
  user_message_id: string | null;
  status: string;
  subject: string | null;
  created_at: string;
  resolved_at: string | null;
};

function normalizeEscalationSubject(subject: string | null, fallbackEmail?: string | null): string {
  const raw = (subject ?? "").trim();
  if (!raw) return fallbackEmail ? `Escalatie — ${fallbackEmail} — Vraag` : "Escalatie — Vraag";
  if (/^Fleet vraag \(escalatie\)\s+—\s+/i.test(raw)) {
    return raw.replace(/^Fleet vraag \(escalatie\)\s+—\s+/i, "Escalatie — ");
  }
  if (/^Escalatie\s+—\s+/i.test(raw)) return raw;
  return `Escalatie — ${raw}`;
}

function parseEscalationDisplay(subject: string | null): { title: string; requester: string | null } {
  const normalized = normalizeEscalationSubject(subject);
  const withoutPrefix = normalized.replace(/^Escalatie\s+—\s+/i, "").trim();
  const parts = withoutPrefix
    .split(/\s+—\s+/g)
    .map((p) => p.trim())
    .filter(Boolean);

  const email = parts.find((p) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p)) ?? null;
  const titleParts = parts.filter((p) => p !== email);
  const title = titleParts.length ? titleParts.join(" — ") : "Escalatie";
  return { title, requester: email };
}

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

const tabs: Array<{ id: "open" | "resolved" | "all"; label: string }> = [
  { id: "open", label: "Open" },
  { id: "resolved", label: "Afgehandeld" },
  { id: "all", label: "Alles" },
];

function normalizeTabFromSearch(v: string | null): "open" | "resolved" | "all" {
  const s = (v ?? "").trim().toLowerCase();
  if (s === "resolved") return "resolved";
  if (s === "all") return "all";
  return "open";
}

export function FleetManagerEscalationsClient(props: {
  userEmail: string;
  userDisplayName: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = normalizeTabFromSearch(searchParams.get("tab"));

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [escalations, setEscalations] = useState<Escalation[]>([]);

  const statusFilter = useMemo(() => {
    if (tab === "resolved") return "resolved" as const;
    if (tab === "open") return "open" as const;
    return "all" as const;
  }, [tab]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url =
        statusFilter === "resolved"
          ? "/api/fleet-manager/escalations?status=resolved"
          : "/api/fleet-manager/escalations";
      const res = await fetch(url, { credentials: "same-origin" });
      const json = (await res.json()) as { escalations?: Escalation[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "load_failed");
      const raw = Array.isArray(json.escalations) ? json.escalations : [];
      const filtered =
        statusFilter === "open"
          ? raw.filter((e) => e.status !== "resolved")
          : raw;
      setEscalations(filtered);
    } catch (e) {
      console.error(e);
      setError("Kon escalaties niet laden.");
      setEscalations([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const setTab = useCallback(
    (next: "open" | "resolved" | "all") => {
      const p = new URLSearchParams(searchParams.toString());
      p.set("tab", next);
      router.push(`/fleet-manager/escalations?${p.toString()}`);
    },
    [router, searchParams],
  );

  const openEscalation = useCallback(
    (id: string) => {
      router.push(`/fleet-manager/escalations/${encodeURIComponent(id)}`);
    },
    [router],
  );

  const counts = useMemo(() => {
    const open = escalations.filter((e) => e.status !== "resolved").length;
    const resolved = escalations.filter((e) => e.status === "resolved").length;
    return { open, resolved, total: escalations.length };
  }, [escalations]);

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader
        userEmail={props.userEmail}
        userDisplayName={props.userDisplayName}
        showFleetManagerNav
      />

      {loading ? (
        <LoadingState subtitle="We halen de escalaties op…" />
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
                    <TbListDetails className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                    Escalaties
                  </h1>
                </div>
                <p className="mt-1 text-sm leading-snug text-muted-foreground">
                  Doorgestuurde vragen uit de medewerker-chat: antwoord als fleet manager en volg status op.
                </p>
              </div>
            </div>
          </header>

          <section className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              {tabs.map((t) => {
                const active = t.id === tab;
                const count =
                  t.id === "open" ? counts.open : t.id === "resolved" ? counts.resolved : counts.total;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] font-semibold shadow-sm transition-colors",
                      active
                        ? t.id === "open"
                          ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                          : t.id === "resolved"
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-200"
                            : "border-primary/35 bg-primary/[0.07] text-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "ml-2 tabular-nums",
                        active
                          ? t.id === "open"
                            ? "text-amber-700/80 dark:text-amber-200/80"
                            : t.id === "resolved"
                              ? "text-emerald-700/80 dark:text-emerald-200/80"
                              : "text-muted-foreground/80"
                          : "text-muted-foreground/70",
                      )}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="mt-6 sm:mt-8" aria-label="Escalaties lijst">
            <div className="app-ios-group">
              {escalations.length === 0 ? (
                <div className="px-4 py-4 text-sm text-muted-foreground">
                  Geen escalaties in deze filter.
                </div>
              ) : (
                <>
                  <div className="hidden grid-cols-[minmax(260px,1.4fr)_170px_140px] gap-3 border-b border-border/60 bg-card/40 px-4 py-2.5 text-[12px] font-semibold text-muted-foreground sm:grid">
                    <span>Onderwerp</span>
                    <span className="text-right">Datum</span>
                    <span className="text-right">Status</span>
                  </div>

                  <ul className="divide-y divide-border/60">
                    {escalations.map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => openEscalation(e.id)}
                          className={cn(
                            "w-full touch-manipulation px-4 py-3.5 text-left transition-colors",
                            "hover:bg-muted/30 active:bg-muted/40",
                            "sm:grid sm:grid-cols-[minmax(260px,1.4fr)_170px_140px] sm:items-center sm:gap-3",
                          )}
                        >
                          <div className="min-w-0">
                            {(() => {
                              const d = parseEscalationDisplay(e.subject);
                              return (
                                <>
                                  <p className="line-clamp-2 text-[15px] font-semibold leading-snug">
                                    {d.title}
                                  </p>
                                  <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                                    {d.requester ? (
                                      <span className="truncate">
                                        {d.requester}
                                      </span>
                                    ) : null}
                                    <span className="tabular-nums">{formatTimestamp(e.created_at)}</span>
                                    <span className="ml-auto sm:hidden">
                                      <EscalationStatusBadge size="compact" status={e.status} />
                                    </span>
                                  </div>
                                </>
                              );
                            })()}
                          </div>

                          <div className="hidden text-right text-[13px] font-medium tabular-nums text-muted-foreground sm:block">
                            {formatTimestamp(e.created_at)}
                          </div>

                          <div className="hidden justify-end sm:flex">
                            <EscalationStatusBadge size="compact" status={e.status} />
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

