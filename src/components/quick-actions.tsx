"use client";

import { motion } from "framer-motion";
import {
  Car,
  FileText,
  Zap,
  CarFront,
  ClipboardList,
  ClipboardCheck,
} from "lucide-react";

interface QuickActionsProps {
  onAction: (message: string) => void;
}

const actions = [
  { label: "Mijn wagen", message: "Welke wagen heb ik?", icon: Car },
  { label: "Mijn documenten", message: "Wat zijn mijn documenten?", icon: FileText },
  { label: "Mijn laadkosten", message: "Hoeveel heb ik geladen?", icon: Zap },
  { label: "Beschikbare wagens", message: "Welke wagens mag ik kiezen?", icon: CarFront },
  { label: "Contractinfo", message: "Wat is mijn contract?", icon: ClipboardList },
  {
    label: "Leasewagen inleveren",
    message: "Ik wil mijn leasewagen inleveren",
    icon: ClipboardCheck,
  },
];

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="px-4 pb-4"
    >
      <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Snel starten
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => onAction(action.message)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground shadow-sm
                         transition-colors hover:bg-muted/60 active:scale-[0.98]"
            >
              <Icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
