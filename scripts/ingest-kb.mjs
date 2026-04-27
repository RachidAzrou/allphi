// Ingest Fleet KB PDFs into Supabase pgvector tables (kb_sources, kb_chunks).
//
// Usage:
//   OPENAI_API_KEY=... NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/ingest-kb.mjs \
//     --car-policy "public/Flows/Car-Policy (1).pdf" \
//     --sharepoint "/absolute/path/Procedures Sharepoint update.pdf"
//
// Notes:
// - Uses OpenAI embeddings (default: text-embedding-3-small, 1536 dims).
// - Requires the migration `20260426130000_kb_pgvector.sql` to be applied.

import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const standardFontsDir = path.join(
  repoRoot,
  "node_modules",
  "pdfjs-dist",
  "standard_fonts",
);
// pdf.js expects a base URL ending with '/' so it can append font filenames.
const standardFontDataUrl = pathToFileURL(standardFontsDir + path.sep).href;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true;
    out[key] = value;
  }
  return out;
}

function resolveMaybeRelative(p) {
  if (!p || typeof p !== "string") return null;
  if (path.isAbsolute(p)) return p;
  return path.join(repoRoot, p);
}

async function extractPdfText(pdfPath) {
  const data = await readFile(pdfPath);
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(data),
    standardFontDataUrl,
    // We only need text extraction; this reduces font-related noise on some PDFs.
    disableFontFace: true,
  });
  const doc = await loadingTask.promise;

  const pages = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const line = textContent.items
      .map((it) => ("str" in it ? it.str : ""))
      .join(" ");
    pages.push(line);
  }

  return pages.join("\n\n");
}

function normalizeText(t) {
  return String(t ?? "")
    .replace(/\u0000/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text, { maxChars = 800, overlapChars = 100 } = {}) {
  const t = normalizeText(text);
  if (!t) return [];

  const chunks = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + maxChars);
    let slice = t.slice(i, end);

    // Try to end on a paragraph or sentence boundary to keep chunks coherent.
    if (end < t.length) {
      const lastPara = slice.lastIndexOf("\n\n");
      const lastNewline = slice.lastIndexOf("\n");
      const lastDot = slice.lastIndexOf(". ");
      const boundary = lastPara > 200
        ? lastPara
        : lastNewline > 200
          ? lastNewline
          : lastDot > 200
            ? lastDot + 1
            : -1;
      if (boundary > 0) slice = slice.slice(0, boundary);
    }

    const content = slice.trim();
    if (content) chunks.push(content);

    if (end >= t.length) break;
    i = Math.max(0, i + slice.length - overlapChars);
  }

  return chunks;
}

function estimateTokens(text) {
  // Rough heuristic: ~4 chars per token for typical latin text.
  return Math.ceil(String(text ?? "").length / 4);
}

// ─── Dutch language detection & translation ───────────────────────────────────
// When a source document is in English, we translate chunks to Dutch at index
// time so that Dutch queries (text-embedding-3-small) can match domain terms
// like "tijdskrediet" that wouldn't surface via cross-lingual embedding alone.

const DUTCH_MARKERS =
  /\b(de|het|een|van|voor|met|zijn|dat|niet|maar|ook|als|dit|door|bij|uit|aan|op|er|we|je|ik|ze|hij|zij|naar|om|nog|al|zo|dan|nu|wel|had|heeft|worden|kunnen|moet|meer|geen|alle|werd|wordt|heeft|hebben)\b/gi;

function isDutch(text) {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 10) return true; // too short to judge → assume OK
  const hits = (text.match(DUTCH_MARKERS) ?? []).length;
  return hits / words.length > 0.04;
}

async function ensureDutch(openai, text) {
  if (isDutch(text)) return { text, translated: false };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000); // 20s max per chunk
  try {
    const res = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 1024,
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
      },
      { signal: controller.signal },
    );
    const translated = res.choices?.[0]?.message?.content?.trim();
    if (translated) return { text: translated, translated: true };
  } catch (e) {
    console.warn("[ingest] Translation skipped:", e.message ?? e);
  } finally {
    clearTimeout(timeout);
  }
  return { text, translated: false };
}

