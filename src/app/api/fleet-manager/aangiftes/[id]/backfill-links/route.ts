import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertFleetOrManagement();
  if (!auth.ok) return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });

  const { id } = await params;
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ ok: false, error: "service_role_missing" }, { status: 500 });
  }

  const { data: row, error: rowErr } = await admin
    .from("ongeval_aangiften")
    .select("id, user_id, medewerker_id, payload")
    .eq("id", id)
    .maybeSingle();
  if (rowErr || !row) {
    return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
  }

  const userId = String((row as any).user_id ?? "");
  if (!userId) return NextResponse.json({ ok: false, error: "missing_user" }, { status: 500 });

  const userRes = await admin.auth.admin.getUserById(userId);
  const email = userRes.data?.user?.email?.trim() ?? "";
  if (!email) return NextResponse.json({ ok: false, error: "missing_email" }, { status: 500 });

  const { data: m } = await admin
    .from("medewerkers")
    .select("*")
    .ilike("emailadres", email)
    .maybeSingle();
  const medewerkerId = (m as { id?: number } | null)?.id ?? null;

  const { data: vctx } = await admin
    .from("v_fleet_assistant_context")
    .select("nummerplaat, merk_model, insurance_company, policy_number")
    .ilike("emailadres", email)
    .order("merk_model", { ascending: true })
    .order("nummerplaat", { ascending: true })
    .limit(1)
    .maybeSingle();

  const plate = (vctx as any)?.nummerplaat?.trim?.() ?? "";
  const merkModel = (vctx as any)?.merk_model?.trim?.() ?? "";
  const insuranceCompany = (vctx as any)?.insurance_company?.trim?.() ?? "";
  const policyNumber = (vctx as any)?.policy_number?.trim?.() ?? "";

  const payload = ((row as any).payload ?? {}) as Record<string, unknown>;
  const partyA = ((payload as any).partyA ?? {}) as Record<string, unknown>;
  const bestuurder = ((partyA as any).bestuurder ?? {}) as Record<string, unknown>;
  const voertuig = ((partyA as any).voertuig ?? {}) as Record<string, unknown>;
  const verzekering = ((partyA as any).verzekering ?? {}) as Record<string, unknown>;

  const curEmail = typeof bestuurder.email === "string" ? bestuurder.email.trim() : "";
  const curPlate = typeof voertuig.nummerplaat === "string" ? voertuig.nummerplaat.trim() : "";

  if (!curEmail) bestuurder.email = email;
  if (!curPlate && plate) voertuig.nummerplaat = plate;
  if (merkModel && (!voertuig.merkModel || !String(voertuig.merkModel).trim())) voertuig.merkModel = merkModel;
  if (insuranceCompany && (!verzekering.maatschappij || !String(verzekering.maatschappij).trim()))
    verzekering.maatschappij = insuranceCompany;
  if (policyNumber && (!verzekering.polisnummer || !String(verzekering.polisnummer).trim()))
    verzekering.polisnummer = policyNumber;

  partyA.bestuurder = bestuurder;
  partyA.voertuig = voertuig;
  partyA.verzekering = verzekering;
  payload.partyA = partyA;

  const { error: updErr } = await admin
    .from("ongeval_aangiften")
    .update({ medewerker_id: medewerkerId, payload })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

