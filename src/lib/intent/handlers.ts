import type { ChatIntent, ChatResponse } from "@/types/chat";
import {
  getMyVehicleContextByEmail,
  getMyContractByEmail,
  getMyDocumentsByEmail,
} from "@/lib/queries/fleet";
import {
  getAllowedVehicleOptionsByEmail,
  getBestRangeOptionByEmail,
} from "@/lib/queries/options";
import {
  getChargingSummaryByEmail,
  getChargingHomeVsPublicByEmail,
  getReimbursementStatusByEmail,
} from "@/lib/queries/charging";
import {
  formatVehicleResponse,
  formatContractResponse,
  formatDocumentsResponse,
} from "@/lib/formatters/fleet";
import {
  formatAllowedOptionsResponse,
  formatBestRangeResponse,
} from "@/lib/formatters/options";
import {
  formatChargingSummaryResponse,
  formatChargingComparisonResponse,
  formatReimbursementResponse,
} from "@/lib/formatters/charging";

const DEFAULT_SUGGESTIONS = [
  "Mijn wagen",
  "Mijn documenten",
  "Mijn laadkosten",
  "Beschikbare wagens",
  "Contractinfo",
];

export async function handleIntent(
  intent: ChatIntent,
  email: string,
  voornaam?: string
): Promise<ChatResponse> {
  switch (intent) {
    case "my_vehicle": {
      const ctx = await getMyVehicleContextByEmail(email);
      return formatVehicleResponse(ctx);
    }
    case "my_contract": {
      const ctx = await getMyContractByEmail(email);
      return formatContractResponse(ctx);
    }
    case "my_documents": {
      const docs = await getMyDocumentsByEmail(email);
      return formatDocumentsResponse(docs);
    }
    case "allowed_options": {
      const options = await getAllowedVehicleOptionsByEmail(email);
      return formatAllowedOptionsResponse(options);
    }
    case "best_range_option": {
      const best = await getBestRangeOptionByEmail(email);
      return formatBestRangeResponse(best);
    }
    case "charging_summary": {
      const summary = await getChargingSummaryByEmail(email);
      return formatChargingSummaryResponse(summary);
    }
    case "charging_home_vs_public": {
      const breakdowns = await getChargingHomeVsPublicByEmail(email);
      return formatChargingComparisonResponse(breakdowns);
    }
    case "reimbursement_status": {
      const status = await getReimbursementStatusByEmail(email);
      return formatReimbursementResponse(status);
    }
    case "greeting":
      return formatGreeting(voornaam);

    // ── Manager intents (stubs) ──
    case "fleet_overview":
    case "expiring_contracts":
    case "charging_cost_overview":
    case "top_cost_drivers":
    case "home_vs_public_fleet":
    case "open_reimbursements_fleet":
    case "non_compliant_assignments":
      return formatManagerStub(intent);

    case "unknown":
    default:
      return formatUnknown();
  }
}

function formatGreeting(voornaam?: string): ChatResponse {
  const name = voornaam ? `, ${voornaam}` : "";
  return {
    intent: "greeting",
    title: "Welkom",
    message: `Hallo${name}! Ik ben je Fleet Companion. Hoe kan ik je helpen?\n\nJe kunt me vragen stellen over je wagen, contract, documenten, laadkosten of beschikbare voertuigopties.`,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

function formatUnknown(): ChatResponse {
  return {
    intent: "unknown",
    title: "Niet herkend",
    message:
      "Ik kan je daar nog niet goed mee helpen. Je kan me bijvoorbeeld vragen naar je wagen, documenten, contract, laadkosten of beschikbare wagens.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

function formatManagerStub(intent: ChatIntent): ChatResponse {
  return {
    intent,
    title: "Fleet Manager",
    message:
      "Deze functie is momenteel nog in ontwikkeling voor fleet managers. Neem contact op met je fleet manager voor dit type informatie.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
