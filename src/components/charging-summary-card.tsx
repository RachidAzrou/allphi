"use client";

import { Zap, Hash, Euro, TrendingUp } from "lucide-react";

interface ChargingSummaryCardProps {
  data: {
    totaal_sessies: number;
    totaal_kwh: number;
    totale_kosten: number;
    gemiddelde_kosten_per_sessie: number;
    gemiddelde_kwh_per_sessie: number;
  };
}

export function ChargingSummaryCard({ data }: ChargingSummaryCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#DCE6EE] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="bg-[#E8F4FB] px-4 py-3 border-b border-[#DCE6EE]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#2799D7]" />
          <span className="text-sm font-heading font-semibold text-[#163247]">
            Laadoverzicht
          </span>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-4">
        <StatItem
          icon={<Hash className="w-4 h-4" />}
          label="Sessies"
          value={String(data.totaal_sessies)}
        />
        <StatItem
          icon={<Zap className="w-4 h-4" />}
          label="Totaal"
          value={`${data.totaal_kwh} kWh`}
        />
        <StatItem
          icon={<Euro className="w-4 h-4" />}
          label="Totale kosten"
          value={`€${data.totale_kosten.toFixed(2)}`}
        />
        <StatItem
          icon={<TrendingUp className="w-4 h-4" />}
          label="Gem./sessie"
          value={`€${data.gemiddelde_kosten_per_sessie.toFixed(2)}`}
        />
      </div>
    </div>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5 text-[#5F7382]">
        {icon}
        <span className="text-[11px] uppercase tracking-wider font-medium">
          {label}
        </span>
      </div>
      <span className="text-lg font-heading font-semibold text-[#163247]">
        {value}
      </span>
    </div>
  );
}
