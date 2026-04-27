import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
    }

    const { data: conv, error: cErr } = await supabase
      .from("chat_conversations")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (cErr) throw cErr;
    if (!conv?.id) {
      return NextResponse.json({ active: false, escalation: null });
    }

    const { data: esc, error: eErr } = await supabase
      .from("fleet_escalations")
      .select("id, status, created_at, resolved_at")
      .eq("conversation_id", conv.id)
      .neq("status", "resolved")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (eErr) throw eErr;

    if (!esc?.id) {
      return NextResponse.json({ active: false, escalation: null });
    }

    return NextResponse.json({
      active: true,
      escalation: esc,
    });
  } catch (e) {
    const errText =
      e instanceof Error
        ? `${e.name}: ${e.message}\n${e.stack ?? ""}`.trim()
        : (() => {
            try {
              return JSON.stringify(e);
            } catch {
              return String(e);
            }
          })();
    console.error(`GET /api/chat/escalation-status:\n${errText}`);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { error: "server_error", ...(isDev ? { debug: errText } : {}) },
      { status: 500 },
    );
  }
}

