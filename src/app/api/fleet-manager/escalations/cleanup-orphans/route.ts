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

  return { ok: true as const, by: user.email, role };
}

function hasEmailLike(s: string | null | undefined) {
  const t = (s ?? "").trim();
  if (!t) return false;
  return /@/.test(t);
}

function isMissingRequesterFromSubject(subject: string | null | undefined) {
  const s = (subject ?? "").trim();
  if (!s) return true;
  // Escalaties bevatten typisch: "Escalatie — <naam> — <email> — <topic>"
  // Als er geen @ in de subject staat, kunnen we de medewerker niet tonen/afleiden in de UI.
  return !hasEmailLike(s);
}

function isBodyMissingRequesterOrEmpty(body: string | null | undefined) {
  const b = (body ?? "").trim();
  if (!b) return true;
  if (!/medewerker\s*:/i.test(b)) return true;
  if (!hasEmailLike(b)) return true;
  return false;
}

export async function POST(request: NextRequest) {
  const auth = await assertFleetOrManagement();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const confirm = body?.confirm === true;
  if (!confirm) {
    return NextResponse.json({ ok: false, error: "confirm_required" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 500 },
    );
  }

  // Pull enough rows; fleet inbox is small for now, but we cap defensively.
  const { data: rows, error } = await admin
    .from("fleet_escalations")
    .select("id, subject, body, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) {
    console.error("[cleanup-orphans] select error:", error);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }

  const candidates = (rows ?? []).filter((r) => {
    // Only delete "broken" items:
    // - no usable email in subject AND
    // - empty/invalid body w.r.t. "Medewerker: <email@...>"
    return isMissingRequesterFromSubject(r.subject) && isBodyMissingRequesterOrEmpty(r.body);
  });

  const ids = candidates.map((r) => r.id);
  if (ids.length === 0) {
    return NextResponse.json({ ok: true, deleted: 0, by: auth.by, candidates: 0 });
  }

  // Delete in batches
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const { error: delErr } = await admin.from("fleet_escalations").delete().in("id", batch);
    if (delErr) {
      console.error("[cleanup-orphans] delete error:", delErr);
      return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, deleted: ids.length, by: auth.by, candidates: ids.length });
}
