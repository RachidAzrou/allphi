"use client";

import { Car, Gauge, Fuel, Palette } from "lucide-react";

interface VehicleInfoCardProps {
  data: {
    merk?: string;
    model?: string;
    nummerplaat?: string;
    range_km?: number;
    aandrijving?: string;
    brandstoftype?: string;
    kleur?: string;
    bouwjaar?: number;
    maandelijks_budget?: number;
  };
}

export function VehicleInfoCard({ data }: VehicleInfoCardProps) {
  return (
    <div className="bg-white rounded-xl border border-[#DCE6EE] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="bg-[#E8F4FB] px-4 py-3 border-b border-[#DCE6EE]">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-[#2799D7]" />
          <span className="text-sm font-heading font-semibold text-[#163247]">
            {data.merk} {data.model}
          </span>
        </div>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {data.nummerplaat && (
          <InfoItem label="Nummerplaat" value={data.nummerplaat} />
        )}
        {data.range_km && (
          <InfoItem
            label="Range"
            value={`${data.range_km} km`}
            icon={<Gauge className="w-3.5 h-3.5 text-[#5F7382]" />}
          />
        )}
        {data.aandrijving && (
          <InfoItem label="Aandrijving" value={data.aandrijving} />
        )}
        {data.brandstoftype && (
          <InfoItem
            label="Brandstof"
            value={data.brandstoftype}
            icon={<Fuel className="w-3.5 h-3.5 text-[#5F7382]" />}
          />
        )}
        {data.kleur && (
          <InfoItem
            label="Kleur"
            value={data.kleur}
            icon={<Palette className="w-3.5 h-3.5 text-[#5F7382]" />}
          />
        )}
        {data.bouwjaar && (
          <InfoItem label="Bouwjaar" value={String(data.bouwjaar)} />
        )}
        {data.maandelijks_budget && (
          <InfoItem
            label="Budget/mnd"
            value={`€${data.maandelijks_budget.toFixed(2)}`}
          />
        )}
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[11px] text-[#5F7382] uppercase tracking-wider font-medium flex items-center gap-1">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-[#163247]">{value}</span>
    </div>
  );
}
