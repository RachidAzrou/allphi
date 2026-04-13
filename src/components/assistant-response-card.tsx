"use client";

import { Car, ClipboardList, FileText, CarFront, Zap, Lightbulb } from "lucide-react";
import type { ResponseCard, CardType } from "@/types/chat";

interface AssistantResponseCardProps {
  card: ResponseCard;
}

const iconMap: Record<CardType, React.ElementType> = {
  vehicle: Car,
  contract: ClipboardList,
  document: FileText,
  option: CarFront,
  charging: Zap,
  insight: Lightbulb,
};

const accentMap: Record<CardType, string> = {
  vehicle: "text-[#2799D7]",
  contract: "text-[#2799D7]",
  document: "text-[#2799D7]",
  option: "text-[#2799D7]",
  charging: "text-[#F59E0B]",
  insight: "text-[#16A34A]",
};

export function AssistantResponseCard({ card }: AssistantResponseCardProps) {
  const Icon = iconMap[card.type] ?? Lightbulb;
  const accent = accentMap[card.type] ?? "text-[#2799D7]";

  return (
    <div className="min-w-0 overflow-hidden rounded-[8px] border border-[#00000014] bg-white shadow-[0_1px_0.5px_rgba(11,20,26,0.1)]">
      <div className="border-b border-[#0000000d] bg-[#E8F4FB] px-3 py-2.5 sm:px-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className={`h-4 w-4 shrink-0 ${accent}`} />
          <span className="min-w-0 break-words text-[15px] font-semibold tracking-tight text-[#163247]">
            {card.title}
          </span>
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-3.5">
        {card.fields.map((field, i) => {
          if (field.label === "Link" && field.value.startsWith("http")) {
            return (
              <div
                key={i}
                className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <span className="text-sm text-[#5F7382]">{field.label}</span>
                <a
                  href={field.value}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-[44px] min-w-0 items-center text-sm font-medium text-[#2799D7] touch-manipulation hover:underline sm:min-h-0 sm:max-w-[60%] sm:justify-end sm:py-0 sm:text-right"
                >
                  Bekijken
                </a>
              </div>
            );
          }

          return (
            <div
              key={i}
              className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
            >
              <span className="text-sm text-[#5F7382] sm:max-w-[45%] sm:shrink-0">
                {field.label}
              </span>
              <span className="min-w-0 break-words text-sm font-medium text-[#163247] sm:text-right [overflow-wrap:anywhere]">
                {field.value}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
