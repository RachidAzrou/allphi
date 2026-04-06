"use client";

import { ClipboardList, Calendar, Euro, CheckCircle2 } from "lucide-react";

interface ContractInfoCardProps {
  data: {
    contract_type?: string;
    contract_status?: string;
    goedkeuringsstatus?: string;
    startdatum?: string;
    einddatum?: string;
    budget?: number;
  };
}

export function ContractInfoCard({ data }: ContractInfoCardProps) {
  const statusColor = getStatusColor(data.goedkeuringsstatus);

  return (
    <div className="bg-white rounded-xl border border-[#DCE6EE] overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="bg-[#E8F4FB] px-4 py-3 border-b border-[#DCE6EE]">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-[#2799D7]" />
          <span className="text-sm font-heading font-semibold text-[#163247]">
            Contractgegevens
          </span>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {data.contract_type && (
          <InfoRow
            icon={<ClipboardList className="w-4 h-4" />}
            label="Type"
            value={data.contract_type}
          />
        )}
        {data.contract_status && (
          <InfoRow
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Status"
            value={data.contract_status}
          />
        )}
        {data.goedkeuringsstatus && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-[#5F7382]">Goedkeuring</span>
            <span
              className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor}`}
            >
              {data.goedkeuringsstatus}
            </span>
          </div>
        )}
        {data.startdatum && (
          <InfoRow
            icon={<Calendar className="w-4 h-4" />}
            label="Start"
            value={formatDate(data.startdatum)}
          />
        )}
        {data.einddatum && (
          <InfoRow
            icon={<Calendar className="w-4 h-4" />}
            label="Einde"
            value={formatDate(data.einddatum)}
          />
        )}
        {data.budget && (
          <InfoRow
            icon={<Euro className="w-4 h-4" />}
            label="Budget/mnd"
            value={`€${data.budget.toFixed(2)}`}
          />
        )}
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-[#5F7382]">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-[#163247]">{value}</span>
    </div>
  );
}

function getStatusColor(status?: string): string {
  if (!status) return "bg-gray-100 text-gray-600";
  const s = status.toLowerCase();
  if (s.includes("goedgekeurd") || s.includes("actief"))
    return "bg-green-50 text-green-700";
  if (s.includes("wacht") || s.includes("pending"))
    return "bg-amber-50 text-amber-700";
  if (s.includes("afgewezen") || s.includes("geweigerd"))
    return "bg-red-50 text-red-700";
  return "bg-blue-50 text-blue-700";
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("nl-BE", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
