import { NextRequest, NextResponse } from "next/server";
import { requireFleetManagerAccess } from "@/lib/auth/require-fleet-manager";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getOrCreateConversationId } from "@/lib/queries/chat-history";

type Payload = {
  title?: unknown;
  message?: unknown;
};

function normalizeEmail(email: string): string {
  return (email ?? "").trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const auth = await requireFleetManagerAccess();
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.message },
      { status: auth.status },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as Payload;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!title) {
    return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });
  }
  if (!message) {
    return NextResponse.json({ ok: false, error: "message_required" }, { status: 400 });
  }

  const { data: medewerkers, error: medErr } = await admin
    .from("medewerkers")
    .select("emailadres");
  if (medErr) {
    console.error("[broadcast] medewerkers select failed:", medErr);
    return NextResponse.json({ ok: false, error: "medewerkers_load_failed" }, { status: 500 });
  }

  const audienceEmails = Array.from(
    new Set(
      (medewerkers ?? [])
        .map((m: { emailadres?: string | null }) => normalizeEmail(m?.emailadres ?? ""))
        .filter(Boolean),
    ),
  );

  // Build email -> userId map via Auth admin listUsers.
  const emailToUserId = new Map<string, string>();
  let page = 1;
  const perPage = 1000;
  for (let i = 0; i < 50; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("[broadcast] listUsers failed:", error);
      return NextResponse.json({ ok: false, error: "auth_list_failed" }, { status: 500 });
    }
    const users = data?.users ?? [];
    for (const u of users) {
      const e = u.email ? normalizeEmail(u.email) : "";
      if (e && u.id) emailToUserId.set(e, u.id);
    }
    if (users.length < perPage) break;
    page += 1;
  }

  const delivered: string[] = [];
  const skipped: { email: string; reason: string }[] = [];

  for (const email of audienceEmails) {
    const userId = emailToUserId.get(email);
    if (!userId) {
      skipped.push({ email, reason: "no_auth_user" });
      continue;
    }
    try {
      const conversationId = await getOrCreateConversationId(admin, userId);
      const { error: insErr } = await admin.from("chat_messages").insert({
        conversation_id: conversationId,
        role: "fleet_manager",
        content: message,
        attachments: [],
        metadata: {
          sender: "broadcast",
          title,
          sentBy: normalizeEmail(auth.userEmail),
        },
      });
      if (insErr) throw insErr;
      delivered.push(email);
    } catch (e) {
      console.error("[broadcast] deliver failed:", email, e);
      skipped.push({ email, reason: "deliver_failed" });
    }
  }

  return NextResponse.json({
    ok: true,
    audience: { type: "all_medewerkers", count: audienceEmails.length },
    delivered: delivered.length,
    skipped: skipped.length,
    skippedDetails: skipped.slice(0, 50),
  });
}

