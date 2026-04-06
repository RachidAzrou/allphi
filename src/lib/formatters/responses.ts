import type { IntentResult } from "@/types/chat";
import type {
  FleetAssistantContext,
  AllowedVehicleOption,
  ChargingSummary,
  ChargingHomeVsPublic,
} from "@/types/database";

export function formatVehicleResponse(
  context: FleetAssistantContext | null
): IntentResult {
  if (!context || !context.merk) {
    return {
      intent: "my_vehicle",
      message:
        "Ik kon geen voertuiggegevens vinden die aan jouw profiel zijn gekoppeld. Neem contact op met je fleet manager voor meer informatie.",
    };
  }

  const lines = [
    `Je rijdt momenteel met een **${context.merk} ${context.model}**.`,
  ];

  if (context.nummerplaat) {
    lines.push(`Nummerplaat: **${context.nummerplaat}**`);
  }
  if (context.range_km) {
    lines.push(`Range: **${context.range_km} km**`);
  }
  if (context.aandrijving) {
    lines.push(`Aandrijving: **${context.aandrijving}**`);
  }
  if (context.brandstoftype) {
    lines.push(`Brandstof: **${context.brandstoftype}**`);
  }
  if (context.kleur) {
    lines.push(`Kleur: **${context.kleur}**`);
  }

  return {
    intent: "my_vehicle",
    message: lines.join("\n"),
    cards: [
      {
        type: "vehicle_info",
        data: {
          merk: context.merk,
          model: context.model,
          nummerplaat: context.nummerplaat,
          range_km: context.range_km,
          aandrijving: context.aandrijving,
          brandstoftype: context.brandstoftype,
          kleur: context.kleur,
          bouwjaar: context.bouwjaar,
        },
      },
    ],
  };
}

export function formatContractResponse(
  context: FleetAssistantContext | null
): IntentResult {
  if (!context || !context.contract_id) {
    return {
      intent: "my_contract",
      message:
        "Ik kon geen contractgegevens vinden voor jouw profiel. Neem contact op met je fleet manager.",
    };
  }

  const lines = [];
  if (context.contract_type) {
    lines.push(`Contracttype: **${context.contract_type}**`);
  }
  if (context.contract_status) {
    lines.push(`Status: **${context.contract_status}**`);
  }
  if (context.goedkeuringsstatus) {
    lines.push(`Goedkeuring: **${context.goedkeuringsstatus}**`);
  }
  if (context.contract_startdatum) {
    lines.push(
      `Startdatum: **${formatDate(context.contract_startdatum)}**`
    );
  }
  if (context.contract_einddatum) {
    lines.push(
      `Einddatum: **${formatDate(context.contract_einddatum)}**`
    );
  }
  if (context.maandelijks_budget) {
    lines.push(
      `Maandelijks budget: **€${context.maandelijks_budget.toFixed(2)}**`
    );
  }

  return {
    intent: "my_contract",
    message:
      lines.length > 0
        ? `Hier zijn je contractgegevens:\n${lines.join("\n")}`
        : "Je contract is gevonden, maar er zijn nog geen details beschikbaar.",
    cards: [
      {
        type: "contract_info",
        data: {
          contract_type: context.contract_type,
          contract_status: context.contract_status,
          goedkeuringsstatus: context.goedkeuringsstatus,
          startdatum: context.contract_startdatum,
          einddatum: context.contract_einddatum,
          budget: context.maandelijks_budget,
        },
      },
    ],
  };
}

export function formatDocumentsResponse(
  context: FleetAssistantContext | null
): IntentResult {
  if (
    !context ||
    !context.documenten ||
    context.documenten.length === 0
  ) {
    return {
      intent: "my_documents",
      message:
        "Er zijn momenteel geen documenten beschikbaar voor jouw profiel.",
    };
  }

  const docs = context.documenten;
  const lines = docs.map(
    (d) => `- **${d.document_type}** — ${d.bestandsnaam}`
  );

  return {
    intent: "my_documents",
    message: `Je beschikbare documenten:\n${lines.join("\n")}`,
    cards: [
      {
        type: "document_list",
        data: {
          documents: docs.map((d) => ({
            type: d.document_type,
            filename: d.bestandsnaam,
            date: d.upload_datum,
            url: d.url,
          })),
        },
      },
    ],
  };
}

