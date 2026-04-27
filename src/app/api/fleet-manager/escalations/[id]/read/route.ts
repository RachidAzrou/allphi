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

/**
 * Markeer escalatie als gelezen: unread/queued → open. Idempotent.
 * `queued` = legacy; na migratie is `unread` de norm.
 * Update via service role (na auth) zodat RLS geen valse negatieven geeft.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertFleetOrManagement();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const escalationId = (id ?? "").trim();
  if (!escalationId) {
    return NextResponse.json({ error: "missing_id" }, { status: 400 });
  }

  const { data: row, error: loadErr } = await auth.supabase
    .from("fleet_escalations")
    .select("id, status")
    .eq("id", escalationId)
    .maybeSingle();
  if (loadErr) {
    console.error("POST read escalation load:", loadErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const status = String(row.status ?? "").toLowerCase();
  if (status !== "unread" && status !== "queued") {
    return NextResponse.json({ ok: true, status, changed: false as const });
  }

  const svc = createServiceRoleClient();
  const client = svc ?? auth.supabase;

  function isCheckViolation(err: unknown): boolean {
    const e = err as { code?: string; message?: string };
    return (
      e?.code === "23514" || /check constraint|violates check/i.test(String(e?.message ?? ""))
    );
  }

  let newStatus: string | null = null;
  const { data: updatedOpen, error: errOpen } = await client
    .from("fleet_escalations")
    .update({ status: "open" })
    .eq("id", escalationId)
    .in("status", ["unread", "queued"])
    .select("id");
  if (errOpen && isCheckViolation(errOpen)) {
    // Oude DB: CHECK bevat geen `open` maar wel `sent` — zelfde betekenis als "gelezen" in UI.
    const { data: updatedSent, error: errSent } = await client
      .from("fleet_escalations")
      .update({ status: "sent" })
      .eq("id", escalationId)
      .in("status", ["unread", "queued"])
      .select("id");
    if (errSent) {
      console.error("POST read escalation update (legacy sent):", errSent);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
    if (Array.isArray(updatedSent) && updatedSent.length > 0) {
      newStatus = "sent";
    }
  } else if (errOpen) {
    console.error("POST read escalation update:", errOpen);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  } else if (Array.isArray(updatedOpen) && updatedOpen.length > 0) {
    newStatus = "open";
  }

  const { data: finalRow } = await client
    .from("fleet_escalations")
    .select("status")
    .eq("id", escalationId)
    .maybeSingle();
  const final = String((finalRow as { status?: string } | null)?.status ?? status).toLowerCase();
  const changed = newStatus !== null;
  return NextResponse.json({
    ok: true,
    status: changed && newStatus ? newStatus : final,
    changed: changed as boolean,
  });
}
