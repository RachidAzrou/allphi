import { createClient } from "@/lib/supabase/server";
import type { AllowedVehicleOption } from "@/types/database";

export async function getAllowedVehicleOptionsByEmail(
  email: string
): Promise<AllowedVehicleOption[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_allowed_vehicle_options")
    .select("*")
    .eq("emailadres", email)
    .order("optiebudget_voor_medewerker", { ascending: false })
    .order("range_km", { ascending: false });

  if (error) {
    console.error("[options] Error fetching allowed options:", error.message);
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
    .eq("emailadres", email)
    .order("range_km", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[options] Error fetching best range option:", error.message);
    return null;
  }

  return data as AllowedVehicleOption | null;
}
