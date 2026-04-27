import { createClient } from "@/lib/supabase/server";
import type { FleetChargingMonthlyOverview } from "@/types/database";

export async function getFleetChargingMonthlyOverview(params?: {
  monthFrom?: string;
  monthTo?: string;
  limit?: number;
}): Promise<FleetChargingMonthlyOverview[]> {
  const supabase = await createClient();

  let q = supabase
    .from("v_fleet_charging_monthly_overview")
    .select(
      "maand, medewerker_id, voornaam, naam, emailadres, locatie_type, aantal_sessies, totaal_kwh, totaal_kost, open_kost",
    )
    .order("maand", { ascending: false });

  const monthFrom =
    typeof params?.monthFrom === "string" ? params.monthFrom.trim() : "";
  const monthTo = typeof params?.monthTo === "string" ? params.monthTo.trim() : "";

  if (monthFrom) q = q.gte("maand", monthFrom);
  if (monthTo) q = q.lte("maand", monthTo);

  const limit =
    typeof params?.limit === "number" && Number.isFinite(params.limit)
      ? Math.max(1, Math.min(2000, Math.floor(params.limit)))
      : 500;
  q = q.limit(limit);

  const { data, error } = await q;
  if (error) {
    console.error("[fleet-charging] Error fetching monthly overview:", error.message);
    return [];
  }

  return (data as FleetChargingMonthlyOverview[] | null) ?? [];
}

