"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { OngevalWizard } from "@/components/ongeval/ongeval-wizard";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";

type OngevalWizardLoaderProps = {
  reportId: string;
};

export function OngevalWizardLoader({ reportId }: OngevalWizardLoaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const [payload, setPayload] = useState<unknown>(null);
  const [error, setError] = useState<string | null>(null);

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
      const { data: row, error: qError } = await supabase
        .from("ongeval_aangiften")
        .select("payload, user_id")
        .eq("id", reportId)
        .maybeSingle();
      if (cancelled) return;
      if (qError || !row) {
        setError("Dossier niet gevonden.");
        return;
      }
      if (row.user_id !== user.id) {
        setError("Geen toegang tot dit dossier.");
        return;
      }
      setPayload(row.payload);
    })();
    return () => {
      cancelled = true;
    };
  }, [reportId, router, supabase]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center p-6">
        <ErrorState message={error} />
      </div>
    );
  }

  if (payload === null) {
    return (
      <div className="flex min-h-[100dvh] flex-col">
        <LoadingState context="ongeval" />
      </div>
    );
  }

  return <OngevalWizard reportId={reportId} initialPayload={payload} />;
}
