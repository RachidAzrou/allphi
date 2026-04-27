-- Knowledge base (RAG) for Fleet documents using pgvector.
-- Requires: pgcrypto (gen_random_uuid) + vector extension.

create extension if not exists pgcrypto;
create extension if not exists vector;

-- Sources: one row per document.
create table if not exists public.kb_sources (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  source_path text not null,
  doc_type text not null check (doc_type in ('policy', 'handbook')),
  language text not null default 'nl',
  priority int not null default 0,
  updated_at timestamptz not null default now()
);

-- Chunks: chunked text with embeddings.
-- We use OpenAI text-embedding-3-small (1536 dims) by default.
create table if not exists public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.kb_sources (id) on delete cascade,
  chunk_index int not null,
  content text not null,
  tokens_estimate int,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kb_chunks_source_chunk_unique unique (source_id, chunk_index)
);

create index if not exists kb_chunks_source_id on public.kb_chunks (source_id);

-- Vector index for cosine similarity search.
-- Note: ivfflat requires data volume; still fine for small KBs.
create index if not exists kb_chunks_embedding_ivfflat
  on public.kb_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.touch_kb_chunks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kb_chunks_touch_updated_at on public.kb_chunks;
create trigger kb_chunks_touch_updated_at
  before update on public.kb_chunks
  for each row
  execute function public.touch_kb_chunks_updated_at();

alter table public.kb_sources enable row level security;
alter table public.kb_chunks enable row level security;

-- Authenticated users may read KB.
drop policy if exists "kb_sources_select_authenticated" on public.kb_sources;
create policy "kb_sources_select_authenticated"
  on public.kb_sources
  for select
  to authenticated
  using (true);

drop policy if exists "kb_chunks_select_authenticated" on public.kb_chunks;
create policy "kb_chunks_select_authenticated"
  on public.kb_chunks
  for select
  to authenticated
  using (true);

-- Only service_role can write KB (ingestion).
drop policy if exists "kb_sources_write_service_role" on public.kb_sources;
create policy "kb_sources_write_service_role"
  on public.kb_sources
  for all
  to service_role
  using (true)
  with check (true);

drop policy if exists "kb_chunks_write_service_role" on public.kb_chunks;
create policy "kb_chunks_write_service_role"
  on public.kb_chunks
  for all
  to service_role
  using (true)
  with check (true);

grant select on table public.kb_sources to authenticated;
grant select on table public.kb_chunks to authenticated;
grant all on table public.kb_sources to service_role;
grant all on table public.kb_chunks to service_role;

-- Similarity search RPC.
-- Returns chunks with source metadata and a similarity score.
create or replace function public.match_kb_chunks(
  query_embedding vector(1536),
  match_count int,
  filter jsonb default null
)
returns table (
  chunk_id uuid,
  source_slug text,
  source_title text,
  source_path text,
  doc_type text,
  priority int,
  chunk_index int,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    c.id as chunk_id,
    s.slug as source_slug,
    s.title as source_title,
    s.source_path as source_path,
    s.doc_type as doc_type,
    s.priority as priority,
    c.chunk_index as chunk_index,
    c.content as content,
    c.metadata as metadata,
    (1 - (c.embedding <=> query_embedding))::float as similarity
  from public.kb_chunks c
  join public.kb_sources s on s.id = c.source_id
  where
    c.embedding is not null
    and (
      filter is null
      or (
        (filter ? 'source_slugs') is false
        or s.slug = any(select jsonb_array_elements_text(filter->'source_slugs'))
      )
    )
  order by
    (1 - (c.embedding <=> query_embedding)) desc,
    s.priority desc
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_kb_chunks(vector(1536), int, jsonb) to authenticated;
