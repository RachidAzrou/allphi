import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type MedewerkerRole = "medewerker" | "fleet_manager" | "management";

async function assertFleetOrManagement() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false as const, status: 401 as const, error: "Niet geautoriseerd" };
  }

  const { data: medewerker, error } = await supabase
    .from("medewerkers")
    .select("role, rol")
    .ilike("emailadres", user.email)
    .maybeSingle();
  if (error) {
    return { ok: false as const, status: 500 as const, error: "server_error" };
  }

  const role = (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null } | null)
    ? (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null }).role ??
      (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null }).rol ??
      "medewerker"
    : "medewerker";

  if (role !== "fleet_manager" && role !== "management") {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  return { ok: true as const, supabase };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertFleetOrManagement();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const { data, error } = await auth.supabase
    .from("ongeval_aangiften")
    .select("id, status, created_at, updated_at, email_status, medewerker_id, payload, fleet_unread, fleet_read_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const row = data as {
    id: string;
    medewerker_id: number | null;
    payload: unknown;
    [k: string]: unknown;
  };

  const payloadObj = (row.payload ?? {}) as Record<string, unknown>;
  const partyA = (payloadObj.partyA ?? {}) as Record<string, unknown>;
  const bestuurder = (partyA.bestuurder ?? {}) as Record<string, unknown>;
  const voertuig = (partyA.voertuig ?? {}) as Record<string, unknown>;
  const employeeDriver = (payloadObj.employeeDriver ?? {}) as Record<string, unknown>;
  const otherDriver = (payloadObj.otherDriver ?? {}) as Record<string, unknown>;

  const emailCandidates = [
    typeof bestuurder.email === "string" ? bestuurder.email : "",
    typeof employeeDriver.email === "string" ? employeeDriver.email : "",
    typeof otherDriver.email === "string" ? otherDriver.email : "",
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  const emailadres = emailCandidates[0] ?? "";
  const nummerplaat = typeof voertuig.nummerplaat === "string" ? voertuig.nummerplaat.trim() : "";

  // Extra context uit DB (best-effort).
  const [medewerkerRes, vehicleCtxRes] = await Promise.all([
    row.medewerker_id
      ? auth.supabase.from("medewerkers").select("*").eq("id", row.medewerker_id).maybeSingle()
      : emailadres
        ? auth.supabase.from("medewerkers").select("*").ilike("emailadres", emailadres).maybeSingle()
        : Promise.resolve({ data: null as unknown, error: null as unknown }),
    emailadres || nummerplaat
      ? auth.supabase
          .from("v_fleet_assistant_context")
          .select("*")
          .or(
            [
              emailadres ? `emailadres.ilike.${emailadres}` : null,
              nummerplaat ? `nummerplaat.eq.${nummerplaat}` : null,
            ]
              .filter(Boolean)
              .join(","),
          )
          .limit(50)
      : Promise.resolve({ data: null as unknown, error: null as unknown }),
  ]);

  const medewerker =
    medewerkerRes && (medewerkerRes as any).data ? (medewerkerRes as any).data : null;
  const vehicleContextRows =
    vehicleCtxRes && (vehicleCtxRes as any).data && Array.isArray((vehicleCtxRes as any).data)
      ? (vehicleCtxRes as any).data
      : [];

  return NextResponse.json({
    ok: true,
    aangifte: row,
    medewerker,
    vehicleContextRows,
  });
}

