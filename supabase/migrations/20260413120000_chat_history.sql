-- Persistent chat per authenticated user (one conversation per user).
-- Run in Supabase SQL editor or via supabase db push.

create table if not exists public.chat_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chat_conversations_one_per_user unique (user_id)
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.chat_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  attachments jsonb not null default '[]'::jsonb,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_conversation_created_at
  on public.chat_messages (conversation_id, created_at);

create or replace function public.touch_chat_conversation_updated_at()
returns trigger
language plpgsql
as $$
begin
  update public.chat_conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists chat_messages_touch_conversation on public.chat_messages;
create trigger chat_messages_touch_conversation
  after insert on public.chat_messages
  for each row
  execute function public.touch_chat_conversation_updated_at();

alter table public.chat_conversations enable row level security;
alter table public.chat_messages enable row level security;

drop policy if exists "chat_conversations_own" on public.chat_conversations;
create policy "chat_conversations_own"
  on public.chat_conversations
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "chat_messages_own" on public.chat_messages;
create policy "chat_messages_own"
  on public.chat_messages
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.chat_conversations c
      where c.id = chat_messages.conversation_id
        and c.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on table public.chat_conversations to authenticated;
grant select, insert, update, delete on table public.chat_messages to authenticated;
