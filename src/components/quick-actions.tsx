"use client";

import { motion } from "framer-motion";
import { Car, FileText, Zap, CarFront, ClipboardList } from "lucide-react";

interface QuickActionsProps {
  onAction: (message: string) => void;
}

const actions = [
  { label: "Mijn wagen", message: "Welke wagen heb ik?", icon: Car },
  { label: "Mijn documenten", message: "Wat zijn mijn documenten?", icon: FileText },
  { label: "Mijn laadkosten", message: "Hoeveel heb ik geladen?", icon: Zap },
  { label: "Beschikbare wagens", message: "Welke wagens mag ik kiezen?", icon: CarFront },
  { label: "Contractinfo", message: "Wat is mijn contract?", icon: ClipboardList },
];

export function QuickActions({ onAction }: QuickActionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.15 }}
      className="px-4 pb-4"
    >
      <p className="text-xs font-medium text-[#5F7382] mb-2.5 uppercase tracking-wider">
        Snel starten
      </p>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={() => onAction(action.message)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full
                         bg-white border border-[#DCE6EE] text-sm text-[#163247]
                         hover:border-[#2799D7] hover:text-[#2799D7] hover:bg-[#E8F4FB]
                         active:scale-[0.97] transition-all duration-150
                         shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
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
