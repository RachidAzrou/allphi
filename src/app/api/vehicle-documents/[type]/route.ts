import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

type VinContextRow = { vin: string | null };
type VehicleDocumentRow = { document_url: string | null };

function filenameForType(type: string): string {
  const t = type.toUpperCase();
  if (t === "OFFERTE") return "offerte.pdf";
  if (t === "HANDLEIDING") return "handleiding.pdf";
  if (t === "GROENE_KAART") return "groene-kaart.pdf";
  if (t === "VERZEKERINGSATTEST") return "verzekeringsattest.pdf";
  return `${t.toLowerCase().replace(/[^a-z0-9_-]+/g, "-") || "document"}.pdf`;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string }> },
) {
  const { type } = await params;
  const docType = String(type ?? "").trim().toUpperCase();
  if (!docType) {
    return NextResponse.json({ error: "missing_type" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { data: ctx, error: ctxErr } = await supabase
    .from("v_fleet_assistant_context")
    .select("vin")
    .eq("emailadres", user.email)
    .limit(1)
    .maybeSingle();

  if (ctxErr) {
    return NextResponse.json(
      { error: "context_fetch_failed", detail: ctxErr.message },
      { status: 500 },
    );
  }

  const ctxRow = (ctx ?? null) as VinContextRow | null;
  const vin = (ctxRow?.vin ?? "").trim();
  if (!vin) {
    return NextResponse.json({ error: "no_active_vehicle" }, { status: 404 });
  }

  const { data: doc, error: docErr } = await supabase
    .from("vehicle_documents")
    .select("document_url")
    .eq("voertuig_vin", vin)
    .eq("document_type", docType)
    .maybeSingle();

  if (docErr) {
    return NextResponse.json(
      { error: "document_fetch_failed", detail: docErr.message },
      { status: 500 },
    );
  }

  const docRow = (doc ?? null) as VehicleDocumentRow | null;
  const path = (docRow?.document_url ?? "").trim();
  if (!path) {
    return NextResponse.json({ error: "document_missing" }, { status: 404 });
  }

  const adminClient = createServiceRoleClient() ?? supabase;
  const { data: blob, error: dlErr } = await adminClient.storage
    .from("vehicle-documents")
    .download(path);

  if (dlErr || !blob) {
    return NextResponse.json(
      { error: "download_failed", detail: dlErr?.message ?? "download_failed" },
      { status: 500 },
    );
  }

  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new NextResponse(Buffer.from(bytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filenameForType(docType)}"`,
      "cache-control": "no-store",
    },
  });
}

