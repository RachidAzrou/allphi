"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type InfoBannerProps = {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  className?: string;
};

export function InfoBanner({
  message,
  visible,
  onDismiss,
  className,
}: InfoBannerProps) {
  if (!visible) return null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b border-[#2799D7]/12 bg-[#E8F4FB]/90 px-3 py-2.5 text-[13px] leading-snug text-[#163247]",
        className,
      )}
    >
      <button
        type="button"
        onClick={onDismiss}
        className="mt-0.5 shrink-0 rounded p-0.5 text-[#5F7382] hover:bg-black/[0.06]"
        aria-label="Bericht sluiten"
      >
        <X className="size-4" strokeWidth={1.75} />
      </button>
      <p className="min-w-0 flex-1">{message}</p>
    </div>
  );
}
