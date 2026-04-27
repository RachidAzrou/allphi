"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

function isAllowedPreviewSrc(src: string): boolean {
  if (!src.startsWith("/api/")) return false;
  return (
    src === "/api/insurance/green-card" ||
    src === "/api/insurance/attest" ||
    src.startsWith("/api/vehicle-documents/")
  );
}

export function DocumentPreviewClient() {
  const router = useRouter();
  const search = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const src = (search.get("src") ?? "").trim();
  const title = (search.get("title") ?? "Document").trim();

  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
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
    })();
    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  useEffect(() => {
    if (!src || !isAllowedPreviewSrc(src)) {
      setErrorMessage("Ongeldige documentbron.");
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const res = await fetch(src, { method: "GET" });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          let detail = `HTTP ${res.status}`;
          try {
            const parsed = JSON.parse(text);
            detail = parsed?.detail || parsed?.error || detail;
          } catch {
            detail = text || detail;
          }
          throw new Error(detail);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setPdfUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setErrorMessage(msg);
        toast.error("Kon de preview niet laden.");
      } finally {
        setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, [src]);

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />

      <main className="app-page-shell app-page-shell-wide">
        <header className="touch-manipulation pt-1">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                {title || "Document"}
              </h1>
              <p className="mt-1 text-[13px] text-muted-foreground">Preview</p>
            </div>
          </div>
        </header>

        <section className="mt-6">
          <div className="relative min-h-[520px] overflow-hidden rounded-2xl border border-border bg-muted">
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">
                Laden…
              </div>
            ) : null}
            {errorMessage && !loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
                <p className="text-[14px] font-medium text-destructive">
                  Preview kon niet geladen worden
                </p>
                <p className="text-[12px] text-muted-foreground">{errorMessage}</p>
                <Button
                  type="button"
                  onClick={() => {
                    router.refresh();
                  }}
                  className="stitch-btn-primary h-10 rounded-lg text-[13px] font-semibold"
                >
                  Opnieuw proberen
                </Button>
              </div>
            ) : null}
            {pdfUrl ? (
              <iframe
                src={pdfUrl}
                className="h-[74vh] min-h-[520px] w-full"
                title={`${title || "Document"} preview`}
              />
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}

