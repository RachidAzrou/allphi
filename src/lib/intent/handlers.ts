import type { Intent, IntentResult } from "@/types/chat";
import { getFleetAssistantContextByEmail } from "@/lib/queries/fleet";
import { getAllowedVehicleOptionsByEmail, getBestRangeOptionByEmail } from "@/lib/queries/vehicles";
import { getChargingSummaryByEmail, getChargingHomeVsPublicByEmail } from "@/lib/queries/charging";
import { formatVehicleResponse, formatContractResponse, formatDocumentsResponse, formatAllowedOptionsResponse, formatChargingSummaryResponse, formatChargingComparisonResponse, formatBestRangeResponse, formatGreetingResponse, formatUnknownResponse } from "@/lib/formatters/responses";

export async function handleIntent(
  intent: Intent,
  email: string,
  voornaam?: string
): Promise<IntentResult> {
  switch (intent) {
    case "my_vehicle":
      return handleMyVehicle(email);
    case "my_documents":
      return handleMyDocuments(email);
    case "my_contract":
      return handleMyContract(email);
    case "allowed_options":
      return handleAllowedOptions(email);
    case "charging_summary":
      return handleChargingSummary(email);
    case "charging_home_vs_public":
      return handleChargingHomeVsPublic(email);
    case "best_range_option":
      return handleBestRangeOption(email);
    case "greeting":
      return formatGreetingResponse(voornaam);
    case "unknown":
    default:
      return formatUnknownResponse();
  }
}

async function handleMyVehicle(email: string): Promise<IntentResult> {
  const context = await getFleetAssistantContextByEmail(email);
  return formatVehicleResponse(context);
}

async function handleMyDocuments(email: string): Promise<IntentResult> {
  const context = await getFleetAssistantContextByEmail(email);
  return formatDocumentsResponse(context);
}

async function handleMyContract(email: string): Promise<IntentResult> {
  const context = await getFleetAssistantContextByEmail(email);
  return formatContractResponse(context);
}

async function handleAllowedOptions(email: string): Promise<IntentResult> {
  const options = await getAllowedVehicleOptionsByEmail(email);
  return formatAllowedOptionsResponse(options);
}

async function handleChargingSummary(email: string): Promise<IntentResult> {
  const summary = await getChargingSummaryByEmail(email);
  return formatChargingSummaryResponse(summary);
}

async function handleChargingHomeVsPublic(email: string): Promise<IntentResult> {
  const comparison = await getChargingHomeVsPublicByEmail(email);
  return formatChargingComparisonResponse(comparison);
}

async function handleBestRangeOption(email: string): Promise<IntentResult> {
  const best = await getBestRangeOptionByEmail(email);
  return formatBestRangeResponse(best);
}
