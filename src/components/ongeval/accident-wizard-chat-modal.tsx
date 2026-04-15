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
        className="absolute inset-0 bg-[#0B1420]/50 backdrop-blur-[2px] transition-opacity"
        aria-label="Sluiten"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={[
          "relative flex max-h-[min(92dvh,820px)] w-full min-h-0 flex-col overflow-hidden",
          "rounded-t-[22px] bg-[#F7F9FC] shadow-[0_-12px_48px_rgba(39,153,215,0.14)] ring-1 ring-[#2799D7]/12",
          "sm:max-h-[min(88dvh,880px)] sm:max-w-[min(100vw,44rem)] sm:rounded-2xl",
        ].join(" ")}
      >
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="absolute right-3 top-3 z-50 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full bg-white/80 text-[#5F7382] shadow-sm ring-1 ring-black/[0.06] backdrop-blur-md transition-colors hover:bg-white active:bg-white"
          aria-label="Venster sluiten"
        >
          <X className="size-5" strokeWidth={1.75} />
        </button>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading || !reportId || payload === null ? (
            <div className="flex min-h-[240px] flex-1 items-center justify-center px-4 text-[15px] text-[#5F7382]">
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
