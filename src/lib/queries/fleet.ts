import { createClient } from "@/lib/supabase/server";
import type { FleetAssistantContext } from "@/types/database";

export async function getMyVehicleContextByEmail(
  email: string
): Promise<FleetAssistantContext | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_fleet_assistant_context")
    .select("*")
    .eq("emailadres", email)
    .maybeSingle();

  if (error) {
    console.error("[fleet] Error fetching vehicle context:", error.message);
    return null;
  }

  return data as FleetAssistantContext | null;
}

export async function getMyContractByEmail(
  email: string
): Promise<FleetAssistantContext | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_fleet_assistant_context")
    .select(
      "contract_id, goedkeuringsstatus, contracteinddatum, tco_plafond, optiebudget, leasingmaatschappij, wagen_categorie, merk_model"
    )
    .eq("emailadres", email)
    .maybeSingle();

  if (error) {
    console.error("[fleet] Error fetching contract:", error.message);
    return null;
  }

  return data as FleetAssistantContext | null;
}

export async function getMyDocumentsByEmail(
  email: string
): Promise<FleetAssistantContext[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_fleet_assistant_context")
    .select("document_type, document_url, merk_model")
    .eq("emailadres", email)
    .not("document_type", "is", null);

  if (error) {
    console.error("[fleet] Error fetching documents:", error.message);
    return [];
  }

  return (data as FleetAssistantContext[]) ?? [];
}

export async function checkMedewerkerExists(email: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("medewerkers")
    .select("id")
    .eq("emailadres", email)
    .maybeSingle();

  if (error) {
    console.error("[fleet] Error checking medewerker:", error.message);
    return false;
  }

  return data !== null;
}
