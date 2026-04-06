"use client";

import type { ResponseCard } from "@/types/chat";
import { VehicleInfoCard } from "./vehicle-info-card";
import { ContractInfoCard } from "./contract-info-card";
import { DocumentListCard } from "./document-list-card";
import { AllowedVehicleOptionsCard } from "./allowed-vehicle-options-card";
import { ChargingSummaryCard } from "./charging-summary-card";
import { ChargingComparisonCard } from "./charging-comparison-card";

interface AssistantResponseCardProps {
  card: ResponseCard;
}

export function AssistantResponseCard({ card }: AssistantResponseCardProps) {
  switch (card.type) {
    case "vehicle_info":
      return <VehicleInfoCard data={card.data as VehicleInfoCard["data"]} />;
    case "contract_info":
      return <ContractInfoCard data={card.data as ContractInfoCard["data"]} />;
    case "document_list":
      return <DocumentListCard data={card.data as DocumentListCard["data"]} />;
    case "allowed_vehicles":
      return (
        <AllowedVehicleOptionsCard
          data={card.data as AllowedVehicleOptionsCard["data"]}
        />
      );
    case "charging_summary":
      return (
        <ChargingSummaryCard
          data={card.data as ChargingSummaryCard["data"]}
        />
      );
    case "charging_comparison":
      return (
        <ChargingComparisonCard
          data={card.data as ChargingComparisonCard["data"]}
        />
      );
    default:
      return null;
  }
}

type VehicleInfoCard = { data: { merk?: string; model?: string; nummerplaat?: string; range_km?: number; aandrijving?: string; brandstoftype?: string; kleur?: string; bouwjaar?: number; maandelijks_budget?: number } };
type ContractInfoCard = { data: { contract_type?: string; contract_status?: string; goedkeuringsstatus?: string; startdatum?: string; einddatum?: string; budget?: number } };
type DocumentListCard = { data: { documents: { type: string; filename: string; date?: string; url?: string }[] } };
type AllowedVehicleOptionsCard = { data: { vehicles: { merk: string; model: string; variant?: string; range_km?: number; brandstoftype?: string; catalogusprijs?: number; maandelijks_budget?: number }[] } };
type ChargingSummaryCard = { data: { totaal_sessies: number; totaal_kwh: number; totale_kosten: number; gemiddelde_kosten_per_sessie: number; gemiddelde_kwh_per_sessie: number } };
type ChargingComparisonCard = { data: { thuis_sessies: number; thuis_kwh: number; thuis_kosten: number; publiek_sessies: number; publiek_kwh: number; publiek_kosten: number } };
