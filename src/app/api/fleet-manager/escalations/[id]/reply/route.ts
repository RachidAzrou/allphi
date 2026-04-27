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

  return { ok: true as const, supabase, userEmail: user.email };
}

export async function POST(
  request: NextRequest,
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

  const body = await request.json().catch(() => ({}));
  const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
  const markResolved = body?.markResolved !== false;

  if (!answer) {
    return NextResponse.json({ error: "Provide answer" }, { status: 400 });
  }

  const { data: esc, error: escErr } = await auth.supabase
    .from("fleet_escalations")
    .select("id, conversation_id, status")
    .eq("id", escalationId)
    .maybeSingle();
  if (escErr) {
    console.error("POST reply escalation load:", escErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (!esc?.conversation_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error: msgErr } = await auth.supabase.from("chat_messages").insert({
    conversation_id: esc.conversation_id,
    role: "fleet_manager",
    content: answer,
    attachments: [],
    metadata: {
      title: "Fleet Manager",
      sender: "fleet_manager",
      sender_email: auth.userEmail,
    },
  });
  if (msgErr) {
    console.error("POST reply insert message:", msgErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  if (markResolved) {
    const { error: updErr } = await auth.supabase
      .from("fleet_escalations")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", escalationId);
    if (updErr) {
      console.error("POST reply escalation update:", updErr);
      return NextResponse.json({ error: "server_error" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}

