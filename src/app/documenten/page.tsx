"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { cn } from "@/lib/utils";
import type { FleetAssistantContext } from "@/types/database";
import { PiFolderUserBold } from "react-icons/pi";
import { IoDocumentAttachOutline } from "react-icons/io5";
import { SiEuropeanunion } from "react-icons/si";
import { BsPostcard } from "react-icons/bs";
import { Input } from "@/components/ui/input";

type DocItem = {
  title: string;
  subtitle?: string;
  url: string;
};

const iosRowClass =
  "touch-manipulation flex items-center gap-3 border-b border-border/60 px-4 py-3.5 no-underline last:border-b-0 active:bg-muted/40 sm:px-4";

/** Verbergt “(PDF)” aan het einde van titels in de lijst (ook voor API-teksten). */
function displayDocTitle(title: string): string {
  return title.replace(/\s*\(PDF\)\s*$/i, "").trim();
}

function docKindFromUrl(url: string): "PDF" | "DOC" | "LINK" {
  const u = (url ?? "").toLowerCase();
  if (u.includes("/api/")) return "PDF";
  if (u.endsWith(".pdf")) return "PDF";
  if (u.endsWith(".doc") || u.endsWith(".docx")) return "DOC";
  return "LINK";
}

function DocKindBadge({ kind }: { kind: "PDF" | "DOC" | "LINK" }) {
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {kind}
    </span>
  );
}

function DocRowIcon({ doc }: { doc: DocItem }) {
  if (doc.url === "/AANRIJDINGSFORMULIER.pdf") {
    return (
      <span
        className="relative flex size-8 shrink-0 items-center justify-center sm:size-9"
        aria-hidden
      >
        <SiEuropeanunion
          className="size-7 text-primary/35 sm:size-8"
          aria-hidden
        />
        <span className="absolute inset-0 flex items-center justify-center font-heading text-[10px] font-extrabold tracking-wide text-primary sm:text-[11px]">
          EU
        </span>
      </span>
    );
  }
  if (
    doc.url === "/api/insurance/green-card" ||
    doc.title.toLowerCase().includes("groene kaart")
  ) {
    return (
      <BsPostcard
        className="size-7 shrink-0 text-primary/65 sm:size-8"
        aria-hidden
      />
    );
  }
  if (doc.title.toLowerCase().includes("offerte")) {
    return (
      <IoDocumentAttachOutline
        className="size-7 shrink-0 text-primary/70 sm:size-8"
        aria-hidden
      />
    );
  }
  return (
    <FileText
      className="size-7 shrink-0 text-primary/60 sm:size-8"
      strokeWidth={2}
      aria-hidden
    />
  );
}

export default function DocumentenPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [query, setQuery] = useState("");

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
        .from("v_fleet_assistant_context")
        .select("document_type, document_url, merk_model")
        .eq("emailadres", user.email)
        .not("document_type", "is", null);

      if (cancelled) return;
      if (error) {
        console.error(error);
        toast.error("Kon je documenten niet laden.");
        setDocs([
          {
            title: "Europees aanrijdingsformulier",
            url: "/AANRIJDINGSFORMULIER.pdf",
          },
        ]);
        setLoading(false);
        return;
      }

      const fromFleet = ((data as FleetAssistantContext[]) ?? [])
        .filter((r) => typeof r.document_type === "string" && r.document_type.trim())
        .map((r) => {
          const rawType = String(r.document_type ?? "").trim();
          const type = rawType.toUpperCase();

          if (type === "GROENE_KAART") {
            return {
              title: "Groene kaart",
              subtitle: r.merk_model ? String(r.merk_model) : undefined,
              url: "/documenten/preview?src=%2Fapi%2Finsurance%2Fgreen-card&title=Groene%20kaart",
            };
          }

          if (type === "VERZEKERINGSATTEST") {
            return {
              title: "Verzekeringsattest",
              subtitle: r.merk_model ? String(r.merk_model) : undefined,
              url: "/api/insurance/attest",
            };
          }

          if (type === "OFFERTE") {
            return {
              title: "Offerte",
              subtitle: r.merk_model ? String(r.merk_model) : undefined,
              url: "/documenten/preview?src=%2Fapi%2Fvehicle-documents%2FOFFERTE&title=Offerte",
            };
          }

          return {
            title: rawType,
            subtitle: r.merk_model ? String(r.merk_model) : undefined,
            url: String(r.document_url ?? ""),
          };
        })
        .filter((d) => d.url.trim().length > 0);

      setDocs([
        {
          title: "Europees aanrijdingsformulier",
          url: "/AANRIJDINGSFORMULIER.pdf",
        },
        ...fromFleet,
      ]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />

      {loading ? (
        <LoadingState context="documenten" />
      ) : (
        <main className="app-page-shell">
          <header className="touch-manipulation pt-1">
            <div className="flex items-start gap-3">
              <PiFolderUserBold
                className="mt-0.5 size-7 shrink-0 text-primary sm:size-8"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                  Mijn documenten
                </h1>
              </div>
            </div>
          </header>

          <section aria-labelledby="documenten-list-heading" className="mt-8 sm:mt-10">
            <h2
              id="documenten-list-heading"
              className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              Documenten
              <span className="ml-1.5 tabular-nums text-muted-foreground/80">
                ({docs.length})
              </span>
            </h2>

            <div className="mb-2 flex items-center gap-2 px-1">
              <div className="relative w-full sm:max-w-[420px]">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Zoek in documenten…"
                  className="pl-8"
                  aria-label="Zoek documenten"
                />
              </div>
            </div>

            <div className="app-ios-group">
              {(query.trim()
                ? docs.filter((d) => {
                    const q = query.trim().toLowerCase();
                    return `${d.title} ${d.subtitle ?? ""}`.toLowerCase().includes(q);
                  })
                : docs
              ).map((d) => (
                <a
                  key={`${d.title}-${d.url}`}
                  href={d.url}
                  target={d.url.startsWith("/") ? "_self" : "_blank"}
                  rel={d.url.startsWith("/") ? undefined : "noopener noreferrer"}
                  className={cn(
                    iosRowClass,
                    "text-foreground transition-colors hover:bg-muted/30",
                  )}
                >
                  <DocRowIcon doc={d} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[16px] font-semibold leading-snug">
                      {displayDocTitle(d.title)}
                    </p>
                    {d.subtitle ? (
                      <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        {d.subtitle}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <DocKindBadge kind={docKindFromUrl(d.url)} />
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground/45"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                </a>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

