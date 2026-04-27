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

  return { ok: true as const, supabase, userEmail: user.email, role };
}

export async function GET(request: NextRequest) {
  const auth = await assertFleetOrManagement();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const statusParam = (url.searchParams.get("status") ?? "").trim();
  const status =
    statusParam && ["unread", "open", "resolved"].includes(statusParam) ? statusParam : null;

  const query = auth.supabase
    .from("fleet_escalations")
    .select("id, conversation_id, user_message_id, status, subject, created_at, resolved_at")
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) query.eq("status", status);

  const { data, error } = await query;
  if (error) {
    console.error("GET /api/fleet-manager/escalations:", error);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ escalations: data ?? [] });
}