// Vertaal chunks parallel met een concurrency-limiet zodat het script niet
// vastloopt op trage API-calls maar ook niet rate-limited wordt.
async function translateChunks(openai, chunks, concurrency = 5) {
  const results = new Array(chunks.length);
  let next = 0;
  async function worker() {
    while (next < chunks.length) {
      const i = next++;
      results[i] = await ensureDutch(openai, chunks[i]);
      process.stdout.write(`\r- vertalen: ${Math.min(next, chunks.length)}/${chunks.length}  `);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  process.stdout.write("\n");
  return results;
}

function inferReferenceData(content) {
  const c = String(content ?? "");
  const phoneLike = c.match(/(\+?\d[\d\s./-]{7,}\d)/g) ?? [];
  return phoneLike.length >= 10;
}

async function embedMany(openai, model, texts) {
  const resp = await openai.embeddings.create({
    model,
    input: texts,
  });
  return resp.data.map((d) => d.embedding);
}

async function upsertSource(supabase, source) {
  const { data, error } = await supabase
    .from("kb_sources")
    .upsert(source, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function upsertChunks(supabase, rows) {
  const { error } = await supabase
    .from("kb_chunks")
    .upsert(rows, { onConflict: "source_id,chunk_index" });
  if (error) throw error;
}

async function ingestOnePdf({
  supabase,
  openai,
  embeddingModel,
  slug,
  title,
  sourcePathLabel,
  docType,
  language,
  priority,
  pdfPath,
}) {
  console.log(`\n[ingest] ${slug}`);
  console.log(`- pdf: ${pdfPath}`);

  const sourceId = await upsertSource(supabase, {
    slug,
    title,
    source_path: sourcePathLabel,
    doc_type: docType,
    language,
    priority,
    updated_at: new Date().toISOString(),
  });

  const raw = await extractPdfText(pdfPath);
  const chunks = chunkText(raw);
  console.log(`- chunks: ${chunks.length}`);

  // ─── Translate chunks to Dutch before embedding (parallel, max 5 at once) ──
  const translationResults = await translateChunks(openai, chunks, 5);
  const dutchChunks = translationResults.map((r) => r.text);
  const translatedFlags = translationResults.map((r) => r.translated);
  const translatedCount = translatedFlags.filter(Boolean).length;
  if (translatedCount > 0) {
    console.log(`- translated: ${translatedCount}/${chunks.length} chunks → Dutch`);
  }

  // Embed in batches to keep request sizes reasonable.
  const batchSize = 64;
  for (let start = 0; start < dutchChunks.length; start += batchSize) {
    const batch = dutchChunks.slice(start, start + batchSize);
    const embeddings = await embedMany(openai, embeddingModel, batch);

    const rows = batch.map((content, idx) => {
      const chunk_index = start + idx;
      const wasTranslated = translatedFlags[chunk_index];
      return {
        source_id: sourceId,
        chunk_index,
        content,
        tokens_estimate: estimateTokens(content),
        embedding: embeddings[idx],
        metadata: {
          reference_data: inferReferenceData(content),
          ...(wasTranslated ? { translated: true, originalContent: chunks[chunk_index] } : {}),
        },
      };
    });

    await upsertChunks(supabase, rows);
    console.log(`- upserted: ${start}..${start + batch.length - 1}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const carPolicyArg = args["car-policy"] ?? "public/Flows/Car-Policy (1).pdf";
  const sharepointArg = args["sharepoint"];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY",
    );
  }
  if (!openaiKey) throw new Error("Missing env: OPENAI_API_KEY");

  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const openai = new OpenAI({ apiKey: openaiKey });

  const carPolicyPath = resolveMaybeRelative(carPolicyArg);
  if (!carPolicyPath) throw new Error("Missing --car-policy path");

  await ingestOnePdf({
    supabase,
    openai,
    embeddingModel,
    slug: "fleet_car_policy",
    title: "Car Policy",
    sourcePathLabel: "public/Flows/Car-Policy (1).pdf",
    docType: "policy",
    language: "nl",
    priority: 100,
    pdfPath: carPolicyPath,
  });

  if (!sharepointArg) {
    console.log(
      "\n[skip] sharepoint pdf not provided. Provide with --sharepoint <path>.",
    );
    return;
  }

  const sharepointPath = resolveMaybeRelative(sharepointArg);
  if (!sharepointPath) throw new Error("Missing --sharepoint path");

  await ingestOnePdf({
    supabase,
    openai,
    embeddingModel,
    slug: "fleet_procedures_sharepoint_update",
    title: "Procedures Sharepoint update",
    sourcePathLabel: "Procedures Sharepoint update.pdf",
    docType: "handbook",
    language: "en",
    priority: 10,
    pdfPath: sharepointPath,
  });

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

