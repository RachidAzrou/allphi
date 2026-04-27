import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Action =
  | "approve_fleet"
  | "approve_management"
  | "reject"
  | "mark_ordered"
  | "mark_delivered";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { action?: Action; note?: string } | null;
  const action = body?.action;
  const note = typeof body?.note === "string" ? body.note.trim() : "";

  if (!action) {
    return NextResponse.json({ ok: false, error: "Missing action" }, { status: 400 });
  }

  const { data: medewerker } = await supabase
    .from("medewerkers")
    .select("role")
    .ilike("emailadres", user.email)
    .maybeSingle();

  const role = (medewerker as { role?: string } | null)?.role ?? "medewerker";
  const isFleet = role === "fleet_manager";
  const isMgmt = role === "management";
  const isApprover = isFleet || isMgmt;

  if (!isApprover) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const { data: row, error: rowErr } = await supabase
    .from("wagen_bestellingen")
    .select("id, status, fleet_approved_at, management_approved_at")
    .eq("id", id)
    .single();

  if (rowErr || !row) {
    return NextResponse.json({ ok: false, error: "Niet gevonden" }, { status: 404 });
  }

  const now = new Date().toISOString();

  const patch: Record<string, unknown> = {};
  if (note) patch["approval_note"] = note;

  if (action === "reject") {
    patch["status"] = "rejected";
  } else if (action === "approve_fleet") {
    if (!isFleet) return NextResponse.json({ ok: false, error: "Fleet only" }, { status: 403 });
    patch["fleet_approved_at"] = now;
    patch["fleet_approved_by"] = user.id;
  } else if (action === "approve_management") {
    if (!isMgmt) return NextResponse.json({ ok: false, error: "Management only" }, { status: 403 });
    patch["management_approved_at"] = now;
    patch["management_approved_by"] = user.id;
  } else if (action === "mark_ordered") {
    patch["status"] = "ordered";
  } else if (action === "mark_delivered") {
    patch["status"] = "delivered";
  }

  // If both approvals are present (either already or by this action), set status approved.
  const nextFleet = (action === "approve_fleet" ? now : row.fleet_approved_at) ?? null;
  const nextMgmt =
    (action === "approve_management" ? now : row.management_approved_at) ?? null;
  if (nextFleet && nextMgmt && row.status !== "rejected") {
    patch["status"] = "approved";
  }

  const { error: upErr } = await supabase
    .from("wagen_bestellingen")
    .update(patch)
    .eq("id", id);

  if (upErr) {
    console.error(upErr);
    return NextResponse.json({ ok: false, error: "Update failed" }, { status: 500 });
  }

  await supabase.from("wagen_bestelling_events").insert({
    bestelling_id: id,
    actor_user_id: user.id,
    type: action,
    data: { note },
  });

  return NextResponse.json({ ok: true });
}

