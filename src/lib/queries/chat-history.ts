import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChatMessage, ChatResponse } from "@/types/chat";
import { signStoredAttachments } from "@/lib/chat/sign-attachments";

export interface StoredChatAttachment {
  bucket: string;
  path: string;
  name: string;
  mime: string;
}

export async function getOrCreateConversationId(
  supabase: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: existing, error: selErr } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const { data: created, error: insErr } = await supabase
    .from("chat_conversations")
    .insert({ user_id: userId })
    .select("id")
    .single();

  if (insErr) throw insErr;
  return created.id;
}

interface ChatMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments: StoredChatAttachment[] | null;
  metadata: AssistantMsgMeta | null;
  created_at: string;
}

interface AssistantMsgMeta {
  intent?: ChatMessage["intent"];
  title?: string;
  cards?: ChatMessage["cards"];
  suggestions?: string[];
  cta?: ChatMessage["cta"];
}

export async function fetchChatMessagesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<ChatMessage[]> {
  const { data: conv, error: cErr } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (cErr) throw cErr;
  if (!conv?.id) return [];

  const { data: rows, error: mErr } = await supabase
    .from("chat_messages")
    .select("id, role, content, attachments, metadata, created_at")
    .eq("conversation_id", conv.id)
    .order("created_at", { ascending: true });

  if (mErr) throw mErr;
  if (!rows?.length) return [];

  const out: ChatMessage[] = [];
  for (const row of rows as ChatMessageRow[]) {
    if (row.role === "user") {
      const raw = Array.isArray(row.attachments) ? row.attachments : [];
      const attachments = await signStoredAttachments(supabase, raw);
      out.push({
        id: row.id,
        role: "user",
        content: row.content,
        timestamp: new Date(row.created_at),
        attachments: attachments.length ? attachments : undefined,
      });
    } else {
      const meta = row.metadata as AssistantMsgMeta | null;
      out.push({
        id: row.id,
        role: "assistant",
        content: row.content,
        timestamp: new Date(row.created_at),
        intent: meta?.intent,
        title: meta?.title,
        cards: meta?.cards,
        suggestions: meta?.suggestions,
        cta: meta?.cta,
      });
    }
  }

  return out;
}

export async function insertUserMessage(
  supabase: SupabaseClient,
  conversationId: string,
  content: string,
  attachments: StoredChatAttachment[],
): Promise<string> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      conversation_id: conversationId,
      role: "user",
      content,
      attachments: attachments.length ? attachments : [],
      metadata: null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function insertAssistantMessage(
  supabase: SupabaseClient,
  conversationId: string,
  result: ChatResponse,
): Promise<void> {
  const { error } = await supabase.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "assistant",
    content: result.message,
    attachments: [],
    metadata: {
      intent: result.intent,
      title: result.title,
      cards: result.cards,
      suggestions: result.suggestions,
      cta: result.cta,
    },
  });
  if (error) throw error;
}
