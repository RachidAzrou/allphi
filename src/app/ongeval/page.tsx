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
  RefreshCw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/loading-state";
import { createInitialAccidentState } from "@/types/ongeval";
import { mergePayloadIntoState } from "@/lib/ongeval/engine";
import { formatDateForDisplay } from "@/lib/ongeval/date-utils";
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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FFF6E5] px-2.5 py-1 text-[12px] font-semibold text-[#7A5A00]">
      <FilePenLine className="size-3.5" strokeWidth={2.5} />
      Concept (nog niet afgerond)
    </span>
  );
}

function emailStatusBadge(row: SubmittedRow) {
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
          <RefreshCw className="size-3.5 animate-spin" strokeWidth={2.5} />
          Bezig met verzenden
        </span>
      );
    default:
      // Aangifte is afgemaakt (status='submitted' of legacy 'completed') maar
      // er is nog geen e-mailpoging geregistreerd. Geef een duidelijke hint.
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F1F4F8] px-2.5 py-1 text-[12px] font-semibold text-[#5F7382]">
          <Clock className="size-3.5" strokeWidth={2.5} />
          Nog niet verzonden
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
      <div className="flex min-h-[100dvh] flex-col bg-[#F7F9FC]">
        <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />
        <LoadingState context="ongeval" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F7F9FC]">
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6 lg:px-8">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F4FB] text-[#2799D7]"
              aria-hidden
            >
              <FaCarCrash className="size-5" aria-hidden />
            </span>
            <h2 className="font-heading text-xl font-semibold text-[#163247]">
              Ongeval of aanrijding
            </h2>
          </div>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-[#5F7382]">
            Start een nieuw Europees aanrijdingsformulier-stappenplan of ga
            verder met een concept.
          </p>

          <div className="mt-4 flex w-full max-w-md flex-col gap-3">
            <Button
              type="button"
              className="h-14 w-full justify-center gap-2 rounded-xl bg-[#2799D7] text-[16px] font-semibold text-white hover:bg-[#1e7bb0]"
              onClick={() => void createNew()}
            >
              <PlusCircle className="size-5" strokeWidth={1.75} />
              Nieuwe aangifte
            </Button>
          </div>
        </div>

        {drafts.length > 0 ? (
          <div className="mt-8 space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[#5F7382]">
              Concepten ({drafts.length})
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {drafts.map((row) => {
                const meta = describeReport(row);
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-[#FCD49B]/70 bg-white px-4 py-4 shadow-[0_2px_12px_rgba(39,153,215,0.06)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#FFF6E5] text-[#7A5A00]">
                        <FilePenLine className="size-4" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-[#163247]">
                          {meta.title}
                        </p>
                        <p className="mt-0.5 truncate text-[12.5px] leading-snug text-[#5F7382]">
                          {meta.subtitle}
                        </p>
                        <div className="mt-2">{draftBadge()}</div>
                        <p className="mt-2 text-[11.5px] leading-snug text-[#5F7382]">
                          Laatst bewerkt: {formatDateTime(row.updated_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        className="h-9 gap-1.5 rounded-lg bg-[#2799D7] px-3 text-[13px] font-semibold text-white hover:bg-[#1e7bb0]"
                        onClick={() => router.push(`/ongeval/${row.id}`)}
                      >
                        <FaRegEye className="size-3.5" aria-hidden />
                        Doorgaan met invullen
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 gap-1.5 rounded-lg border-[#B42318]/30 bg-white px-3 text-[13px] text-[#B42318] hover:bg-[#FDECEE]"
                        onClick={() => setDeleteId(row.id)}
                      >
                        <Trash2 className="size-3.5" strokeWidth={2} />
                        Verwijder
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {submitted.length > 0 ? (
          <div className="mt-8 space-y-3">
            <p className="text-[13px] font-semibold uppercase tracking-wide text-[#5F7382]">
              Afgeronde aangiftes ({submitted.length})
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {submitted.map((row) => {
                const meta = describeReport(row);
                const isResending = resending === row.id;
                return (
                  <div
                    key={row.id}
                    className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(39,153,215,0.06)]"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E8F4FB] text-[#2799D7]">
                        <FileText className="size-4" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-semibold text-[#163247]">
                          {meta.title}
                        </p>
                        <p className="mt-0.5 truncate text-[12.5px] leading-snug text-[#5F7382]">
                          {meta.subtitle}
                        </p>
                        <div className="mt-2">{emailStatusBadge(row)}</div>

                        {row.email_status === "sent" && row.email_sent_at ? (
                          <p className="mt-2 text-[11.5px] leading-snug text-[#5F7382]">
                            Verzonden op {formatDateTime(row.email_sent_at)}
                            {row.email_recipient ? (
                              <>
                                <br />
                                Naar {row.email_recipient}
                              </>
                            ) : null}
                          </p>
                        ) : null}

                        {row.email_status === "failed" && row.email_error ? (
                          <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-[#B42318]">
                            {row.email_error}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-9 gap-1.5 rounded-lg border-[#2799D7]/35 bg-white px-3 text-[13px] text-[#163247] hover:bg-[#E8F4FB]"
                        onClick={() => router.push(`/ongeval/${row.id}`)}
                      >
                        <FaRegEye className="size-3.5 text-[#2799D7]" aria-hidden />
                        Open
                      </Button>
                      <Button
                        type="button"
                        className="h-9 gap-1.5 rounded-lg bg-[#2799D7] px-3 text-[13px] font-semibold text-white hover:bg-[#1e7bb0] disabled:opacity-60"
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
                          <RefreshCw
                            className="size-3.5 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <Send className="size-3.5" aria-hidden />
                        )}
                        {row.email_status === "sent"
                          ? "Opnieuw verzenden"
                          : row.email_status === "failed"
                            ? "Opnieuw proberen"
                            : "Verstuur naar fleetmanager"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {drafts.length === 0 && submitted.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-dashed border-[#2799D7]/30 bg-white px-6 py-10 text-center">
            <FaCarCrash
              className="mx-auto mb-3 size-8 text-[#2799D7]/60"
              aria-hidden
            />
            <p className="text-[15px] font-semibold text-[#163247]">
              Nog geen aangiftes
            </p>
            <p className="mt-1 text-[13px] text-[#5F7382]">
              Klik op &laquo;Nieuwe aangifte&raquo; om er een aan te maken.
            </p>
          </div>
        ) : null}
      </div>

      <Dialog open={deleteId !== null} onOpenChange={(o) => (!o ? setDeleteId(null) : null)}>
        <DialogContent showCloseButton>
          <DialogTitle>Concept verwijderen?</DialogTitle>
          <DialogDescription>
            Dit concept wordt definitief verwijderd. Dit kan niet ongedaan gemaakt worden.
          </DialogDescription>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteId(null)} disabled={deleting}>
              Annuleren
            </Button>
            <Button
              variant="destructive"
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
