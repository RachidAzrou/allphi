import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

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

  const form = await request.formData();
  const file = form.get("file");
  const title = String(form.get("title") ?? "").trim();
  const version = String(form.get("version") ?? "").trim();

  if (!(file instanceof File) || file.size <= 0) {
    return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
  }

  const filename = file.name || "document";
  const safeName = filename.replace(/[^\w.\- ()]+/g, "_");
  const storagePath = `${user.id}/${Date.now()}-${safeName}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, bytes, {
      contentType: file.type || undefined,
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 });
  }

  // Create a knowledge_documents row now (chunks are added on ingest).
  const docTitle = title || safeName.replace(/\.[^/.]+$/, "");
  const sourceRef = `storage:${BUCKET}/${storagePath}`;
  const { data: docRow, error: docErr } = await admin
    .from("knowledge_documents")
    .insert({
      title: docTitle,
      source_type: "upload",
      source_ref: sourceRef,
      version: version || null,
      active: true,
    })
    .select("id, title, source_ref")
    .single();

  if (docErr) {
    return NextResponse.json({ ok: false, error: docErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    bucket: BUCKET,
    path: storagePath,
    source_ref: sourceRef,
    document: docRow,
  });
}

