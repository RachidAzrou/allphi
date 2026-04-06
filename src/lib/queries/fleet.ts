import { createClient } from "@/lib/supabase/server";
import type { FleetAssistantContext, DocumentInfo } from "@/types/database";

export async function getFleetAssistantContextByEmail(
  email: string
): Promise<FleetAssistantContext | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_fleet_assistant_context")
    .select("*")
    .eq("medewerker_email", email)
    .maybeSingle();

  if (error) {
    console.error("Error fetching fleet context:", error);
    return null;
  }

  return data as FleetAssistantContext | null;
}

export async function getDocumentsByEmail(
  email: string
): Promise<DocumentInfo[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_fleet_assistant_context")
    .select("documenten")
    .eq("medewerker_email", email)
    .maybeSingle();

  if (error) {
    console.error("Error fetching documents:", error);
    return [];
  }

  return (data?.documenten as DocumentInfo[]) ?? [];
}

export async function checkMedewerkerExists(email: string): Promise<boolean> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("medewerkers")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    console.error("Error checking medewerker:", error);
    return false;
  }

  return data !== null;
}
