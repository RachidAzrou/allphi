-- ─────────────────────────────────────────────────────────────────────────────
-- Hybrid search for kb_chunks: vector (pgvector) + full-text (tsvector)
-- combined with Reciprocal Rank Fusion (RRF).
--
-- Why: vector search alone misses exact keyword matches (e.g. "buurman",
-- "rookverbod") when the query phrasing differs from the chunk. FTS catches
-- these; RRF merges both ranked lists without needing score normalisation.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add a generated tsvector column to kb_chunks (Dutch text config).
--    GENERATED ALWAYS AS ... STORED keeps it in sync automatically.
alter table public.kb_chunks
  add column if not exists fts tsvector
    generated always as (to_tsvector('dutch', coalesce(content, ''))) stored;

-- 2. GIN index so FTS queries don't do full-table scans.
create index if not exists kb_chunks_fts_gin
  on public.kb_chunks using gin (fts);

-- 3. Hybrid search function using RRF.
--    rrf_k = 60 is the standard constant (from the original RRF paper).
--    Candidates are oversampled (match_count * 4) before merging so the
--    fusion has enough material from each side.
create or replace function public.match_kb_chunks_hybrid(
  query_embedding  vector(1536),
  query_text       text,
  match_count      int     default 6,
  rrf_k            int     default 60
)
returns table (
  chunk_id     uuid,
  source_slug  text,
  source_title text,
  source_path  text,
  doc_type     text,
  priority     int,
  chunk_index  int,
  content      text,
  metadata     jsonb,
  similarity   float,
  rrf_score    float
)
language sql
stable
as $$
  with
  -- ── Vector leg ──────────────────────────────────────────────────────────
  vec as (
    select
      c.id,
      row_number() over (order by c.embedding <=> query_embedding) as rnk,
      (1 - (c.embedding <=> query_embedding))::float                as sim
    from public.kb_chunks c
    where c.embedding is not null
    limit greatest(match_count, 1) * 4
  ),
  -- ── Full-text leg ────────────────────────────────────────────────────────
  fts as (
    select
      c.id,
      row_number() over (
        order by ts_rank_cd(c.fts, websearch_to_tsquery('dutch', query_text)) desc
      ) as rnk
    from public.kb_chunks c
    where c.fts @@ websearch_to_tsquery('dutch', query_text)
    limit greatest(match_count, 1) * 4
  ),
  -- ── Reciprocal Rank Fusion ───────────────────────────────────────────────
  rrf as (
    select
      coalesce(v.id, f.id)                                          as id,
      coalesce(1.0 / (rrf_k + v.rnk), 0.0)
        + coalesce(1.0 / (rrf_k + f.rnk), 0.0)                     as score,
      coalesce(v.sim, 0.0)                                          as sim
    from vec v
    full outer join fts f on f.id = v.id
  )
  select
    c.id                                    as chunk_id,
    s.slug                                  as source_slug,
    s.title                                 as source_title,
    s.source_path                           as source_path,
    s.doc_type                              as doc_type,
    s.priority                              as priority,
    c.chunk_index                           as chunk_index,
    c.content                               as content,
    c.metadata                              as metadata,
    rrf.sim                                 as similarity,
    rrf.score                               as rrf_score
  from rrf
  join public.kb_chunks  c on c.id = rrf.id
  join public.kb_sources s on s.id = c.source_id
  order by rrf.score desc, s.priority desc
  limit greatest(match_count, 1);
$$;

grant execute on function public.match_kb_chunks_hybrid(vector(1536), text, int, int)
  to authenticated, service_role;