export function formatAllowedOptionsResponse(
  options: AllowedVehicleOption[]
): IntentResult {
  if (!options || options.length === 0) {
    return {
      intent: "allowed_options",
      message:
        "Er zijn momenteel geen beschikbare voertuigopties gevonden voor jouw categorie.",
    };
  }

  const message = `Er zijn **${options.length} modellen** beschikbaar binnen jouw categorie. Hier is een overzicht:`;

  return {
    intent: "allowed_options",
    message,
    cards: [
      {
        type: "allowed_vehicles",
        data: {
          vehicles: options.map((v) => ({
            merk: v.merk,
            model: v.model,
            variant: v.variant,
            range_km: v.range_km,
            brandstoftype: v.brandstoftype,
            catalogusprijs: v.catalogusprijs,
            maandelijks_budget: v.maandelijks_budget,
          })),
        },
      },
    ],
  };
}

export function formatChargingSummaryResponse(
  summary: ChargingSummary | null
): IntentResult {
  if (!summary || summary.totaal_sessies === 0) {
    return {
      intent: "charging_summary",
      message:
        "Er zijn nog geen laadsessies gevonden voor jouw profiel.",
    };
  }

  const lines = [
    `Totaal aantal sessies: **${summary.totaal_sessies}**`,
    `Totaal geladen: **${summary.totaal_kwh} kWh**`,
    `Totale kosten: **€${summary.totale_kosten.toFixed(2)}**`,
    `Gemiddeld per sessie: **€${summary.gemiddelde_kosten_per_sessie.toFixed(2)}** / **${summary.gemiddelde_kwh_per_sessie} kWh**`,
  ];

  return {
    intent: "charging_summary",
    message: `Hier is een overzicht van je laadsessies:\n${lines.join("\n")}`,
    cards: [
      {
        type: "charging_summary",
        data: { ...summary },
      },
    ],
  };
}

export function formatChargingComparisonResponse(
  comparison: ChargingHomeVsPublic | null
): IntentResult {
  if (!comparison) {
    return {
      intent: "charging_home_vs_public",
      message:
        "Er zijn nog geen laadsessies gevonden om een vergelijking te maken.",
    };
  }

  const thuisMeer = comparison.thuis_sessies > comparison.publiek_sessies;

  const lines = [
    `**Thuis laden:**`,
    `${comparison.thuis_sessies} sessies — ${comparison.thuis_kwh} kWh — €${comparison.thuis_kosten.toFixed(2)}`,
    ``,
    `**Publiek laden:**`,
    `${comparison.publiek_sessies} sessies — ${comparison.publiek_kwh} kWh — €${comparison.publiek_kosten.toFixed(2)}`,
    ``,
    thuisMeer
      ? `Je laadt vaker **thuis** dan publiek.`
      : comparison.thuis_sessies === comparison.publiek_sessies
        ? `Je laadt even vaak thuis als publiek.`
        : `Je laadt vaker **publiek** dan thuis.`,
  ];

  return {
    intent: "charging_home_vs_public",
    message: lines.join("\n"),
    cards: [
      {
        type: "charging_comparison",
        data: { ...comparison },
      },
    ],
  };
}

export function formatBestRangeResponse(
  best: AllowedVehicleOption | null
): IntentResult {
  if (!best) {
    return {
      intent: "best_range_option",
      message:
        "Er zijn momenteel geen voertuigopties beschikbaar om te vergelijken.",
    };
  }

  const lines = [
    `De optie met de grootste range binnen jouw categorie is:`,
    `**${best.merk} ${best.model}**${best.variant ? ` (${best.variant})` : ""}`,
    `Range: **${best.range_km} km**`,
  ];

  if (best.maandelijks_budget) {
    lines.push(`Maandelijks budget: **€${best.maandelijks_budget.toFixed(2)}**`);
  }

  return {
    intent: "best_range_option",
    message: lines.join("\n"),
    cards: [
      {
        type: "vehicle_info",
        data: {
          merk: best.merk,
          model: best.model,
          range_km: best.range_km,
          brandstoftype: best.brandstoftype,
          maandelijks_budget: best.maandelijks_budget,
        },
      },
    ],
  };
}

export function formatGreetingResponse(
  voornaam?: string
): IntentResult {
  const name = voornaam ? `, ${voornaam}` : "";
  return {
    intent: "greeting",
    message: `Hallo${name}! Ik ben je Fleet Companion. Hoe kan ik je helpen?\n\nJe kunt me vragen stellen over je wagen, contract, documenten, laadkosten of beschikbare voertuigopties.`,
  };
}

export function formatUnknownResponse(): IntentResult {
  return {
    intent: "unknown",
    message:
      "Ik kan je daar nog niet goed mee helpen. Probeer bijvoorbeeld:\n\n- **Mijn wagen** — info over je huidige voertuig\n- **Mijn documenten** — bekijk je documenten\n- **Mijn laadkosten** — overzicht van je laadsessies\n- **Beschikbare wagens** — welke modellen je kunt kiezen\n- **Contractinfo** — details over je contract",
  };
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("nl-BE", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}
