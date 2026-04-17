"use client";

import { useMemo } from "react";
import { FilePlus2, FileText, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AccidentReportState } from "@/types/ongeval";

export type DraftRow = {
  id: string;
  payload: unknown;
  updated_at: string;
};

type DraftChoiceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  drafts: DraftRow[];
  onContinue: (id: string) => void;
  onStartNew: () => void;
  onDelete?: (id: string) => void;
};

function formatRelative(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.round(diffMs / 60_000);
  if (minutes < 1) return "Net bijgewerkt";
  if (minutes < 60) return `${minutes} min geleden`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} u geleden`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} dagen geleden`;
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
    .format(date)
    .replace(/\.$/, "");
}

function buildSummary(payload: unknown): { title: string; subtitle: string } {
  if (!payload || typeof payload !== "object") {
    return { title: "Concept zonder gegevens", subtitle: "Nog niets ingevuld" };
  }
  const p = payload as Partial<AccidentReportState>;

  const nm = p.partyA?.verzekeringsnemer?.naam?.trim();
  const vnm = p.partyA?.verzekeringsnemer?.voornaam?.trim();
  const holder = [vnm, nm].filter(Boolean).join(" ");
  const plate = p.partyA?.voertuig?.nummerplaat?.trim();

  const locParts = [
    p.location?.straat?.trim(),
    p.location?.huisnummer?.trim(),
  ]
    .filter(Boolean)
    .join(" ");
  const city = p.location?.stad?.trim();
  const datum = p.location?.datum?.trim();

  const title =
    [locParts, city].filter(Boolean).join(", ") ||
    holder ||
    plate ||
    "Concept zonder locatie";

  const subtitleParts: string[] = [];
  if (holder && title !== holder) subtitleParts.push(holder);
  if (plate && title !== plate) subtitleParts.push(plate);
  if (datum) subtitleParts.push(datum);

  return {
    title,
    subtitle: subtitleParts.join(" • ") || "Nog niet volledig ingevuld",
  };
}

export function DraftChoiceDialog({
  open,
  onOpenChange,
  drafts,
  onContinue,
  onStartNew,
  onDelete,
}: DraftChoiceDialogProps) {
  const items = useMemo(
    () =>
      drafts.map((d) => ({
        id: d.id,
        updated: formatRelative(d.updated_at),
        ...buildSummary(d.payload),
      })),
    [drafts],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Concept of nieuwe aangifte?</DialogTitle>
          <DialogDescription>
            Je hebt {drafts.length === 1 ? "één openstaand concept" : `${drafts.length} openstaande concepten`}.
            Kies of je er één wil afmaken of een nieuwe aangifte wil starten.
          </DialogDescription>
        </DialogHeader>

        <ul className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center gap-2 rounded-xl border border-black/[0.06] bg-white p-3 shadow-[0_1px_0.5px_rgba(11,20,26,0.08)] transition-colors hover:border-[#2799D7]/40"
            >
              <button
                type="button"
                onClick={() => onContinue(item.id)}
                className="flex flex-1 items-start gap-3 text-left"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#E8F4FB] text-[#2799D7]">
                  <FileText className="size-4" strokeWidth={2} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[#163247]">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[12px] text-[#5F7382]">
                    {item.subtitle}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-[#8696A0]">
                    {item.updated}
                  </span>
                </span>
              </button>
              {onDelete ? (
                <button
                  type="button"
                  onClick={() => onDelete(item.id)}
                  aria-label="Concept verwijderen"
                  className="shrink-0 rounded-lg p-1.5 text-[#8696A0] transition-colors hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="size-4" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onStartNew}
          className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center gap-2 rounded-xl bg-[#2799D7] px-4 py-2.5 text-center text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#1e7bb0] active:bg-[#1a6a9a]"
        >
          <FilePlus2 className="size-4" strokeWidth={2} aria-hidden />
          Nieuwe aangifte starten
        </button>
      </DialogContent>
    </Dialog>
  );
}
