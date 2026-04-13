import { createClient } from "@/lib/supabase/server";
import type {
  ChargingSummary,
  ChargingLocationBreakdown,
  ReimbursementStatus,
  ChargingSessionOverview,
} from "@/types/database";

export async function getChargingSummaryByEmail(
  email: string
): Promise<ChargingSummary | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_charging_sessions_overview")
    .select("kwh, kost_eur")
    .eq("emailadres", email);

  if (error) {
    console.error("[charging] Error fetching summary:", error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  const sessions = data as Pick<ChargingSessionOverview, "kwh" | "kost_eur">[];
  const aantal_sessies = sessions.length;
  const totaal_kwh = round(sessions.reduce((s, r) => s + (Number(r.kwh) || 0), 0));
  const totaal_kost = round(sessions.reduce((s, r) => s + (Number(r.kost_eur) || 0), 0));

  return {
    aantal_sessies,
    totaal_kwh,
    totaal_kost,
    gemiddelde_kost_per_sessie: aantal_sessies > 0 ? round(totaal_kost / aantal_sessies) : 0,
  };
}

export async function getChargingHomeVsPublicByEmail(
  email: string
): Promise<ChargingLocationBreakdown[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_charging_sessions_overview")
    .select("locatie_type, kwh, kost_eur")
    .eq("emailadres", email);

  if (error) {
    console.error("[charging] Error fetching home vs public:", error.message);
    return [];
  }

  if (!data || data.length === 0) return [];

  const sessions = data as Pick<ChargingSessionOverview, "locatie_type" | "kwh" | "kost_eur">[];
  const grouped = new Map<string, { kwh: number; kost: number; count: number }>();

  for (const s of sessions) {
    const type = s.locatie_type ?? "onbekend";
    const current = grouped.get(type) ?? { kwh: 0, kost: 0, count: 0 };
    current.kwh += Number(s.kwh) || 0;
    current.kost += Number(s.kost_eur) || 0;
    current.count += 1;
    grouped.set(type, current);
  }

  return Array.from(grouped.entries()).map(([locatie_type, agg]) => ({
    locatie_type,
    aantal_sessies: agg.count,
    totaal_kwh: round(agg.kwh),
    totaal_kost: round(agg.kost),
  }));
}

export async function getReimbursementStatusByEmail(
  email: string
): Promise<ReimbursementStatus | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("v_charging_sessions_overview")
    .select("kost_eur, terugbetaald")
    .eq("emailadres", email);

  if (error) {
    console.error("[charging] Error fetching reimbursement status:", error.message);
    return null;
  }

  if (!data || data.length === 0) return null;

  const sessions = data as Pick<ChargingSessionOverview, "kost_eur" | "terugbetaald">[];

  const open = sessions.filter((s) => !s.terugbetaald);
  const betaald = sessions.filter((s) => s.terugbetaald);

  return {
    aantal_open: open.length,
    open_bedrag: round(open.reduce((s, r) => s + (Number(r.kost_eur) || 0), 0)),
    aantal_betaald: betaald.length,
    betaald_bedrag: round(betaald.reduce((s, r) => s + (Number(r.kost_eur) || 0), 0)),
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
