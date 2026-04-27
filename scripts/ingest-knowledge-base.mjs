/**
 * Ingest documents into Supabase knowledge base tables.
 *
 * Usage:
 *   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... OPENAI_API_KEY=... \
 *   node scripts/ingest-knowledge-base.mjs --dir "./public/Flows" --title-prefix "Flows"
 *
 * Or ingest a single file:
 *   node scripts/ingest-knowledge-base.mjs --file "./public/Flows/foo.pdf" --title "Foo"
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

function formatError(e) {
  if (e instanceof Error) return `${e.message}\n${e.stack ?? ""}`.trim();
  if (typeof e === "string") return e;
  try {
    return JSON.stringify(e, Object.getOwnPropertyNames(e), 2);
  } catch {
    return String(e);
  }
}

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return "";
  return String(process.argv[idx + 1] ?? "").trim();
}

function argFlag(name) {
  return process.argv.includes(name);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
if (!openaiKey) {
  console.error("Missing OPENAI_API_KEY");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const openai = new OpenAI({ apiKey: openaiKey });
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";

const dir = argValue("--dir");
const file = argValue("--file");
const title = argValue("--title");
const titlePrefix = argValue("--title-prefix");
const sourceType = argValue("--source-type") || "repo";
const sourceRefBase = argValue("--source-ref-base");
const chunkChars = Number(argValue("--chunk-chars") || "2200"); // ~500-800 tokens depending on language
const chunkOverlap = Number(argValue("--chunk-overlap") || "250");
const dryRun = argFlag("--dry-run");

if (!dir && !file) {
  console.error("Provide --dir or --file");
  process.exit(1);
}

async function listFilesRecursively(root) {
  const out = [];
  async function walk(p) {
    const stat = await fs.stat(p);
    if (stat.isDirectory()) {
      const entries = await fs.readdir(p);
      for (const e of entries) {
        if (e.startsWith(".")) continue;
        await walk(path.join(p, e));
      }
      return;
    }
    out.push(p);
  }
  await walk(root);
  return out;
}

function normalizeTitleFromPath(p) {
  const base = path.basename(p);
  const withoutExt = base.replace(/\.[^/.]+$/, "");
  const cleaned = withoutExt.replace(/\s+/g, " ").trim();
  return titlePrefix ? `${titlePrefix} — ${cleaned}` : cleaned;
}

function contentTypeFromExt(p) {
  const ext = path.extname(p).toLowerCase();
  if (ext === ".md" || ext === ".txt") return "text";
  if (ext === ".pdf") return "pdf";
  if (ext === ".docx") return "docx";
  return "unknown";
}

async function readTextFromPdf(filePath) {
  const bytes = await fs.readFile(filePath);
  // pdfjs-dist expects Uint8Array; fs returns Buffer in Node.
  const data = Buffer.isBuffer(bytes) ? new Uint8Array(bytes) : new Uint8Array(bytes);
  const doc = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const lines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = (content.items ?? [])
      .map((it) => (typeof it.str === "string" ? it.str : ""))
      .filter(Boolean)
      .join(" ");
    lines.push(pageText);
  }
  return lines.join("\n\n").replace(/\s+\n/g, "\n").trim();
}

async function readTextFromDocx(filePath) {
  const buf = await fs.readFile(filePath);
  const { value } = await mammoth.extractRawText({ buffer: buf });
  return String(value ?? "").trim();
}

async function readTextFromFile(filePath) {
  const kind = contentTypeFromExt(filePath);
  if (kind === "text") {
    const raw = await fs.readFile(filePath, "utf8");
    return raw.replace(/\r\n/g, "\n").trim();
  }
  if (kind === "pdf") return await readTextFromPdf(filePath);
  if (kind === "docx") return await readTextFromDocx(filePath);
  throw new Error(`unsupported_file_type:${filePath}`);
}

function chunkText(text) {
  // Postgres text can't contain NUL bytes; PDFs sometimes yield them.
  const t = String(text ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+\n/g, "\n")
    .trim();
  if (!t) return [];
  const chunks = [];
  let i = 0;
  while (i < t.length) {
    const end = Math.min(t.length, i + chunkChars);
    const slice = t.slice(i, end);
    chunks.push(slice.trim());
    if (end >= t.length) break;
    i = Math.max(0, end - chunkOverlap);
  }
  return chunks.filter(Boolean);
}

async function embedBatch(texts) {
  const resp = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return (resp.data ?? []).map((d) => d.embedding);
}

async function upsertDocument({ title, source_ref }) {
  const payload = {
    title,
    source_type: sourceType,
    source_ref: source_ref || null,
    active: true,
  };
  const { data, error } = await supabase
    .from("knowledge_documents")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function insertChunks({ documentId, chunks, embeddings, filePath }) {
  const rows = chunks.map((content, idx) => ({
    document_id: documentId,
    chunk_index: idx,
    content,
    metadata: {
      filePath,
      chunkChars,
      chunkOverlap,
      embeddingModel: EMBEDDING_MODEL,
    },
    embedding: embeddings[idx],
  }));
  const { error } = await supabase.from("knowledge_chunks").insert(rows);
  if (error) throw error;
}

async function ingestOne(filePath) {
  const docTitle = file ? (title || normalizeTitleFromPath(filePath)) : normalizeTitleFromPath(filePath);
  const sourceRef = sourceRefBase
    ? `${sourceRefBase.replace(/\/+$/, "")}/${path.relative(process.cwd(), filePath).replace(/\\/g, "/")}`
    : path.relative(process.cwd(), filePath).replace(/\\/g, "/");

  const text = await readTextFromFile(filePath);
  const chunks = chunkText(text);
  if (chunks.length === 0) {
    console.warn("Skipping empty document:", filePath);
    return { filePath, ok: true, skipped: true };
  }

  if (dryRun) {
    console.log(JSON.stringify({ filePath, title: docTitle, chunks: chunks.length, dryRun: true }, null, 2));
    return { filePath, ok: true, skipped: false, dryRun: true };
  }

  const embeddings = [];
  const batchSize = 64;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const vecs = await embedBatch(batch);
    embeddings.push(...vecs);
    process.stdout.write(".");
  }
  process.stdout.write("\n");

  const documentId = await upsertDocument({ title: docTitle, source_ref: sourceRef });
  await insertChunks({ documentId, chunks, embeddings, filePath: sourceRef });
  return { filePath, ok: true, skipped: false, documentId, chunks: chunks.length };
}

const targets = file
  ? [path.resolve(process.cwd(), file)]
  : (await listFilesRecursively(path.resolve(process.cwd(), dir))).filter((p) => {
      const ext = path.extname(p).toLowerCase();
      return ext === ".md" || ext === ".txt" || ext === ".pdf" || ext === ".docx";
    });

console.log(JSON.stringify({ targets: targets.length, dryRun, model: EMBEDDING_MODEL }, null, 2));

const results = [];
for (const p of targets) {
  try {
    console.log("Ingesting:", p);
    // Naive strategy: always insert a new document row (versioning can be handled later).
    const r = await ingestOne(p);
    results.push(r);
  } catch (e) {
    const detail = formatError(e);
    console.error("Failed:", p, detail);
    results.push({ filePath: p, ok: false, error: detail });
  }
}

const ok = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(JSON.stringify({ ok, failed, results }, null, 2));

