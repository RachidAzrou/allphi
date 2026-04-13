import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchChatMessagesForUser } from "@/lib/queries/chat-history";

/**
 * Loads persisted chat for the authenticated user.
 * Runs on the server so attachment signing can use SUPABASE_SERVICE_ROLE_KEY.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
    }

    const messages = await fetchChatMessagesForUser(supabase, user.id);

    return NextResponse.json({
      messages: messages.map((m) => ({
        ...m,
        timestamp: m.timestamp.toISOString(),
      })),
    });
  } catch (e) {
    console.error("GET /api/chat/messages:", e);
    return NextResponse.json(
      { error: "Kon berichten niet laden." },
      { status: 500 },
    );
  }
}
