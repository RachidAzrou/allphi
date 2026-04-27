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
    console.error(`GET /api/chat/messages:\n${errText}`);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      { error: "Kon berichten niet laden.", ...(isDev ? { debug: errText } : {}) },
      { status: 500 },
    );
  }
}
