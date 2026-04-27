"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  FilePenLine,
  FileText,
  PlusCircle,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/loading-state";
import { AllphiLoader } from "@/components/allphi-loader";
import { createInitialAccidentState } from "@/types/ongeval";
import { mergePayloadIntoState } from "@/lib/ongeval/engine";
import { formatDateForDisplay } from "@/lib/ongeval/date-utils";
import { cn } from "@/lib/utils";
import { FaRegEye } from "react-icons/fa";
import { FaCarCrash } from "react-icons/fa";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

type EmailStatus = "queued" | "sending" | "sent" | "failed" | null;

type AangifteRow = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
  payload: unknown;
  email_status: EmailStatus;
  email_recipient: string | null;
  email_sent_at: string | null;
  email_error: string | null;
  submission_mode: "wizard" | "scan" | null;
  status: "draft" | "submitted" | "completed";
};

// Behoud oude type-aliases zodat bestaande helpers/imports niet breken.
type SubmittedRow = AangifteRow;
type DraftRow = AangifteRow;

function asBigIntId(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/**
 * Trekt een korte titel + ondertitel uit de opgeslagen payload zodat de
 * gebruiker zijn aangiftes kan herkennen zonder ze te openen.
 */
function describeReport(row: SubmittedRow): { title: string; subtitle: string } {
  const state = mergePayloadIntoState(row.payload);
  const isScan =
    row.submission_mode === "scan" || state.submissionMode === "scan";

  if (isScan) {
    const m = state.scanSubmission.metadata;
    const datum = formatDateForDisplay(m.datum) || "Onbekende datum";
    const stad = m.stad?.trim();
    const plaat = m.nummerplaat?.trim();
    return {
      title: `Aangifte (gescand) — ${datum}`,
      subtitle: [stad, plaat].filter(Boolean).join(" • ") || "Geen extra info",
    };
  }

  const datum = formatDateForDisplay(state.location.datum) || "Onbekende datum";
  const stad = state.location.stad?.trim();
  const plaat = state.partyA.voertuig.nummerplaat?.trim();
  return {
    title: `Aangifte — ${datum}`,
    subtitle: [stad, plaat].filter(Boolean).join(" • ") || "Geen extra info",
  };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("nl-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function draftBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
      <FilePenLine className="size-3.5" strokeWidth={2.5} />
      Concept (nog niet afgerond)
    </span>
  );
}

function emailStatusBadge(row: SubmittedRow) {
  // De "verzenden" actie stuurt nu naar de fleetmanager-inbox in-app (status=submitted),
  // niet langer naar e-mail. We tonen hier dus primair de status van de aangifte.
  if (row.status === "submitted") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F7EE] px-2.5 py-1 text-[12px] font-semibold text-[#1F8A4C]">
        <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
        Verzonden naar fleetmanager
      </span>
    );
  }
  if (row.status === "completed") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
        <Clock className="size-3.5" strokeWidth={2.5} />
        Afgewerkt
      </span>
    );
  }

  // Fallback voor legacy/edge-cases: toon nog steeds email-status indien aanwezig.
  switch (row.email_status) {
    case "sent":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E8F7EE] px-2.5 py-1 text-[12px] font-semibold text-[#1F8A4C]">
          <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
          Verzonden
        </span>
      );
    case "failed":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDECEE] px-2.5 py-1 text-[12px] font-semibold text-[#B42318]">
          <AlertCircle className="size-3.5" strokeWidth={2.5} />
          Verzenden mislukt
        </span>
      );
    case "sending":
    case "queued":
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E5] px-2.5 py-1 text-[12px] font-semibold text-[#7A5A00]">
          <AllphiLoader size={14} className="-my-0.5" />
          Bezig met verzenden
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-[12px] font-semibold text-muted-foreground">
          <Clock className="size-3.5" strokeWidth={2.5} />
          Status: {row.status}
        </span>
      );
  }
}

