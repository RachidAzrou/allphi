import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function assertAdmin(request: NextRequest): string | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return "ADMIN_API_KEY is not set";
  const got = request.headers.get("x-admin-key");
  if (!got || got !== expected) return "Invalid admin key";
  return null;
}

type EscalationRow = {
  id: string;
  conversation_id: string | null;
  status: string;
};

export async function POST(request: NextRequest) {
  const adminErr = assertAdmin(request);
  if (adminErr) {
    return NextResponse.json({ error: adminErr }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const escalationId =
      typeof body?.escalationId === "string" ? body.escalationId.trim() : "";
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";
    const title =
      typeof body?.title === "string" && body.title.trim()
        ? body.title.trim()
        : "Fleet Manager";

    if (!escalationId || !answer) {
      return NextResponse.json(
        { error: "Provide escalationId and answer" },
        { status: 400 },
      );
    }

    const { data: escRaw, error: escErr } = await admin
      .from("fleet_escalations")
      .select("id, conversation_id, status")
      .eq("id", escalationId)
      .maybeSingle();
    if (escErr) throw escErr;
    const esc = escRaw as EscalationRow | null;
    if (!esc?.conversation_id) {
      return NextResponse.json(
        { error: "Escalation not found or missing conversation_id" },
        { status: 404 },
      );
    }

    // Insert as an assistant message in the same conversation.
    const { error: msgErr } = await admin.from("chat_messages").insert({
      conversation_id: esc.conversation_id,
      role: "assistant",
      content: answer,
      attachments: [],
      metadata: {
        intent: "unknown",
        title,
        suggestions: [
          "Mijn wagen",
          "Mijn documenten",
          "Mijn laadkosten",
          "Beschikbare wagens",
          "Contractinfo",
        ],
      },
    });
    if (msgErr) throw msgErr;

    await admin
      .from("fleet_escalations")
      .update({ status: "resolved", resolved_at: new Date().toISOString() })
      .eq("id", escalationId);

    return NextResponse.json({ ok: true, escalationId, conversationId: esc.conversation_id });
  } catch (e) {
    console.error("[fleet-escalations/reply] Error:", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

