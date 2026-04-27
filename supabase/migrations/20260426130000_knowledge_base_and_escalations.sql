-- Knowledge base (RAG) + escalations for "algemene vragen"

create extension if not exists vector;

-- Add optional notification recipients to the single-tenant company profile.
alter table if exists public.company_profile
  add column if not exists claims_email text,
  add column if not exists fleet_manager_email text;

-- ──────────────────────────────────────────────
-- Knowledge base documents + chunks (vector embeddings)
-- ──────────────────────────────────────────────
create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source_type text not null default 'manual' check (source_type in ('manual', 'repo', 'upload', 'url')),
  source_ref text,
  version text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_knowledge_documents_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists knowledge_documents_touch_updated on public.knowledge_documents;
create trigger knowledge_documents_touch_updated
  before update on public.knowledge_documents
  for each row
  execute function public.touch_knowledge_documents_updated_at();

-- Embedding size depends on provider/model. We'll store as vector(1536) for OpenAI text-embedding-3-small.
create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.knowledge_documents (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding vector(1536),
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists knowledge_chunks_document_idx
  on public.knowledge_chunks (document_id, chunk_index);

-- IVFFLAT index for cosine similarity. Requires ANALYZE after ingest for best results.
create index if not exists knowledge_chunks_embedding_ivfflat
  on public.knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ──────────────────────────────────────────────
-- Query logging + escalations
-- ──────────────────────────────────────────────
create table if not exists public.knowledge_queries_log (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.chat_conversations (id) on delete set null,
  user_message_id uuid references public.chat_messages (id) on delete set null,
  query_text text not null,
  retrieved_chunk_ids uuid[] not null default '{}'::uuid[],
  similarity_scores real[] not null default '{}'::real[],
  model text,
  confidence real,
  escalated boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists knowledge_queries_log_created_at
  on public.knowledge_queries_log (created_at desc);

create table if not exists public.fleet_escalations (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references public.chat_conversations (id) on delete set null,
  user_message_id uuid references public.chat_messages (id) on delete set null,
  status text not null default 'queued' check (status in ('queued', 'sending', 'sent', 'failed', 'resolved')),
  assignee_email text,
  subject text,
  body text,
  error text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists fleet_escalations_status_created_at
  on public.fleet_escalations (status, created_at desc);

-- ──────────────────────────────────────────────
-- Vector search helper
-- Returns top_k chunks with similarity score in [0..1] (cosine).
-- ──────────────────────────────────────────────
create or replace function public.kb_match_chunks(
  query_embedding vector(1536),
  top_k int default 8,
  min_similarity real default 0.0
)
returns table (
  chunk_id uuid,
  document_id uuid,
  title text,
  source_ref text,
  chunk_index int,
  content text,
  metadata jsonb,
  similarity real
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    d.id as document_id,
    d.title,
    d.source_ref,
    c.chunk_index,
    c.content,
    c.metadata,
    (1 - (c.embedding <=> query_embedding))::real as similarity
  from public.knowledge_chunks c
  join public.knowledge_documents d on d.id = c.document_id
  where d.active = true
    and c.embedding is not null
    and (1 - (c.embedding <=> query_embedding)) >= min_similarity
  order by c.embedding <=> query_embedding
  limit greatest(top_k, 1);
$$;

-- ──────────────────────────────────────────────
-- RLS
-- - End-users can read none of the KB tables directly (API will use service role).
-- - Fleet managers can be allowed later via dedicated policies.
-- ──────────────────────────────────────────────
alter table public.knowledge_documents enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.knowledge_queries_log enable row level security;
alter table public.fleet_escalations enable row level security;

-- Keep company_profile readable for authenticated (existing policy does select).
-- Ensure columns are readable; no extra grants needed.

drop policy if exists "knowledge_documents_no_access" on public.knowledge_documents;
create policy "knowledge_documents_no_access"
  on public.knowledge_documents
  for all
  to authenticated
  using (false)
  with check (false);

drop policy if exists "knowledge_chunks_no_access" on public.knowledge_chunks;
create policy "knowledge_chunks_no_access"
  on public.knowledge_chunks
  for all
  to authenticated
  using (false)
  with check (false);

-- Logs: allow the user to insert/select only for their own conversation via joins.
drop policy if exists "knowledge_queries_log_own" on public.knowledge_queries_log;
create policy "knowledge_queries_log_own"
  on public.knowledge_queries_log
  for select
  to authenticated
  using (
    conversation_id is not null and exists (
      select 1 from public.chat_conversations c
      where c.id = knowledge_queries_log.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "knowledge_queries_log_insert_own" on public.knowledge_queries_log;
create policy "knowledge_queries_log_insert_own"
  on public.knowledge_queries_log
  for insert
  to authenticated
  with check (
    conversation_id is not null and exists (
      select 1 from public.chat_conversations c
      where c.id = knowledge_queries_log.conversation_id
        and c.user_id = auth.uid()
    )
  );

drop policy if exists "fleet_escalations_own" on public.fleet_escalations;
create policy "fleet_escalations_own"
  on public.fleet_escalations
  for select
  to authenticated
  using (
    conversation_id is not null and exists (
      select 1 from public.chat_conversations c
      where c.id = fleet_escalations.conversation_id
        and c.user_id = auth.uid()
    )
  );

grant select, insert on public.knowledge_queries_log to authenticated;
grant select on public.fleet_escalations to authenticated;

