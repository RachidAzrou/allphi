"use client";

import { useMemo } from "react";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { TbFileText, TbNotebook } from "react-icons/tb";

type HubItem = {
  title: string;
  subtitle?: string;
  href: string;
  kind: "route" | "download";
  icon: "file" | "zap" | "inbox" | "kb";
};

const iosRowClass =
  "touch-manipulation flex items-center gap-3 border-b border-border/60 px-4 py-3.5 no-underline last:border-b-0 active:bg-muted/40 sm:px-4";

type FlowAsset = {
  title: string;
  href: string;
  group: "D" | "ND" | "ALGEMEEN";
};

function HubIcon({ icon }: { icon: HubItem["icon"] }) {
  if (icon === "kb") return <TbNotebook className="size-7 shrink-0 text-primary/70 sm:size-8" aria-hidden />;
  return <FileText className="size-7 shrink-0 text-primary/65 sm:size-8" aria-hidden />;
}

function fileTypeFromHref(href: string): "PDF" | "DOCX" | "LINK" {
  const h = href.toLowerCase();
  if (h.endsWith(".pdf")) return "PDF";
  if (h.endsWith(".docx")) return "DOCX";
  return "LINK";
}

function FlowBadge({ group, kind }: { group: FlowAsset["group"]; kind: "PDF" | "DOCX" | "LINK" }) {
  const label = group === "ALGEMEEN" ? kind : `${group} · ${kind}`;
  return (
    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
      {label}
    </span>
  );
}

export function FleetManagerDocumentsClient(props: {
  userEmail: string;
  userDisplayName: string;
}) {
  const documents = useMemo(() => {
    // Fleet manager hub: only show the two canonical documents.
    const out: FlowAsset[] = [
      { title: "Car Policy", href: "/Flows/Car-Policy%20(1).pdf", group: "ALGEMEEN" },
      { title: "Procedures Sharepoint update", href: "/Flows/Procedures%20Sharepoint%20update.pdf", group: "ALGEMEEN" },
    ];
    return out;
  }, []);

  const sections: Array<{ heading: string; items: HubItem[] }> = [
    {
      heading: "Acties",
      items: [
        {
          title: "Knowledge base (beheer)",
          subtitle: "Ingest documenten en test retrieval",
          href: "/admin/knowledge-base",
          kind: "route",
          icon: "kb",
        },
      ],
    },
  ];

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader
        userEmail={props.userEmail}
        userDisplayName={props.userDisplayName}
        showFleetManagerNav
      />

      <main className="app-page-shell app-page-shell-wide">
        <header className="touch-manipulation pt-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm"
                aria-hidden="true"
              >
                <TbFileText className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                Documenten & flows
              </h1>
            </div>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Snelkoppelingen voor fleet-documenten, downloads en procedures.
            </p>
          </div>
        </header>

        {sections.map((s) => (
          <section key={s.heading} className="mt-8 sm:mt-10" aria-label={s.heading}>
            <h2 className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
              {s.heading}
            </h2>
            <div className="app-ios-group">
              {s.items.map((item) => {
                const content = (
                  <>
                    <HubIcon icon={item.icon} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-semibold leading-snug">{item.title}</p>
                      {item.subtitle ? (
                        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                          {item.subtitle}
                        </p>
                      ) : null}
                    </div>
                    <ChevronRight
                      className="size-5 shrink-0 text-muted-foreground/45"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </>
                );

                if (item.kind === "download") {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={cn(iosRowClass, "text-foreground transition-colors hover:bg-muted/30")}
                    >
                      {content}
                    </a>
                  );
                }

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(iosRowClass, "text-foreground transition-colors hover:bg-muted/30")}
                  >
                    {content}
                  </Link>
                );
              })}
            </div>
          </section>
        ))}

        <section className="mt-8 sm:mt-10" aria-label="Documenten">
          <h2 className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
            Documenten
            <span className="ml-1.5 tabular-nums text-muted-foreground/80">({documents.length})</span>
          </h2>

          <div className="app-ios-group">
            <ul className="divide-y divide-border/60">
              {documents.map((f) => {
                const kind = fileTypeFromHref(f.href);
                return (
                  <li key={f.href}>
                    <a
                      href={f.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "flex w-full touch-manipulation items-start gap-3 px-4 py-3.5 text-left transition-colors",
                        "hover:bg-muted/30 active:bg-muted/40",
                        "sm:items-center",
                      )}
                    >
                      <FileText className="size-7 shrink-0 text-primary/65 sm:size-8" aria-hidden />
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[15px] font-semibold leading-snug">{f.title}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground sm:hidden">
                          <span>
                            {f.group === "ALGEMEEN" ? "Algemeen" : f.group === "D" ? "D (drivers)" : "ND"}
                          </span>
                          <span className="ml-auto flex items-center gap-2">
                            <FlowBadge group={f.group} kind={kind} />
                            <ChevronRight
                              className="size-4 shrink-0 text-muted-foreground/45"
                              strokeWidth={2}
                              aria-hidden
                            />
                          </span>
                        </div>
                      </div>

                      <div className="ml-auto hidden items-center gap-2 sm:flex">
                        <FlowBadge group={f.group} kind={kind} />
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground/45"
                          strokeWidth={2}
                          aria-hidden
                        />
                      </div>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}

