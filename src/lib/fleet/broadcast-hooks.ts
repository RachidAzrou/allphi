/**
 * Broadcast messaging is intentionally a separate feature.
 *
 * This file defines minimal types + suggested data model hooks so we can
 * implement it later without refactoring the fleetmanager inbox/reply flow.
 */

export type BroadcastAudience =
  | { type: "all_medewerkers" }
  | { type: "medewerker_ids"; ids: string[] }
  | { type: "emails"; emails: string[] };

export type BroadcastStatus = "draft" | "scheduled" | "sent" | "cancelled";

export interface BroadcastDraft {
  title: string;
  message: string;
  audience: BroadcastAudience;
  sendAt?: string | null; // ISO timestamp
}

/**
 * Future DB tables (proposal):
 * - public.manager_broadcasts(id uuid, created_by uuid, title text, message text, audience jsonb, status text, send_at timestamptz, created_at timestamptz)
 * - public.manager_broadcast_recipients(broadcast_id uuid, user_id uuid null, email text null, delivered_at timestamptz, read_at timestamptz)
 *
 * Delivery mechanism (proposal):
 * - Create or reuse per-user `chat_conversations`
 * - Insert `chat_messages.role='fleet_manager'` with metadata.sender='broadcast'
 */

export function validateBroadcastDraft(draft: BroadcastDraft): string | null {
  if (!draft.title.trim()) return "title_required";
  if (!draft.message.trim()) return "message_required";
  if (draft.audience.type === "medewerker_ids" && draft.audience.ids.length === 0)
    return "audience_required";
  if (draft.audience.type === "emails" && draft.audience.emails.length === 0)
    return "audience_required";
  return null;
}

