import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { mergePayloadIntoState } from "@/lib/ongeval/engine";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { data: row, error: rowErr } = await supabase
    .from("ongeval_aangiften")
    .select("id, user_id, status, payload, submission_mode, scan_storage_path, scan_page_count")
    .eq("id", id)
    .maybeSingle();
  if (rowErr) {
    return NextResponse.json({ error: "not_found", detail: rowErr.message }, { status: 404 });
  }
  if (!row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  if ((row as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Minimal validation: we only allow submitting when the report has enough
  // data to generate a usable PDF.
  const state = mergePayloadIntoState((row as { payload: unknown }).payload);
  const submissionMode: "wizard" | "scan" =
    ((row as { submission_mode?: "wizard" | "scan" | null }).submission_mode ??
      state.submissionMode ??
      "wizard") as "wizard" | "scan";
  const incidentKind = state.incidentKind ?? "accident_with_other_party";
  if (submissionMode === "wizard" && incidentKind === "accident_with_other_party" && !state.signaturePartyA) {
    return NextResponse.json({ error: "incomplete", detail: "signature_a" }, { status: 422 });
  }
  if (submissionMode === "scan") {
    const path =
      (row as { scan_storage_path?: string | null }).scan_storage_path ??
      state.scanSubmission.storagePath;
    const pageCount =
      (row as { scan_page_count?: number | null }).scan_page_count ??
      state.scanSubmission.pageCount ??
      0;
    if (!path || pageCount < 1) {
      return NextResponse.json({ error: "incomplete", detail: "scan_missing" }, { status: 422 });
    }
  }

  const { error: updErr } = await supabase
    .from("ongeval_aangiften")
    .update({
      status: "submitted",
      // reset e-mail state; dispatching by e-mail is no longer automatic
      email_status: null,
      email_error: null,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updErr) {
    return NextResponse.json({ error: "server_error", detail: updErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
