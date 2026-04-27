import OpenAI from "openai";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

export type KnowledgeChunkHit = {
  chunk_id: string;
  document_id: string;
  title: string;
  source_ref: string | null;
  chunk_index: number;
  content: string;
  metadata: unknown;
  similarity: number;
};

function getOpenAI(): { openai: OpenAI; embeddingModel: string } | null {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";
  return { openai: new OpenAI({ apiKey }), embeddingModel };
}

export async function retrieveKbChunks(params: {
  query: string;
  topK?: number;
  minSimilarity?: number;
}): Promise<{ hits: KnowledgeChunkHit[]; embeddingModel: string } | null> {
  const svc = createServiceRoleClient();
  const oai = getOpenAI();
  if (!svc || !oai) return null;

  const queryText = params.query.trim();
  if (!queryText) return { hits: [], embeddingModel: oai.embeddingModel };

  const emb = await oai.openai.embeddings.create({
    model: oai.embeddingModel,
    input: queryText,
  });
  const vec = emb.data[0]?.embedding;
  if (!vec) return { hits: [], embeddingModel: oai.embeddingModel };

  const { data, error } = await svc.rpc("kb_match_chunks", {
    query_embedding: vec,
    top_k: Math.max(1, Math.min(20, params.topK ?? 8)),
    min_similarity: Math.max(0, Math.min(1, params.minSimilarity ?? 0.2)),
  });
  if (error) throw error;

  const hits = Array.isArray(data) ? (data as KnowledgeChunkHit[]) : [];
  return { hits, embeddingModel: oai.embeddingModel };
}

