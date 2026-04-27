"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { OngevalWizard } from "@/components/ongeval/ongeval-wizard";

type AccidentWizardChatModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId: string | null;
  payload: unknown | null;
  loading: boolean;
};

/**
 * Volscherm-achtig venster boven de chat (mobiel: sheet naar boven, desktop: kaart).
 */
export function AccidentWizardChatModal({
  open,
  onOpenChange,
  reportId,
  payload,
  loading,
}: AccidentWizardChatModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Ongeval melden"
    >
      <button
        type="button"
        className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px] transition-opacity"
        aria-label="Sluiten"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={[
          "relative flex max-h-[min(92dvh,820px)] w-full min-h-0 flex-col overflow-hidden",
          "rounded-t-[22px] bg-background shadow-[0_-12px_48px_rgba(24,28,32,0.12)] ring-1 ring-border/80",
          "sm:max-h-[min(88dvh,880px)] sm:max-w-[min(100vw,44rem)] sm:rounded-2xl",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="app-surface absolute right-3 top-3 z-50 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground shadow-sm ring-1 ring-border/70 transition-colors hover:bg-card active:bg-card"
          aria-label="Venster sluiten"
        >
          <X className="size-5" strokeWidth={1.75} />
        </button>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading || !reportId || payload === null ? (
            <div className="flex min-h-[240px] flex-1 items-center justify-center px-4 text-[15px] text-muted-foreground">
              Bezig met laden…
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <OngevalWizard
                reportId={reportId}
                initialPayload={payload}
                embedded
                onRequestClose={() => onOpenChange(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
