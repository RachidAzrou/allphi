import { createClient } from "@/lib/supabase/server";
import type { AllowedVehicleOption } from "@/types/database";

export async function getAllowedVehicleOptionsByEmail(
  email: string
): Promise<AllowedVehicleOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_allowed_vehicle_options")
    .select("*")
    .eq("medewerker_email", email)
    .order("range_km", { ascending: false });

  if (error) {
    console.error("Error fetching allowed vehicle options:", error);
    return [];
  }

  return (data as AllowedVehicleOption[]) ?? [];
}

export async function getBestRangeOptionByEmail(
  email: string
): Promise<AllowedVehicleOption | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_allowed_vehicle_options")
    .select("*")
    .eq("medewerker_email", email)
    .order("range_km", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Error fetching best range option:", error);
    return null;
  }

  return data as AllowedVehicleOption | null;
}
