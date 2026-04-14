/**
 * Purge chat history (and attachments) for a Supabase user.
 *
 * Usage:
 *   ADMIN_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *   node scripts/purge-user-chat.mjs --email "user@example.com"
 *
 * Or:
 *   node scripts/purge-user-chat.mjs --user-id "<uuid>"
 */
import { createClient } from "@supabase/supabase-js";

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return "";
  return String(process.argv[idx + 1] ?? "").trim();
}

const email = argValue("--email");
const userIdIn = argValue("--user-id");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

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

const userId = userIdIn || (email ? await resolveUserIdByEmail(email) : "");
if (!userId) {
  console.error("Provide --user-id or --email (must match a Supabase auth user)");
  process.exit(1);
}

const { data: convs, error: selErr } = await supabase
  .from("chat_conversations")
  .select("id")
  .eq("user_id", userId);
if (selErr) throw selErr;

const conversationIds = (convs ?? []).map((c) => c.id);

const { error: delErr } = await supabase
  .from("chat_conversations")
  .delete()
  .eq("user_id", userId);
if (delErr) throw delErr;

console.log(JSON.stringify({ success: true, userId, deletedConversations: conversationIds.length }, null, 2));

