"use client";

import { motion } from "framer-motion";
import {
  Bot as LuBot,
  Car,
  FileText,
  Zap,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";

interface WelcomeCardProps {
  voornaam?: string;
  onAction: (message: string) => void;
}

const actions = [
  { label: "Mijn wagen", message: "Wat is mijn wagen?", icon: Car },
  { label: "Mijn documenten", message: "Wat zijn mijn documenten?", icon: FileText },
  { label: "Mijn laadkosten", message: "Hoeveel heb ik geladen?", icon: Zap },
  { label: "Contractinfo", message: "Wat is mijn contract?", icon: ClipboardList },
  { label: "Bandenwissel", message: "Ik wil een bandenwissel doen", icon: Car },
  {
    label: "Leasewagen inleveren",
    message: "Ik wil mijn leasewagen inleveren",
    icon: ClipboardCheck,
  },
];

export function WelcomeCard({ voornaam, onAction }: WelcomeCardProps) {
  const greeting = voornaam ? `Hallo ${voornaam}!` : "Welkom!";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full px-safe pt-5 pb-2"
    >
      <div className="flex items-start gap-3">
        <div className="stitch-gradient-fill mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/25">
          <LuBot className="h-5 w-5 text-primary-foreground" strokeWidth={1.75} aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <p className="font-heading text-lg font-semibold leading-snug tracking-tight text-foreground">
              {greeting}
            </p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
              Waar kan ik je mee helpen? Kies een onderwerp of typ je vraag hieronder.
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
                  className="flex min-h-14 touch-manipulation flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-2 py-3 text-center shadow-sm transition-colors hover:bg-muted/50 active:bg-muted/70"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary"
                    aria-hidden
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="w-full px-0.5 text-center text-[12px] font-medium leading-tight text-foreground">
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
