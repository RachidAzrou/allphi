"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import type { WagenBestelState } from "@/types/wagen-bestelling";
import { createInitialWagenBestelState } from "@/types/wagen-bestelling";
import { WagenBestelWizard } from "@/components/wagen-bestellen/wagen-bestel-wizard";

type BestellingRow = {
  id: string;
  status: "draft" | "submitted" | "approved" | "rejected" | "ordered" | "delivered";
  payload: unknown;
  offer_storage_path: string | null;
  contribution_doc_path: string | null;
  updated_at: string | null;
  fleet_approved_at: string | null;
  management_approved_at: string | null;
  approval_note: string | null;
};

function asState(payload: unknown): WagenBestelState {
  if (!payload || typeof payload !== "object") return createInitialWagenBestelState();
  return payload as WagenBestelState;
}

export function WagenBestellenWizardClient() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const id = params.id;
  const returnTo = searchParams.get("returnTo") || "/chat";

  const [loading, setLoading] = useState(true);
  const [row, setRow] = useState<BestellingRow | null>(null);
  const [state, setState] = useState<WagenBestelState>(createInitialWagenBestelState());

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from("wagen_bestellingen")
      .select(
        "id, status, payload, offer_storage_path, contribution_doc_path, updated_at, fleet_approved_at, management_approved_at, approval_note",
      )
      .eq("id", id)
      .single();

    if (error || !data) {
      console.error(error);
      toast.error("Kon je bestelling niet laden.");
      setRow(null);
      return;
    }

    const typed = data as BestellingRow;
    setRow(typed);
    setState(asState(typed.payload));
  }, [id, supabase]);

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
        await reload();
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, router, supabase]);

  const persist = useCallback(
    async (next: WagenBestelState) => {
      setState(next);
      const { error } = await supabase
        .from("wagen_bestellingen")
        .update({ payload: next as unknown as Record<string, unknown> })
        .eq("id", id);
      if (error) {
        console.error(error);
        toast.error("Kon je wijzigingen niet opslaan.");
      }
    },
    [id, supabase],
  );

  if (loading) {
    return (
      <div className="min-h-dvh bg-background">
        <AppHeader />
        <div className="mx-auto w-full max-w-[46rem] px-4 pb-10 pt-6">
          <p className="text-[14px] text-muted-foreground">Even laden…</p>
        </div>
      </div>
    );
  }

  if (!row) {
    return (
      <div className="min-h-dvh bg-background">
        <AppHeader />
        <main className="mx-auto w-full max-w-[46rem] px-4 pb-10 pt-6">
          <button
            type="button"
            className="text-[14px] font-semibold text-primary underline underline-offset-4"
            onClick={() => router.push(returnTo)}
          >
            Terug
          </button>
          <p className="mt-4 text-[14px] text-muted-foreground">
            We konden deze bestelling niet laden.
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader />
      <WagenBestelWizard
        bestellingId={row.id}
        status={row.status}
        state={state}
        onChange={persist}
        onRequestClose={() => router.push(returnTo)}
        onRefresh={() => void reload()}
      />
    </div>
  );
}

