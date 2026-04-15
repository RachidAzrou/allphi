"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileWarning, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/loading-state";
import { createInitialAccidentState } from "@/types/ongeval";
import { FaRegEye } from "react-icons/fa";
import { FaCarCrash } from "react-icons/fa";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

type DraftRow = {
  id: string;
  created_at: string | null;
  updated_at: string | null;
};

function asBigIntId(v: unknown): string | null {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

export default function OngevalIndexPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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
      const { data: draftRows, error: draftError } = await supabase
        .from("ongeval_aangiften")
        .select("id, created_at, updated_at")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false })
        .limit(25);

      if (!cancelled) {
        if (draftError) {
          console.error(draftError);
          toast.error("Kon je concepten niet laden.");
          setDrafts([]);
        } else {
          setDrafts((draftRows as DraftRow[] | null) ?? []);
        }
      }

      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

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

    const medewerkerId = asBigIntId((medewerker as any)?.id);
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

  const formatDateTime = (iso: string | null) => {
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
  };

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
          <div className="mt-6 space-y-2">
            <p className="text-[13px] font-semibold text-[#5F7382]">
              Concepten ({drafts.length})
            </p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {drafts.map((d) => (
                <div
                  key={d.id}
                  className="rounded-2xl border border-black/[0.06] bg-white px-4 py-3 shadow-[0_2px_12px_rgba(39,153,215,0.06)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-[#163247]">
                        Concept
                      </p>
                      <p className="mt-1 text-[12px] leading-snug text-[#5F7382]">
                        Aangemaakt: {formatDateTime(d.created_at)}
                        <br />
                        Laatst bewerkt: {formatDateTime(d.updated_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-row items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 w-10 justify-center rounded-lg border-[#2799D7]/35 bg-white px-0 text-[#163247]"
                        onClick={() => router.push(`/ongeval/${d.id}`)}
                        aria-label="Open concept"
                      >
                        <FaRegEye className="size-4 text-[#2799D7]" aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        className="h-10 w-10 justify-center rounded-lg px-0"
                        onClick={() => setDeleteId(d.id)}
                        aria-label="Verwijder concept"
                      >
                        <Trash2 className="size-4" strokeWidth={1.75} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
