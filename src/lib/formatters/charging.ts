import type { ChatResponse } from "@/types/chat";
import type {
  ChargingSummary,
  ChargingLocationBreakdown,
  ReimbursementStatus,
} from "@/types/database";
import { eur } from "./utils";

export function formatChargingSummaryResponse(
  summary: ChargingSummary | null
): ChatResponse {
  if (!summary || summary.aantal_sessies === 0) {
    return {
      intent: "charging_summary",
      title: "Laadoverzicht",
      message: "Er zijn nog geen laadsessies gevonden voor jouw profiel.",
      suggestions: ["Mijn wagen", "Beschikbare wagens"],
    };
  }

  const lines = [
    `Hier is een overzicht van je laadsessies:`,
    `Je had **${summary.aantal_sessies}** laadsessies.`,
    `In totaal laadde je **${summary.totaal_kwh} kWh**.`,
    `De totale kost bedraagt **${eur(summary.totaal_kost)}**.`,
    `Gemiddeld kost een sessie **${eur(summary.gemiddelde_kost_per_sessie)}**.`,
  ];

  return {
    intent: "charging_summary",
    title: "Laadoverzicht",
    message: lines.join("\n"),
    cards: [
      {
        type: "charging",
        title: "Laadoverzicht",
        fields: [
          { label: "Aantal sessies", value: String(summary.aantal_sessies) },
          { label: "Totaal geladen", value: `${summary.totaal_kwh} kWh` },
          { label: "Totale kosten", value: eur(summary.totaal_kost) },
          { label: "Gem. per sessie", value: eur(summary.gemiddelde_kost_per_sessie) },
        ],
      },
    ],
    suggestions: ["Thuis of publiek", "Terugbetaling", "Mijn wagen"],
  };
}

export function formatChargingComparisonResponse(
  breakdowns: ChargingLocationBreakdown[]
): ChatResponse {
  if (!breakdowns || breakdowns.length === 0) {
    return {
      intent: "charging_home_vs_public",
      title: "Thuis vs. Publiek",
      message: "Er zijn nog geen laadsessies gevonden om een vergelijking te maken.",
      suggestions: ["Mijn laadkosten", "Mijn wagen"],
    };
  }

  const thuis = breakdowns.find((b) => b.locatie_type === "thuis");
  const publiek = breakdowns.find((b) => b.locatie_type === "publiek");

  const lines: string[] = [];

  if (thuis) {
    lines.push(`**Thuis laden:** ${thuis.aantal_sessies} sessies — ${thuis.totaal_kwh} kWh — ${eur(thuis.totaal_kost)}`);
  } else {
    lines.push(`**Thuis laden:** geen sessies gevonden.`);
  }

  if (publiek) {
    lines.push(`**Publiek laden:** ${publiek.aantal_sessies} sessies — ${publiek.totaal_kwh} kWh — ${eur(publiek.totaal_kost)}`);
  } else {
    lines.push(`**Publiek laden:** geen sessies gevonden.`);
  }

  const thuisCount = thuis?.aantal_sessies ?? 0;
  const publiekCount = publiek?.aantal_sessies ?? 0;

  if (thuisCount > 0 || publiekCount > 0) {
    if (thuisCount > publiekCount) {
      lines.push(`\nJe laadt momenteel vooral **thuis**.`);
    } else if (publiekCount > thuisCount) {
      lines.push(`\nJe gebruikt vaker **publieke laadpunten**.`);
    } else {
      lines.push(`\nJe laadt even vaak thuis als publiek.`);
    }
  }

  const fields: { label: string; value: string }[] = [];
  if (thuis) {
    fields.push(
      { label: "Thuis — sessies", value: String(thuis.aantal_sessies) },
      { label: "Thuis — kWh", value: `${thuis.totaal_kwh} kWh` },
      { label: "Thuis — kosten", value: eur(thuis.totaal_kost) }
    );
  }
  if (publiek) {
    fields.push(
      { label: "Publiek — sessies", value: String(publiek.aantal_sessies) },
      { label: "Publiek — kWh", value: `${publiek.totaal_kwh} kWh` },
      { label: "Publiek — kosten", value: eur(publiek.totaal_kost) }
    );
  }

  return {
    intent: "charging_home_vs_public",
    title: "Thuis vs. Publiek",
    message: lines.join("\n"),
    cards: [{ type: "charging", title: "Thuis vs. Publiek", fields }],
    suggestions: ["Mijn laadkosten", "Terugbetaling", "Mijn wagen"],
  };
}

export function formatReimbursementResponse(
  status: ReimbursementStatus | null
): ChatResponse {
  if (!status) {
    return {
      intent: "reimbursement_status",
      title: "Terugbetaling",
      message: "Er zijn geen laadsessies gevonden voor jouw profiel.",
      suggestions: ["Mijn laadkosten", "Mijn wagen"],
    };
  }

  const lines: string[] = [];

  if (status.aantal_open > 0) {
    lines.push(
      `Je hebt **${status.aantal_open}** ${status.aantal_open === 1 ? "sessie" : "sessies"} die nog niet terugbetaald ${status.aantal_open === 1 ? "is" : "zijn"}.`
    );
    lines.push(`Het openstaande bedrag is **${eur(status.open_bedrag)}**.`);
  } else {
    lines.push(`Al je laadsessies zijn terugbetaald.`);
  }

  if (status.aantal_betaald > 0) {
    lines.push(
      `Daarnaast ${status.aantal_betaald === 1 ? "is" : "zijn"} **${status.aantal_betaald}** ${status.aantal_betaald === 1 ? "sessie" : "sessies"} al verwerkt (${eur(status.betaald_bedrag)}).`
    );
  }

  return {
    intent: "reimbursement_status",
    title: "Terugbetaling",
    message: lines.join("\n"),
    cards: [
      {
        type: "charging",
        title: "Terugbetaalstatus",
        fields: [
          { label: "Open sessies", value: String(status.aantal_open) },
          { label: "Openstaand bedrag", value: eur(status.open_bedrag) },
          { label: "Verwerkte sessies", value: String(status.aantal_betaald) },
          { label: "Terugbetaald", value: eur(status.betaald_bedrag) },
        ],
      },
    ],
    suggestions: ["Mijn laadkosten", "Thuis of publiek", "Mijn wagen"],
  };
}
