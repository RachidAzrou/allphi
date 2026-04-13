import type { ChatResponse } from "@/types/chat";
import type { AllowedVehicleOption } from "@/types/database";
import { eur } from "./utils";

export function formatAllowedOptionsResponse(
  options: AllowedVehicleOption[]
): ChatResponse {
  if (!options || options.length === 0) {
    return {
      intent: "allowed_options",
      title: "Beschikbare wagens",
      message:
        "Er zijn momenteel geen beschikbare voertuigopties gevonden voor jouw categorie.",
      suggestions: ["Mijn wagen", "Mijn contract"],
    };
  }

  const message = `Dit zijn de **${options.length} modellen** die binnen jouw categorie vallen:`;

  const cards = options.map((v) => ({
    type: "option" as const,
    title: v.merk_model,
    fields: [
      { label: "Merk / Model", value: v.merk_model },
      v.range_km ? { label: "Range", value: `${v.range_km} km` } : null,
      v.aandrijving ? { label: "Aandrijving", value: v.aandrijving } : null,
      v.optiebudget_voor_medewerker != null
        ? { label: "Optiebudget", value: eur(v.optiebudget_voor_medewerker) }
        : null,
    ].filter(Boolean) as { label: string; value: string }[],
  }));

  return {
    intent: "allowed_options",
    title: "Beschikbare wagens",
    message,
    cards,
    suggestions: ["Grootste range", "Mijn contract", "Mijn wagen"],
  };
}

export function formatBestRangeResponse(
  best: AllowedVehicleOption | null
): ChatResponse {
  if (!best) {
    return {
      intent: "best_range_option",
      title: "Beste range",
      message:
        "Er zijn momenteel geen voertuigopties beschikbaar om te vergelijken.",
      suggestions: ["Beschikbare wagens", "Mijn wagen"],
    };
  }

  const lines = [
    `De beschikbare wagen met de grootste range is **${best.merk_model}**.`,
    `Deze heeft een range van **${best.range_km ?? "onbekend"} km**.`,
  ];

  if (best.optiebudget_voor_medewerker != null) {
    lines.push(`Het optiebudget voor jouw categorie is **${eur(best.optiebudget_voor_medewerker)}**.`);
  }

  const fields = [
    { label: "Merk / Model", value: best.merk_model },
    best.range_km ? { label: "Range", value: `${best.range_km} km` } : null,
    best.aandrijving ? { label: "Aandrijving", value: best.aandrijving } : null,
    best.optiebudget_voor_medewerker != null
      ? { label: "Optiebudget", value: eur(best.optiebudget_voor_medewerker) }
      : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return {
    intent: "best_range_option",
    title: "Beste range optie",
    message: lines.join("\n"),
    cards: [{ type: "vehicle", title: best.merk_model, fields }],
    suggestions: ["Beschikbare wagens", "Mijn wagen"],
  };
}
