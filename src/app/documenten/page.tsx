"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, FileText } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import type { FleetAssistantContext } from "@/types/database";
import { PiFolderUserBold } from "react-icons/pi";
import { IoDocumentAttachOutline } from "react-icons/io5";
import { SiEuropeanunion } from "react-icons/si";

type DocItem = {
  title: string;
  subtitle?: string;
  url: string;
};

export default function DocumentenPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [docs, setDocs] = useState<DocItem[]>([]);

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
            title: "Europees aanrijdingsformulier (PDF)",
            subtitle: "Leeg formulier om te downloaden en in te vullen",
            url: "/AANRIJDINGSFORMULIER.pdf",
          },
        ]);
        setLoading(false);
        return;
      }

      const fromFleet = ((data as FleetAssistantContext[]) ?? [])
        .filter((r) => typeof r.document_type === "string" && r.document_type.trim())
        .map((r) => ({
          title: String(r.document_type),
          subtitle: r.merk_model ? String(r.merk_model) : undefined,
          url: String(r.document_url ?? ""),
        }))
        .filter((d) => d.url.trim().length > 0);

      setDocs([
        {
          title: "Europees aanrijdingsformulier (PDF)",
          subtitle: "Leeg formulier om te downloaden en in te vullen",
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
    <div className="flex min-h-[100dvh] flex-col bg-[#F7F9FC]">
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />

      {loading ? (
        <LoadingState context="documenten" />
      ) : (
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 md:px-6 lg:px-8">
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F4FB] text-[#2799D7]"
                aria-hidden
              >
                <PiFolderUserBold className="size-5" aria-hidden />
              </span>
              <h2 className="font-heading text-xl font-semibold text-[#163247]">
                Mijn documenten
              </h2>
            </div>
            <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-[#5F7382]">
              Hier vind je al je autopapieren en documenten terug.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-4 lg:grid-cols-3">
            {docs.map((d) => (
              <a
                key={`${d.title}-${d.url}`}
                href={d.url}
                target={d.url.startsWith("/") ? "_self" : "_blank"}
                rel={d.url.startsWith("/") ? undefined : "noopener noreferrer"}
                className="flex items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(39,153,215,0.06)] transition-colors hover:bg-[#F7F9FC]"
              >
                <div
                  className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8F4FB]/90 text-[#2799D7] ring-1 ring-[#2799D7]/10"
                  aria-hidden
                >
                  {d.url === "/AANRIJDINGSFORMULIER.pdf" ? (
                    <span className="relative flex items-center justify-center">
                      <SiEuropeanunion className="size-6 opacity-35" aria-hidden />
                      <span className="absolute inset-0 flex items-center justify-center font-heading text-[10px] font-extrabold tracking-wide text-[#2799D7]">
                        EU
                      </span>
                    </span>
                  ) : d.title.toLowerCase().includes("offerte") ? (
                    <IoDocumentAttachOutline className="size-6" aria-hidden />
                  ) : (
                    <FileText className="size-6" strokeWidth={1.75} />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-heading text-[15px] font-semibold text-[#163247]">
                    {d.title}
                  </p>
                  {d.subtitle ? (
                    <p className="mt-0.5 text-[13px] leading-snug text-[#5F7382]">
                      {d.subtitle}
                    </p>
                  ) : null}
                </div>
                <ExternalLink
                  className="mt-1 size-4 shrink-0 text-[#2799D7]/50"
                  strokeWidth={2}
                  aria-hidden
                />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

