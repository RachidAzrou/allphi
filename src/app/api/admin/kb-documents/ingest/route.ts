import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { ingestKnowledgeDocument } from "@/lib/kb/ingest";

const BUCKET = "kb-documents";

function requireRole(role: string | null | undefined): boolean {
  return role === "fleet_manager" || role === "management";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { data: medewerker } = await supabase
    .from("medewerkers")
    .select("rol")
    .ilike("emailadres", user.email)
    .maybeSingle();
  const role = (medewerker as { rol?: string } | null)?.rol ?? "medewerker";
  if (!requireRole(role)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not configured" },
      { status: 500 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const documentId = typeof body?.documentId === "string" ? body.documentId.trim() : "";
  const sourceRef = typeof body?.source_ref === "string" ? body.source_ref.trim() : "";

  if (!documentId && !sourceRef) {
    return NextResponse.json(
      { ok: false, error: "Provide documentId or source_ref" },
      { status: 400 },
    );
  }

  const { data: docRow, error: docErr } = await admin
    .from("knowledge_documents")
    .select("id, title, source_ref")
    .eq("id", documentId || "__none__")
    .maybeSingle();
  if (docErr) {
    return NextResponse.json({ ok: false, error: docErr.message }, { status: 500 });
  }

  const doc = (docRow as any) ?? null;
  const ref: string = (sourceRef || doc?.source_ref || "").trim();
  const title: string = (doc?.title || "").trim();

  if (!ref.startsWith(`storage:${BUCKET}/`)) {
    return NextResponse.json(
      { ok: false, error: `source_ref must start with storage:${BUCKET}/` },
      { status: 400 },
    );
  }

  const path = ref.replace(`storage:${BUCKET}/`, "");
  const { data: blob, error: dlErr } = await admin.storage.from(BUCKET).download(path);
  if (dlErr || !blob) {
    return NextResponse.json(
      { ok: false, error: dlErr?.message ?? "download_failed" },
      { status: 500 },
    );
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  const filename = path.split("/").pop() || "document";
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  if (!openaiApiKey) {
    return NextResponse.json({ ok: false, error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  // Delete any existing chunks for this document before re-ingest (simple versioning strategy).
  await admin.from("knowledge_chunks").delete().eq("document_id", doc?.id ?? documentId);

  const { chunkCount } = await ingestKnowledgeDocument({
    supabase: admin,
    openaiApiKey,
    embeddingModel: process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small",
    title: title || filename,
    source_type: "upload",
    source_ref: ref,
    bytes,
    filename,
    mime: blob.type || null,
  });

  return NextResponse.json({ ok: true, documentId: doc?.id ?? documentId, chunkCount });
}

