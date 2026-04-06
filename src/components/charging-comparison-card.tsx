"use client";

import { Home, MapPin, Zap } from "lucide-react";

interface ChargingComparisonCardProps {
  data: {
    thuis_sessies: number;
    thuis_kwh: number;
    thuis_kosten: number;
    publiek_sessies: number;
    publiek_kwh: number;
    publiek_kosten: number;
  };
}

export function ChargingComparisonCard({ data }: ChargingComparisonCardProps) {
  const totaal = data.thuis_sessies + data.publiek_sessies;
  const thuisPerc = totaal > 0 ? Math.round((data.thuis_sessies / totaal) * 100) : 0;
  const publiekPerc = 100 - thuisPerc;

  return (
    <div className="bg-white rounded-xl border border-[#DCE6EE] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="bg-[#E8F4FB] px-4 py-3 border-b border-[#DCE6EE]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-[#2799D7]" />
          <span className="text-sm font-heading font-semibold text-[#163247]">
            Thuis vs. Publiek
          </span>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-[#5F7382]">
            <span>Thuis {thuisPerc}%</span>
            <span>Publiek {publiekPerc}%</span>
          </div>
          <div className="h-2.5 bg-[#F0F4F8] rounded-full overflow-hidden flex">
            <div
              className="bg-[#2799D7] rounded-full transition-all duration-500"
              style={{ width: `${thuisPerc}%` }}
            />
            <div
              className="bg-[#F59E0B] rounded-full transition-all duration-500"
              style={{ width: `${publiekPerc}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Thuis */}
          <div className="space-y-2 p-3 rounded-lg bg-[#F7F9FC]">
            <div className="flex items-center gap-1.5 text-[#2799D7]">
              <Home className="w-4 h-4" />
              <span className="text-xs font-medium">Thuis</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[#5F7382]">Sessies</span>
                <span className="font-medium text-[#163247]">{data.thuis_sessies}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F7382]">kWh</span>
                <span className="font-medium text-[#163247]">{data.thuis_kwh}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F7382]">Kosten</span>
                <span className="font-medium text-[#163247]">€{data.thuis_kosten.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Publiek */}
          <div className="space-y-2 p-3 rounded-lg bg-[#F7F9FC]">
            <div className="flex items-center gap-1.5 text-[#F59E0B]">
              <MapPin className="w-4 h-4" />
              <span className="text-xs font-medium">Publiek</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[#5F7382]">Sessies</span>
                <span className="font-medium text-[#163247]">{data.publiek_sessies}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F7382]">kWh</span>
                <span className="font-medium text-[#163247]">{data.publiek_kwh}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5F7382]">Kosten</span>
                <span className="font-medium text-[#163247]">€{data.publiek_kosten.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
