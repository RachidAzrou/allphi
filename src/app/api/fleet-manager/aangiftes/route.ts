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

type AccidentRow = {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  email_status: string | null;
  medewerker_id: number | null;
  fleet_unread: boolean | null;
  payload: unknown;
};

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function pickSummary(payload: unknown) {
  const p = (payload ?? {}) as Record<string, unknown>;
  const location = (p.location ?? {}) as Record<string, unknown>;
  const partyA = (p.partyA ?? {}) as Record<string, unknown>;
  const voertuig = (partyA.voertuig ?? {}) as Record<string, unknown>;
  const bestuurder = (partyA.bestuurder ?? {}) as Record<string, unknown>;

  const stad = safeString(location.stad).trim();
  const datum = safeString(location.datum).trim();
  const nummerplaat = safeString(voertuig.nummerplaat).trim();
  const bestuurderNaam = [safeString(bestuurder.voornaam).trim(), safeString(bestuurder.naam).trim()]
    .filter(Boolean)
    .join(" ")
    .trim();

  return {
    stad: stad || null,
    datum: datum || null,
    nummerplaat: nummerplaat || null,
    bestuurderNaam: bestuurderNaam || null,
  };
}

export async function GET(request: NextRequest) {
  const auth = await assertFleetOrManagement();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const statusParam = (url.searchParams.get("status") ?? "").trim().toLowerCase();
  const status = statusParam && ["submitted", "completed", "all"].includes(statusParam) ? statusParam : "submitted";

  const q = auth.supabase
    .from("ongeval_aangiften")
    .select("id, status, created_at, updated_at, email_status, medewerker_id, fleet_unread, payload")
    .in("status", status === "all" ? ["submitted", "completed"] : [status])
    .order("updated_at", { ascending: false })
    .limit(300);

  const { data, error } = await q;
  if (error) {
    console.error("GET /api/fleet-manager/aangiftes:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  const rows = (Array.isArray(data) ? data : []) as AccidentRow[];
  return NextResponse.json({
    aangiftes: rows.map((r) => ({
      id: r.id,
      status: r.status,
      created_at: r.created_at,
      updated_at: r.updated_at,
      email_status: r.email_status,
      medewerker_id: r.medewerker_id,
      fleet_unread: Boolean(r.fleet_unread),
      summary: pickSummary(r.payload),
    })),
  });
}

