"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { createInitialWagenBestelState } from "@/types/wagen-bestelling";
import { Button } from "@/components/ui/button";

type BestellingRow = {
  id: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "ordered" | "delivered";
  updated_at: string | null;
  payload: unknown;
};

export function WagenBestellenIndexClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const returnTo = searchParams.get("returnTo") || "/chat";

  const openBestelling = useCallback(
    (id: string) => {
      router.push(`/wagen-bestellen/${id}?returnTo=${encodeURIComponent(returnTo)}`);
    },
    [router, returnTo],
  );

  const createDraft = useCallback(async () => {
    setBusy(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.id) {
        router.replace("/login");
        return;
      }

      const payload = createInitialWagenBestelState();
      const { data, error } = await supabase
        .from("wagen_bestellingen")
        .insert({
          user_id: user.id,
          status: "draft",
          payload: payload as unknown as Record<string, unknown>,
        })
        .select("id")
        .single();

      if (error || !data?.id) {
        console.error(error);
        toast.error("Kon geen nieuw dossier aanmaken.");
        return;
      }

      openBestelling(data.id);
    } finally {
      setBusy(false);
    }
  }, [openBestelling, router, supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user?.id) {
          router.replace("/login");
          return;
        }

        // Continue most recent draft if it exists.
        const { data, error } = await supabase
          .from("wagen_bestellingen")
          .select("id, status, updated_at, payload")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(10);

        if (error) {
          console.error(error);
          toast.error("Kon je bestellingen niet laden.");
          return;
        }

        const rows = (data as BestellingRow[] | null) ?? [];
        const latestDraft = rows.find((r) => r.status === "draft");
        if (latestDraft?.id) {
          openBestelling(latestDraft.id);
          return;
        }

        if (!cancelled) setLoading(false);
      } catch (e) {
        console.error(e);
        toast.error("Er ging iets mis.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openBestelling, router, supabase]);

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      {loading ? (
        <LoadingState subtitle="Even laden…" />
      ) : (
        <main className="mx-auto w-full max-w-[46rem] px-4 pb-10 pt-5">
          <section className="space-y-2">
            <h1 className="font-heading text-[22px] font-semibold leading-tight text-foreground">
              Nieuwe wagen bestellen
            </h1>
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              We begeleiden je stap voor stap: context, modelkeuze, offerte upload, automatische
              controle, eventuele persoonlijke bijdrage en goedkeuring.
            </p>
          </section>

          <div className="mt-6 space-y-3">
            <Button
              type="button"
              onClick={() => void createDraft()}
              disabled={busy}
              className="h-12 w-full rounded-xl text-[15px] font-semibold"
            >
              Start nieuwe bestelling
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push(returnTo)}
              className="h-12 w-full rounded-xl text-[15px] font-semibold"
            >
              Terug naar chat
            </Button>
          </div>
        </main>
      )}
    </div>
  );
}

