import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getFleetChargingMonthlyOverview } from "@/lib/queries/fleet-charging";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { data: medewerker } = await supabase
    .from("medewerkers")
    .select("role")
    .ilike("emailadres", user.email)
    .maybeSingle();

  const role = (medewerker as { role?: string } | null)?.role ?? "medewerker";
  const isApprover = role === "fleet_manager" || role === "management";

  if (!isApprover) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const monthFrom = url.searchParams.get("from") ?? undefined;
  const monthTo = url.searchParams.get("to") ?? undefined;
  const limitParam = url.searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  const rows = await getFleetChargingMonthlyOverview({ monthFrom, monthTo, limit });
  return NextResponse.json({ ok: true, rows });
}

