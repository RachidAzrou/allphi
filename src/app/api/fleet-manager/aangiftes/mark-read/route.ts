import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const body = (await req.json().catch(() => null)) as { id?: string } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return NextResponse.json({ ok: false, error: "missing_id" }, { status: 400 });

  const { error } = await supabase.rpc("fleet_mark_ongeval_read", { rid: id });
  if (error) {
    const msg = error.message ?? "rpc_error";
    const status = msg === "forbidden" ? 403 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  return NextResponse.json({ ok: true });
}

