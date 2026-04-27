import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { requireFleetManagerAccess } from "@/lib/auth/require-fleet-manager";

function chatAttachmentsBucket(): string {
  return (
    process.env.NEXT_PUBLIC_CHAT_ATTACHMENTS_BUCKET ||
    process.env.CHAT_ATTACHMENTS_BUCKET ||
    "chat-attachments"
  );
}

async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

  const target = email.trim().toLowerCase();
  if (!target) return null;

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

async function resolveEmailByUserId(userId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  const id = (userId ?? "").trim();
  if (!id) return null;
  try {
    // @supabase/supabase-js exposes this in recent versions.
    // If unavailable, we just won't be able to purge email-scoped fleet artifacts.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyAdmin = admin as any;
    if (typeof anyAdmin?.auth?.admin?.getUserById !== "function") return null;
    const { data, error } = await anyAdmin.auth.admin.getUserById(id);
    if (error) return null;
    const email = typeof data?.user?.email === "string" ? data.user.email.trim() : "";
    return email ? email : null;
  } catch {
    return null;
  }
}

async function deleteAllStorageUnderPrefix(params: {
  bucket: string;
  prefix: string; // must end with /
}) {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");

  const folders: string[] = [params.prefix];
  const files: string[] = [];

  for (let guard = 0; guard < 5000; guard++) {
    const folder = folders.pop();
    if (!folder) break;

    const { data: objects, error: listErr } = await admin.storage
      .from(params.bucket)
      .list(folder, { limit: 1000, offset: 0 });
    if (listErr) {
      return {
        deleted: 0,
        bucket: params.bucket,
        prefix: params.prefix,
        skipped: true,
        error: listErr.message,
      };
    }

    for (const o of (objects ?? []) as Array<{
      name?: unknown;
      id?: unknown;
      metadata?: unknown;
    }>) {
      const name = typeof o?.name === "string" ? o.name : "";
      if (!name) continue;
      const isFolder = !o?.id && !o?.metadata;
      if (isFolder) {
        folders.push(`${folder}${name}/`);
      } else {
        files.push(`${folder}${name}`);
      }
    }
  }

  if (files.length === 0) {
    return {
      deleted: 0,
      bucket: params.bucket,
      prefix: params.prefix,
      skipped: false,
    };
  }

  let deleted = 0;
  for (let i = 0; i < files.length; i += 200) {
    const batch = files.slice(i, i + 200);
    const { error: delErr } = await admin.storage.from(params.bucket).remove(batch);
    if (delErr) {
      return {
        deleted,
        bucket: params.bucket,
        prefix: params.prefix,
        skipped: true,
        error: delErr.message,
      };
    }
    deleted += batch.length;
  }

  return { deleted, bucket: params.bucket, prefix: params.prefix, skipped: false };
}

export async function POST(request: NextRequest) {
  const access = await requireFleetManagerAccess();
  if (!access.ok) {
    return NextResponse.json(
      { ok: false, error: access.message },
      { status: access.status },
    );
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const emailIn = typeof body?.email === "string" ? body.email.trim() : "";
    const userIdIn = typeof body?.userId === "string" ? body.userId.trim() : "";

    let userId = userIdIn;
    if (!userId && emailIn) {
      const resolved = await resolveUserIdByEmail(emailIn);
      if (resolved) userId = resolved;
    }

    if (!userId) {
      return NextResponse.json(
        { ok: false, error: "Provide email or userId" },
        { status: 400 },
      );
    }

    // We use email only to delete the user's own escalation rows that became orphaned.
    const targetEmail =
      (emailIn || (await resolveEmailByUserId(userId)) || "").trim().toLowerCase();

    // Chat conversations (messages cascade).
    const { data: convs, error: selConvErr } = await admin
      .from("chat_conversations")
      .select("id")
      .eq("user_id", userId);
    if (selConvErr) throw selConvErr;
    const conversationIds = (convs ?? []).map((c) => c.id);

    // Fleet manager inbox uses `fleet_escalations`. FK is ON DELETE SET NULL,
    // so deleting conversations alone does not remove escalation rows.
    // We delete:
    // - escalations linked to this user's conversations
    // - escalations that mention the user's email in subject/body (covers orphans when conversation_id is already NULL)
    if (conversationIds.length > 0) {
      const { error: delEscByConvErr } = await admin
        .from("fleet_escalations")
        .delete()
        .in("conversation_id", conversationIds);
      if (delEscByConvErr) throw delEscByConvErr;

      const { error: delLogErr } = await admin
        .from("knowledge_queries_log")
        .delete()
        .in("conversation_id", conversationIds);
      if (delLogErr) throw delLogErr;
    }

    if (targetEmail) {
      const likeSubject = `%${targetEmail}%`;
      const likeBody = `%Medewerker:%${targetEmail}%`;
      const { error: delEscByEmailErr } = await admin
        .from("fleet_escalations")
        .delete()
        .or(`subject.ilike.${likeSubject},body.ilike.${likeBody}`);
      if (delEscByEmailErr) throw delEscByEmailErr;
    }

    const { error: delConvErr } = await admin
      .from("chat_conversations")
      .delete()
      .eq("user_id", userId);
    if (delConvErr) throw delConvErr;

    const chatAttachments = await deleteAllStorageUnderPrefix({
      bucket: chatAttachmentsBucket(),
      prefix: `${userId}/`,
    });

    // Delete owned accident reports.
    const { data: ownedReports, error: selOwnedErr } = await admin
      .from("ongeval_aangiften")
      .select("id")
      .eq("user_id", userId);
    if (selOwnedErr) throw selOwnedErr;
    const ownedReportIds = (ownedReports ?? []).map((r) => r.id);

    const { error: delOwnedErr } = await admin
      .from("ongeval_aangiften")
      .delete()
      .eq("user_id", userId);
    if (delOwnedErr) throw delOwnedErr;

    const ongevalScans = await deleteAllStorageUnderPrefix({
      bucket: "ongeval-scans",
      prefix: `${userId}/`,
    });

    return NextResponse.json({
      ok: true,
      by: access.userEmail,
      userId,
      deleted: {
        chat: {
          conversations: conversationIds.length,
          messages: "cascade",
          attachments: chatAttachments,
        },
        ongeval: {
          ownedReports: ownedReportIds.length,
          scans: ongevalScans,
        },
      },
    });
  } catch (err) {
    console.error("[purge-user-data] Error:", err);
    return NextResponse.json({ ok: false, error: "server_error" }, { status: 500 });
  }
}

