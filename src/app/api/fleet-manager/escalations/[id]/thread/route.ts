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

  const { data: escalation, error: escErr } = await auth.supabase
    .from("fleet_escalations")
    .select("id, conversation_id, user_message_id, status, subject, body, created_at, resolved_at")
    .eq("id", escalationId)
    .maybeSingle();

  if (escErr) {
    console.error("GET escalation:", escErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
  if (!escalation?.conversation_id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  let since: string | null = null;
  if (escalation.user_message_id) {
    const { data: anchor, error: anchorErr } = await auth.supabase
      .from("chat_messages")
      .select("created_at")
      .eq("id", escalation.user_message_id)
      .eq("conversation_id", escalation.conversation_id)
      .maybeSingle();
    if (anchorErr) {
      console.error("GET anchor message:", anchorErr);
    } else if (anchor?.created_at) {
      since = String(anchor.created_at);
    }
  }

  // Privacy: a fleet manager must NOT see the full chat transcript.
  // Only return the medewerker's escalated question (anchor user message)
  // plus any fleet_manager replies.
  let msgQ = auth.supabase
    .from("chat_messages")
    .select("id, role, content, attachments, metadata, created_at")
    .eq("conversation_id", escalation.conversation_id)
    .order("created_at", { ascending: true });
  if (since) {
    msgQ = msgQ.gte("created_at", since);
  }
  if (escalation.user_message_id) {
    msgQ = msgQ.or(`id.eq.${escalation.user_message_id},role.eq.fleet_manager`);
  } else {
    msgQ = msgQ.eq("role", "fleet_manager");
  }
  const { data: messages, error: msgErr } = await msgQ;
  if (msgErr) {
    console.error("GET messages:", msgErr);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({
    escalation,
    messages: (messages ?? []).map((m) => ({
      ...m,
      timestamp: m.created_at,
    })),
  });
}

