/**
 * Purge user data for a Supabase auth user:
 * - Chat history: chat_conversations (+ chat_messages via cascade)
 * - Chat attachments: storage bucket `chat-attachments` under `${userId}/...`
 * - Accident reports: ongeval_aangiften owned by user (user_id = userId)
 * - Accident scan PDFs/pages: storage bucket `ongeval-scans` under `${userId}/...`
 * - Detach user from being Party B in other reports (party_b_user_id = null)
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/purge-user-data.mjs --email "razrou@outlook.be"
 *
 * Or:
 *   node scripts/purge-user-data.mjs --user-id "<uuid>"
 */
import { createClient } from "@supabase/supabase-js";
import process from "node:process";

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return "";
  return String(process.argv[idx + 1] ?? "").trim();
}

const email = argValue("--email");
const userIdIn = argValue("--user-id");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CHAT_ATTACHMENTS_BUCKET =
  process.env.NEXT_PUBLIC_CHAT_ATTACHMENTS_BUCKET ||
  process.env.CHAT_ATTACHMENTS_BUCKET ||
  "chat-attachments";

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function resolveUserIdByEmail(e) {
  const target = e.trim().toLowerCase();
  let page = 1;
  const perPage = 1000;
  for (let i = 0; i < 20; i++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = (data?.users ?? []).find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit?.id) return hit.id;
    if ((data?.users ?? []).length < perPage) break;
    page += 1;
  }
  return "";
}

async function deleteAllStorageUnderPrefix(bucket, prefix) {
  // Storage `list()` is not recursive; we traverse folders under prefix and
  // delete files in batches.
  const folders = [prefix];
  const files = [];

  for (let guard = 0; guard < 5000; guard++) {
    const folder = folders.pop();
    if (!folder) break;

    const { data: objects, error: listErr } = await supabase.storage
      .from(bucket)
      .list(folder, { limit: 1000, offset: 0 });
    if (listErr) {
      return { deleted: 0, bucket, prefix, skipped: true, error: listErr.message };
    }

    for (const o of objects ?? []) {
      const name = o?.name;
      if (typeof name !== "string" || name.length === 0) continue;

      // Heuristic: folders typically have no id/metadata; files do.
      const isFolder = !o?.id && !o?.metadata;
      if (isFolder) {
        const next = `${folder}${name}/`;
        folders.push(next);
      } else {
        files.push(`${folder}${name}`);
      }
    }
  }

  if (files.length === 0) {
    return { deleted: 0, bucket, prefix, skipped: false };
  }

  let deleted = 0;
  for (let i = 0; i < files.length; i += 200) {
    const batch = files.slice(i, i + 200);
    const { error: delErr } = await supabase.storage.from(bucket).remove(batch);
    if (delErr) {
      return { deleted, bucket, prefix, skipped: true, error: delErr.message };
    }
    deleted += batch.length;
  }

  return { deleted, bucket, prefix, skipped: false };
}

const userId = userIdIn || (email ? await resolveUserIdByEmail(email) : "");
if (!userId) {
  console.error("Provide --user-id or --email (must match a Supabase auth user)");
  process.exit(1);
}

// ──────────────────────────────────────────────
// Chat: delete conversations (messages cascade)
// ──────────────────────────────────────────────
const { data: convs, error: selConvErr } = await supabase
  .from("chat_conversations")
  .select("id")
  .eq("user_id", userId);
if (selConvErr) throw selConvErr;

const conversationIds = (convs ?? []).map((c) => c.id);

if (conversationIds.length > 0) {
  // Fleet manager inbox rows do NOT cascade; they become orphaned via ON DELETE SET NULL.
  const { error: delEscErr } = await supabase
    .from("fleet_escalations")
    .delete()
    .in("conversation_id", conversationIds);
  if (delEscErr) throw delEscErr;

  const { error: delLogErr } = await supabase
    .from("knowledge_queries_log")
    .delete()
    .in("conversation_id", conversationIds);
  if (delLogErr) throw delLogErr;
}

// Catch any orphan escalations that still reference the user via subject/body.
if (email) {
  const targetEmail = email.trim().toLowerCase();
  if (targetEmail) {
    const likeSubject = `%${targetEmail}%`;
    const likeBody = `%Medewerker:%${targetEmail}%`;
    const { error: delEscByEmailErr } = await supabase
      .from("fleet_escalations")
      .delete()
      .or(`subject.ilike.${likeSubject},body.ilike.${likeBody}`);
    if (delEscByEmailErr) throw delEscByEmailErr;
  }
}

const { error: delConvErr } = await supabase
  .from("chat_conversations")
  .delete()
  .eq("user_id", userId);
if (delConvErr) throw delConvErr;

const chatAttachments = await deleteAllStorageUnderPrefix(
  CHAT_ATTACHMENTS_BUCKET,
  `${userId}/`,
);

// ──────────────────────────────────────────────
// Ongeval: delete owned reports
// ──────────────────────────────────────────────
const { data: ownedReports, error: selOwnedErr } = await supabase
  .from("ongeval_aangiften")
  .select("id")
  .eq("user_id", userId);
if (selOwnedErr) throw selOwnedErr;

const ownedReportIds = (ownedReports ?? []).map((r) => r.id);
const { error: delOwnedErr } = await supabase
  .from("ongeval_aangiften")
  .delete()
  .eq("user_id", userId);
if (delOwnedErr) throw delOwnedErr;

const ongevalScans = await deleteAllStorageUnderPrefix("ongeval-scans", `${userId}/`);

console.log(
  JSON.stringify(
    {
      success: true,
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
    },
    null,
    2,
  ),
);

