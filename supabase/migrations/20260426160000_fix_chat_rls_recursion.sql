-- Fix RLS infinite recursion on chat_conversations.
-- Root cause: policy on chat_conversations referenced fleet_escalations, whose RLS policy
-- referenced chat_conversations again → Postgres error 42P17.
--
-- Strategy: use SECURITY DEFINER helper functions to check escalation existence
-- without invoking RLS on fleet_escalations.

-- Ensure the helper exists and bypasses RLS (table owners bypass RLS unless FORCE).
create or replace function public.is_escalated_conversation(conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.fleet_escalations fe
    where fe.conversation_id = is_escalated_conversation.conversation_id
  );
$$;

grant execute on function public.is_escalated_conversation(uuid) to authenticated;

-- Recreate the fleet escalation policies to use the helper.
drop policy if exists "chat_conversations_fleet_escalated_select" on public.chat_conversations;
create policy "chat_conversations_fleet_escalated_select"
  on public.chat_conversations
  for select
  to authenticated
  using (
    public.is_fleet_or_management()
    and public.is_escalated_conversation(chat_conversations.id)
  );

drop policy if exists "chat_messages_fleet_escalated_select" on public.chat_messages;
create policy "chat_messages_fleet_escalated_select"
  on public.chat_messages
  for select
  to authenticated
  using (
    public.is_fleet_or_management()
    and public.is_escalated_conversation(chat_messages.conversation_id)
  );

drop policy if exists "chat_messages_fleet_escalated_insert" on public.chat_messages;
create policy "chat_messages_fleet_escalated_insert"
  on public.chat_messages
  for insert
  to authenticated
  with check (
    public.is_fleet_or_management()
    and role = 'fleet_manager'
    and public.is_escalated_conversation(chat_messages.conversation_id)
  );