export default function OngevalIndexPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [submitted, setSubmitted] = useState<SubmittedRow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [resending, setResending] = useState<string | null>(null);

  const fetchAll = useCallback(
    async (userId: string) => {
      // We halen ALLE aangiftes op (draft + submitted + legacy 'completed') in
      // één query. De UI splitst ze daarna op: alles wat geen draft is wordt als
      // afgemaakte aangifte getoond, met de juiste verzendstatus-badge.
      const { data, error } = await supabase
        .from("ongeval_aangiften")
        .select(
          "id, status, created_at, updated_at, payload, email_status, email_recipient, email_sent_at, email_error, submission_mode",
        )
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(75);

      if (error) {
        console.error(error);
        toast.error("Kon je aangiftes niet laden.");
        setDrafts([]);
        setSubmitted([]);
        return;
      }

      const rows = (data as AangifteRow[] | null) ?? [];
      setDrafts(rows.filter((r) => r.status === "draft"));
      setSubmitted(rows.filter((r) => r.status !== "draft"));
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        router.replace("/login");
        return;
      }
      setUserEmail(user.email ?? "");
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
      await fetchAll(user.id);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, supabase, fetchAll]);

  const createNew = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      router.push("/login");
      return;
    }
    const joinSecret = Array.from(
      crypto.getRandomValues(new Uint8Array(16)),
    )
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const { data: medewerker } = await supabase
      .from("medewerkers")
      .select("id")
      .ilike("emailadres", user.email ?? "")
      .maybeSingle();

    const medewerkerId = asBigIntId(
      (medewerker as { id?: unknown } | null)?.id,
    );
    const payload = createInitialAccidentState();
    const { data, error } = await supabase
      .from("ongeval_aangiften")
      .insert({
        user_id: user.id,
        medewerker_id: medewerkerId,
        status: "draft",
        join_secret: joinSecret,
        payload: payload as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();
    if (error) {
      console.error(error);
      toast.error("Kon geen nieuw dossier aanmaken.");
      return;
    }
    router.push(`/ongeval/${data.id}`);
  }, [router, supabase]);

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        router.replace("/login");
        return;
      }
      const { error } = await supabase
        .from("ongeval_aangiften")
        .delete()
        .eq("id", deleteId)
        .eq("user_id", user.id)
        .eq("status", "draft");
      if (error) throw error;
      setDrafts((prev) => prev.filter((d) => d.id !== deleteId));
      setDeleteId(null);
      toast.success("Concept verwijderd.");
    } catch (e) {
      console.error(e);
      toast.error("Verwijderen mislukt.");
    } finally {
      setDeleting(false);
    }
  }, [deleteId, router, supabase]);

  const resend = useCallback(
    async (id: string) => {
      setResending(id);
      // Optimistic UI: zet meteen op "sending" zodat de gebruiker feedback ziet.
      setSubmitted((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, email_status: "sending" } : r,
        ),
      );
      try {
        const res = await fetch(`/api/ongeval/${id}/send`, {
          method: "POST",
          headers: { "content-type": "application/json" },
        });
        const body = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          error?: string;
          detail?: string;
          recipient?: string;
        };
        if (!res.ok || body?.ok === false) {
          toast.error(
            body.error === "no_recipient"
              ? "Er is nog geen centraal e-mailadres ingesteld."
              : body.error === "incomplete"
                ? "De aangifte is nog niet volledig."
                : "Verzenden mislukt. Probeer opnieuw.",
          );
        } else {
          toast.success(
            body.recipient
              ? `Verzonden naar ${body.recipient}.`
              : "Aangifte verzonden naar de fleetmanager.",
          );
        }
        // Refresh server-state om badge correct te zetten.
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) await fetchAll(user.id);
      } catch (e) {
        console.error(e);
        toast.error("Verzenden mislukt. Probeer opnieuw.");
      } finally {
        setResending(null);
      }
    },
    [supabase, fetchAll],
  );

  if (loading) {
    return (
      <div className="app-canvas flex min-h-[100dvh] flex-col">
        <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />
        <LoadingState context="ongeval" />
      </div>
    );
  }

  const hasDrafts = drafts.length > 0;
  const hasSubmitted = submitted.length > 0;
  const bothLists = hasDrafts && hasSubmitted;
  const iosRowClass =
    "touch-manipulation border-b border-border/60 px-4 py-3.5 last:border-b-0 active:bg-muted/40 sm:px-4";

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />
      <main className="app-page-shell">
        {/* Geen card-hero: alleen titel + primaire actie */}
        <header className="touch-manipulation pt-1">
          <div className="flex items-start gap-3">
            <FaCarCrash
              className="mt-0.5 size-7 shrink-0 text-primary sm:size-8"
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <h1
                id="ongeval-index-title"
                className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]"
              >
                Ongeval of aanrijding
              </h1>
            </div>
          </div>
          <Button
            type="button"
            size="lg"
            className="mt-5 min-h-12 w-full justify-center gap-2 rounded-xl text-[16px] font-semibold touch-manipulation sm:mt-6 sm:min-h-11 sm:text-[15px]"
            onClick={() => void createNew()}
          >
            <PlusCircle className="size-5 shrink-0" strokeWidth={1.75} />
            Nieuwe aangifte
          </Button>
        </header>

        {hasDrafts || hasSubmitted ? (
          <div
            className={cn(
              "mt-8 space-y-8 sm:mt-10",
              bothLists && "xl:grid xl:grid-cols-2 xl:items-start xl:gap-x-8 xl:space-y-0",
            )}
          >
            {hasDrafts ? (
              <section aria-labelledby="ongeval-drafts-heading" className="min-w-0">
                <h2
                  id="ongeval-drafts-heading"
                  className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Concepten
                  <span className="ml-1.5 tabular-nums text-muted-foreground/80">
                    ({drafts.length})
                  </span>
                </h2>
                <div className="app-ios-group">
                  {drafts.map((row) => {
                    const meta = describeReport(row);
                    return (
                      <article key={row.id} className={iosRowClass}>
                        <div className="flex gap-3">
                          <FilePenLine
                            className="mt-0.5 size-[18px] shrink-0 text-muted-foreground"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="space-y-1">
                              <p className="text-[16px] font-semibold leading-snug text-foreground">
                                {meta.title}
                              </p>
                              <p className="text-[13px] leading-snug text-muted-foreground">
                                {meta.subtitle}
                              </p>
                            </div>
                            <div className="mt-2.5">{draftBadge()}</div>
                            <p className="mt-2 text-[12px] text-muted-foreground">
                              Bewerkt {formatDateTime(row.updated_at)}
                            </p>
                            <div
                              className="mt-4 flex flex-row gap-3 border-t border-border/50 pt-3"
                              role="group"
                              aria-label="Acties voor dit concept"
                            >
                              <Button
                                type="button"
                                variant="outline"
                                aria-label="Doorgaan"
                                className="min-h-11 flex-1 touch-manipulation justify-center gap-0 sm:gap-2"
                                onClick={() => router.push(`/ongeval/${row.id}`)}
                              >
                                <FaRegEye
                                  className="size-5 shrink-0 sm:size-4"
                                  aria-hidden
                                />
                                <span className="hidden sm:inline">Doorgaan</span>
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                aria-label="Verwijderen"
                                className="min-h-11 flex-1 touch-manipulation justify-center gap-0 sm:gap-2"
                                onClick={() => setDeleteId(row.id)}
                              >
                                <Trash2
                                  className="size-5 shrink-0 sm:size-4"
                                  strokeWidth={2}
                                  aria-hidden
                                />
                                <span className="hidden sm:inline">Verwijderen</span>
                              </Button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {hasSubmitted ? (
              <section
                aria-labelledby="ongeval-submitted-heading"
                className="min-w-0"
              >
                <h2
                  id="ongeval-submitted-heading"
                  className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Afgeronde aangiftes
                  <span className="ml-1.5 tabular-nums text-muted-foreground/80">
                    ({submitted.length})
                  </span>
                </h2>
                <div className="app-ios-group">
                  {submitted.map((row) => {
                    const meta = describeReport(row);
                    const isResending = resending === row.id;
                    return (
                      <article key={row.id} className={iosRowClass}>
                        <div className="flex gap-3">
                          <FileText
                            className="mt-0.5 size-[18px] shrink-0 text-primary"
                            strokeWidth={2}
                            aria-hidden
                          />
                          <div className="min-w-0 flex-1">
                            <div className="space-y-1">
                              <p className="text-[16px] font-semibold leading-snug text-foreground">
                                {meta.title}
                              </p>
                              <p className="text-[13px] leading-snug text-muted-foreground">
                                {meta.subtitle}
                              </p>
                            </div>

                            <div className="mt-2.5">{emailStatusBadge(row)}</div>

                            {row.email_status === "sent" && row.email_sent_at ? (
                              <div className="mt-2 rounded-lg bg-muted/50 px-3 py-2 text-[12px] leading-snug text-muted-foreground">
                                <p className="font-medium text-foreground/80">E-mail</p>
                                <p className="mt-0.5">
                                  Verzonden {formatDateTime(row.email_sent_at)}
                                </p>
                                {row.email_recipient ? (
                                  <p className="mt-1 truncate text-[12px]">{row.email_recipient}</p>
                                ) : null}
                              </div>
                            ) : null}

                            {row.email_status === "failed" && row.email_error ? (
                              <div className="mt-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-destructive">
                                  Verzenden mislukt
                                </p>
                                <p className="mt-1 line-clamp-3 text-[12px] leading-snug text-destructive">
                                  {row.email_error}
                                </p>
                              </div>
                            ) : null}

                            <div
                              className="mt-4 flex flex-row gap-3 border-t border-border/50 pt-3"
                              role="group"
                              aria-label="Acties voor deze aangifte"
                            >
                              <Button
                                type="button"
                                variant="outline"
                                aria-label="Open dossier"
                                className="min-h-11 flex-1 touch-manipulation justify-center gap-0 sm:gap-2"
                                onClick={() => router.push(`/ongeval/${row.id}`)}
                              >
                                <FaRegEye className="size-5 shrink-0 sm:size-4" aria-hidden />
                                <span className="hidden sm:inline">Open dossier</span>
                              </Button>
                              <Button
                                type="button"
                                aria-label="Verstuur naar fleetmanager"
                                className="min-h-11 flex-1 touch-manipulation justify-center bg-emerald-600 px-0 py-0 text-center text-[14px] font-semibold leading-snug text-white hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 sm:gap-2"
                                onClick={() => void resend(row.id)}
                                disabled={
                                  isResending ||
                                  row.email_status === "sending" ||
                                  row.email_status === "queued"
                                }
                              >
                                {isResending ||
                                row.email_status === "sending" ||
                                row.email_status === "queued" ? (
                                  <span className="inline-flex items-center justify-center gap-2">
                                    <AllphiLoader size={18} className="shrink-0 sm:[&>img]:!h-4 sm:[&>img]:!w-4" />
                                    <span className="hidden sm:inline">Bezig…</span>
                                  </span>
                                ) : row.email_status === "sent" ? (
                                  <span className="inline-flex items-center justify-center gap-2">
                                    <Send className="size-5 shrink-0 sm:size-4" aria-hidden />
                                    <span className="hidden sm:inline">Opnieuw verzenden</span>
                                  </span>
                                ) : row.email_status === "failed" ? (
                                  <span className="inline-flex items-center justify-center gap-2">
                                    <Send className="size-5 shrink-0 sm:size-4" aria-hidden />
                                    <span className="hidden sm:inline">Opnieuw proberen</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center justify-center gap-2">
                                    <Send className="size-5 shrink-0 sm:size-4" aria-hidden />
                                    <span className="hidden sm:inline">Verstuur naar fleetmanager</span>
                                  </span>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {!hasDrafts && !hasSubmitted ? (
          <section
            aria-labelledby="ongeval-empty-title"
            className="mt-10 text-center sm:mt-12"
          >
            <FaCarCrash
              className="mx-auto mb-2 size-8 text-muted-foreground/50"
              aria-hidden
            />
            <p
              id="ongeval-empty-title"
              className="font-heading text-[17px] font-semibold text-foreground"
            >
              Nog geen aangiftes
            </p>
            <p className="mx-auto mt-2 max-w-xs text-[14px] leading-relaxed text-muted-foreground">
              Tik op <span className="font-medium text-foreground">Nieuwe aangifte</span> om te
              beginnen.
            </p>
          </section>
        ) : null}
      </main>

      <Dialog open={deleteId !== null} onOpenChange={(o) => (!o ? setDeleteId(null) : null)}>
        <DialogContent showCloseButton>
          <DialogTitle>Concept verwijderen?</DialogTitle>
          <DialogDescription>
            Dit concept wordt definitief verwijderd. Dit kan niet ongedaan gemaakt worden.
          </DialogDescription>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button
              variant="outline"
              size="lg"
              className="min-h-12 w-full touch-manipulation sm:min-h-9 sm:w-auto"
              onClick={() => setDeleteId(null)}
              disabled={deleting}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              size="lg"
              className="min-h-12 w-full touch-manipulation sm:min-h-9 sm:w-auto"
              onClick={() => void confirmDelete()}
              disabled={deleting}
            >
              Verwijder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
