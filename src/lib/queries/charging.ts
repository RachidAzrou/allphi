import { createClient } from "@/lib/supabase/server";
import type { ChargingSummary, ChargingHomeVsPublic } from "@/types/database";

export async function getChargingSummaryByEmail(
  email: string
): Promise<ChargingSummary | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_charging_sessions_overview")
    .select("*")
    .eq("medewerker_email", email);

  if (error) {
    console.error("Error fetching charging summary:", error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const sessions = data;
  const totaal_sessies = sessions.length;
  const totaal_kwh = sessions.reduce(
    (sum: number, s: Record<string, unknown>) => sum + (Number(s.kwh) || 0),
    0
  );
  const totale_kosten = sessions.reduce(
    (sum: number, s: Record<string, unknown>) => sum + (Number(s.kosten) || 0),
    0
  );

  return {
    totaal_sessies,
    totaal_kwh: Math.round(totaal_kwh * 100) / 100,
    totale_kosten: Math.round(totale_kosten * 100) / 100,
    gemiddelde_kosten_per_sessie:
      totaal_sessies > 0
        ? Math.round((totale_kosten / totaal_sessies) * 100) / 100
        : 0,
    gemiddelde_kwh_per_sessie:
      totaal_sessies > 0
        ? Math.round((totaal_kwh / totaal_sessies) * 100) / 100
        : 0,
  };
}

export async function getChargingHomeVsPublicByEmail(
  email: string
): Promise<ChargingHomeVsPublic | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_charging_sessions_overview")
    .select("*")
    .eq("medewerker_email", email);

  if (error) {
    console.error("Error fetching charging comparison:", error);
    return null;
  }

  if (!data || data.length === 0) return null;

  const thuis = data.filter(
    (s: Record<string, unknown>) => s.locatie_type === "thuis"
  );
  const publiek = data.filter(
    (s: Record<string, unknown>) => s.locatie_type === "publiek"
  );

  return {
    thuis_sessies: thuis.length,
    thuis_kwh: Math.round(
      thuis.reduce(
        (sum: number, s: Record<string, unknown>) =>
          sum + (Number(s.kwh) || 0),
        0
      ) * 100
    ) / 100,
    thuis_kosten: Math.round(
      thuis.reduce(
        (sum: number, s: Record<string, unknown>) =>
          sum + (Number(s.kosten) || 0),
        0
      ) * 100
    ) / 100,
    publiek_sessies: publiek.length,
    publiek_kwh: Math.round(
      publiek.reduce(
        (sum: number, s: Record<string, unknown>) =>
          sum + (Number(s.kwh) || 0),
        0
      ) * 100
    ) / 100,
    publiek_kosten: Math.round(
      publiek.reduce(
        (sum: number, s: Record<string, unknown>) =>
          sum + (Number(s.kosten) || 0),
        0
      ) * 100
    ) / 100,
  };
}
