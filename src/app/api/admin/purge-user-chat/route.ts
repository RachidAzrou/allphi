import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { CHAT_ATTACHMENTS_BUCKET } from "@/lib/chat/attachment-limits";

function assertAdmin(request: NextRequest): string | null {
  const expected = process.env.ADMIN_API_KEY;
  if (!expected) return "ADMIN_API_KEY is not set";
  const got = request.headers.get("x-admin-key");
  if (!got || got !== expected) return "Invalid admin key";
  return null;
}

async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

  const target = email.trim().toLowerCase();
  if (!target) return null;

  // Walk pages to find the user by email.
  let page = 1;
  const perPage = 1000;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit?.id) return hit.id;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

async function deleteAllChatAttachmentsForUser(userId: string) {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

  const bucket = CHAT_ATTACHMENTS_BUCKET;
  const prefix = `${userId}/`;

  // Storage list is paged; keep listing until no items remain.
  // We only remove objects under the user's prefix.
  for (let i = 0; i < 200; i++) {
    const { data: objects, error: listErr } = await admin.storage
      .from(bucket)
      .list(prefix, { limit: 1000, offset: 0 });
    if (listErr) {
      // If bucket doesn't exist or listing is forbidden, don't block DB deletion.
      console.error("[purge-user-chat] Storage list error:", listErr.message);
      return { deleted: 0, bucket, skipped: true };
    }
    const names = (objects ?? [])
      .map((o) => o?.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);

    if (names.length === 0) return { deleted: 0, bucket, skipped: false };

    const paths = names.map((n) => `${prefix}${n}`);
    const { error: delErr } = await admin.storage.from(bucket).remove(paths);
    if (delErr) {
      console.error("[purge-user-chat] Storage remove error:", delErr.message);
      return { deleted: 0, bucket, skipped: true };
    }
  }

  return { deleted: 0, bucket, skipped: true };
}

export async function POST(request: NextRequest) {
  const adminErr = assertAdmin(request);
  if (adminErr) {
    return NextResponse.json({ error: adminErr }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const userIdIn = typeof body?.userId === "string" ? body.userId.trim() : "";
    const emailIn = typeof body?.email === "string" ? body.email.trim() : "";

    let userId = userIdIn;
    if (!userId && emailIn) {
      const resolved = await resolveUserIdByEmail(emailIn);
      if (resolved) userId = resolved;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Provide userId or email" },
        { status: 400 },
      );
    }

    const admin = createServiceRoleClient();
    if (!admin) {
      return NextResponse.json(
        { error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
        { status: 500 },
      );
    }

    // Delete conversation(s); messages cascade via FK.
    const { data: convs, error: selErr } = await admin
      .from("chat_conversations")
      .select("id")
      .eq("user_id", userId);
    if (selErr) throw selErr;

    const conversationIds = (convs ?? []).map((c) => c.id);

    const { error: delErr } = await admin
      .from("chat_conversations")
      .delete()
      .eq("user_id", userId);
    if (delErr) throw delErr;

    const attachments = await deleteAllChatAttachmentsForUser(userId);

    return NextResponse.json({
      success: true,
      userId,
      deleted: {
        conversations: conversationIds.length,
        messages: "cascade",
        attachments,
      },
    });
  } catch (err) {
    console.error("[purge-user-chat] Error:", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

