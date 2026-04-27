import OpenAI from "openai";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import type { SupabaseClient } from "@supabase/supabase-js";

// ─── Dutch language detection (heuristic) ────────────────────────────────────
// Common Dutch function words. If >4% of words match, we consider it Dutch.
const DUTCH_MARKERS =
  /\b(de|het|een|van|voor|met|zijn|dat|niet|maar|ook|als|dit|door|bij|uit|aan|op|er|we|je|ik|ze|hij|zij|naar|om|nog|al|zo|dan|nu|wel|had|heeft|worden|kunnen|moet|meer|geen|alle|werd|wordt|heeft|hebben)\b/gi;

function isDutch(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 10) return true; // too short to judge → assume OK
  const hits = (text.match(DUTCH_MARKERS) ?? []).length;
  return hits / words.length > 0.04;
}

/**
 * Translates a single chunk to Dutch using GPT-4o-mini.
 * Only called when the heuristic detects a non-Dutch language.
 * Returns { text, translated } — translated=false means the original was kept.
 */
async function ensureDutch(
  openai: OpenAI,
  text: string,
): Promise<{ text: string; translated: boolean }> {
  if (isDutch(text)) return { text, translated: false };

  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      max_tokens: 2048,
      messages: [
        {
          role: "system",
          content:
            "Vertaal de volgende tekst naar het Nederlands. " +
            "Behoud de structuur, opmaak en alle specifieke termen (bedragen, data, namen). " +
            "Geef uitsluitend de vertaling terug — geen uitleg, geen commentaar.",
        },
        { role: "user", content: text },
      ],
    });
    const translated = res.choices[0]?.message?.content?.trim();
    if (translated) return { text: translated, translated: true };
  } catch (e) {
    console.warn("[ingest] Translation failed, keeping original:", e);
  }
  return { text, translated: false };
}

export type IngestChunk = {
  content: string;
  embedding: number[];
  chunk_index: number;
  metadata: Record<string, unknown>;
};

export function sanitizeTextForDb(input: string): string {
  return String(input ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
}

export function chunkText(params: {
  text: string;
  chunkChars?: number;
  chunkOverlap?: number;
}): string[] {
  const chunkChars = Math.max(400, Math.min(8000, params.chunkChars ?? 2200));
  const chunkOverlap = Math.max(0, Math.min(2000, params.chunkOverlap ?? 250));
  const t = sanitizeTextForDb(params.text);
  if (!t) return [];

  const chunks: string[] = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + chunkChars);
    chunks.push(t.slice(i, end).trim());
    if (end >= t.length) break;
    i = Math.max(0, end - chunkOverlap);
  }
  return chunks.filter(Boolean);
}

export async function extractTextFromPdfBytes(bytes: Uint8Array): Promise<string> {
  const doc = await (pdfjs as any).getDocument({
    data: bytes,
    disableWorker: true,
  }).promise;
  const lines: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items ?? [])
      .map((it: any) => (typeof it?.str === "string" ? it.str : ""))
      .filter(Boolean)
      .join(" ");
    lines.push(pageText);
  }
  return sanitizeTextForDb(lines.join("\n\n"));
}

export async function extractTextFromDocxBytes(bytes: Uint8Array): Promise<string> {
  const buf = Buffer.from(bytes);
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return sanitizeTextForDb(String(value ?? ""));
}

export async function extractTextFromBytes(params: {
  bytes: Uint8Array;
  filename: string;
  mime?: string | null;
}): Promise<string> {
  const name = params.filename.toLowerCase();
  if (name.endsWith(".pdf") || params.mime === "application/pdf") {
    return extractTextFromPdfBytes(params.bytes);
  }
  if (
    name.endsWith(".docx") ||
    params.mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractTextFromDocxBytes(params.bytes);
  }
  // Fallback: assume UTF-8 text
  return sanitizeTextForDb(Buffer.from(params.bytes).toString("utf8"));
}

export async function ingestKnowledgeDocument(params: {
  supabase: SupabaseClient;
  openaiApiKey: string;
  embeddingModel?: string;
  title: string;
  source_type: "upload" | "repo" | "manual" | "url";
  source_ref?: string | null;
  bytes: Uint8Array;
  filename: string;
  mime?: string | null;
  chunkChars?: number;
  chunkOverlap?: number;
}): Promise<{ documentId: string; chunkCount: number }> {
  const openai = new OpenAI({ apiKey: params.openaiApiKey });
  const embeddingModel = params.embeddingModel?.trim() || "text-embedding-3-small";

  const text = await extractTextFromBytes({
    bytes: params.bytes,
    filename: params.filename,
    mime: params.mime ?? null,
  });

  const chunks = chunkText({
    text,
    chunkChars: params.chunkChars,
    chunkOverlap: params.chunkOverlap,
  });
  if (chunks.length === 0) {
    throw new Error("empty_document");
  }

  const { data: docRow, error: docErr } = await params.supabase
    .from("knowledge_documents")
    .insert({
      title: params.title,
      source_type: params.source_type,
      source_ref: params.source_ref ?? null,
      active: true,
    })
    .select("id")
    .single();
  if (docErr) throw docErr;

  const documentId = String((docRow as any).id);

  // ─── Translate chunks to Dutch at index time ──────────────────────────────
  // Ensures Dutch queries match even when source documents are in English.
  // text-embedding-3-small degrades on cross-lingual domain terms (e.g.
  // "tijdskrediet" vs "career break"), so we embed Dutch content exclusively.
  const dutchChunks: string[] = [];
  const translatedFlags: boolean[] = [];
  for (const chunk of chunks) {
    const { text: dutchText, translated } = await ensureDutch(openai, chunk);
    dutchChunks.push(dutchText);
    translatedFlags.push(translated);
  }

  const batchSize = 64;
  const allEmbeddings: number[][] = [];
  for (let i = 0; i < dutchChunks.length; i += batchSize) {
    const batch = dutchChunks.slice(i, i + batchSize);
    const emb = await openai.embeddings.create({
      model: embeddingModel,
      input: batch,
    });
    allEmbeddings.push(...(emb.data ?? []).map((d) => d.embedding));
  }

  const rows = dutchChunks.map((content, idx) => ({
    document_id: documentId,
    chunk_index: idx,
    content,
    metadata: {
      filename: params.filename,
      mime: params.mime ?? null,
      chunkChars: params.chunkChars ?? 2200,
      chunkOverlap: params.chunkOverlap ?? 250,
      embeddingModel,
      ...(translatedFlags[idx]
        ? { translated: true, originalContent: chunks[idx] }
        : {}),
    },
    embedding: allEmbeddings[idx],
  }));

  const { error: chunkErr } = await params.supabase.from("knowledge_chunks").insert(rows);
  if (chunkErr) throw chunkErr;

  return { documentId, chunkCount: chunks.length };
}

