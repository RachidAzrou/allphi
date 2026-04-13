"use client";

import { motion } from "framer-motion";
import { Bot as LuBot, Car, FileText, Zap, ClipboardList } from "lucide-react";

interface WelcomeCardProps {
  voornaam?: string;
  onAction: (message: string) => void;
}

const actions = [
  { label: "Mijn wagen", message: "Wat is mijn wagen?", icon: Car },
  { label: "Mijn documenten", message: "Wat zijn mijn documenten?", icon: FileText },
  { label: "Mijn laadkosten", message: "Hoeveel heb ik geladen?", icon: Zap },
  { label: "Contractinfo", message: "Wat is mijn contract?", icon: ClipboardList },
];

export function WelcomeCard({ voornaam, onAction }: WelcomeCardProps) {
  const greeting = voornaam ? `Hallo ${voornaam}!` : "Welkom!";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full px-safe pt-4 pb-2"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2799D7] shadow-sm">
          <LuBot className="h-5 w-5 text-white" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="rounded-[8px] rounded-bl-[3px] bg-white px-3 py-2 shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">
            <p className="break-words text-[15px] leading-[1.45] text-[#163247] [overflow-wrap:anywhere]">
              <span className="font-semibold">{greeting}</span> Waar kan ik je
              mee helpen? Kies iets of stel je vraag hieronder.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => onAction(action.message)}
                  className="group flex w-full touch-manipulation flex-col items-center justify-center gap-2 rounded-xl border border-[#00000014] bg-white px-1.5 py-3 text-center shadow-[0_1px_0.5px_rgba(11,20,26,0.1)] transition-[transform,background-color,box-shadow] active:scale-[0.98] active:bg-[#E8F4FB] sm:py-3.5"
                >
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2799D7]/14 transition-colors group-active:bg-[#2799D7]/22 sm:h-11 sm:w-11"
                    aria-hidden
                  >
                    <Icon
                      className="h-6 w-6 text-[#2799D7] sm:h-7 sm:w-7"
                      strokeWidth={1.5}
                    />
                  </span>
                  <span className="w-full px-0.5 text-center text-[12px] font-semibold leading-tight tracking-tight text-[#2799D7] sm:text-[13px]">
                    {action.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
