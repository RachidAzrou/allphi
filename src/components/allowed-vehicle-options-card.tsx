"use client";

import { CarFront, Gauge, Euro } from "lucide-react";

interface VehicleOption {
  merk: string;
  model: string;
  variant?: string;
  range_km?: number;
  brandstoftype?: string;
  catalogusprijs?: number;
  maandelijks_budget?: number;
}

interface AllowedVehicleOptionsCardProps {
  data: {
    vehicles: VehicleOption[];
  };
}

export function AllowedVehicleOptionsCard({
  data,
}: AllowedVehicleOptionsCardProps) {
  const { vehicles } = data;

  if (!vehicles || vehicles.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-[#DCE6EE] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="bg-[#E8F4FB] px-4 py-3 border-b border-[#DCE6EE]">
        <div className="flex items-center gap-2">
          <CarFront className="w-4 h-4 text-[#2799D7]" />
          <span className="text-sm font-heading font-semibold text-[#163247]">
            Beschikbare modellen
          </span>
          <span className="text-xs text-[#5F7382] ml-auto">
            {vehicles.length} {vehicles.length === 1 ? "optie" : "opties"}
          </span>
        </div>
      </div>
      <div className="divide-y divide-[#DCE6EE]">
        {vehicles.map((v, i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-[#163247]">
                  {v.merk} {v.model}
                </p>
                {v.variant && (
                  <p className="text-xs text-[#5F7382] mt-0.5">{v.variant}</p>
                )}
              </div>
              {v.brandstoftype && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#E8F4FB] text-[#2799D7] shrink-0">
                  {v.brandstoftype}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {v.range_km && (
                <div className="flex items-center gap-1 text-xs text-[#5F7382]">
                  <Gauge className="w-3 h-3" />
                  {v.range_km} km
                </div>
              )}
              {v.maandelijks_budget && (
                <div className="flex items-center gap-1 text-xs text-[#5F7382]">
                  <Euro className="w-3 h-3" />
                  €{v.maandelijks_budget.toFixed(2)}/mnd
                </div>
              )}
              {v.catalogusprijs && (
                <div className="flex items-center gap-1 text-xs text-[#5F7382]">
                  <Euro className="w-3 h-3" />
                  €{v.catalogusprijs.toLocaleString("nl-BE")}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
