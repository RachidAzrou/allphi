import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

function getSecret(url: URL): string {
  return (url.searchParams.get("secret") ?? "").trim();
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const secret = getSecret(new URL(request.url));
  if (!secret) {
    return NextResponse.json({ error: "Missing secret" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: row, error } = await admin
    .from("ongeval_aangiften")
    .select("id, payload, join_secret, party_b_joined_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const joinSecret = asString((row as unknown as { join_secret?: unknown }).join_secret);
  if (!joinSecret || joinSecret !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  return NextResponse.json({
    payload: (row as unknown as { payload?: unknown }).payload ?? {},
    party_b_joined_at:
      asString((row as unknown as { party_b_joined_at?: unknown }).party_b_joined_at) ??
      null,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { secret?: string; payload?: unknown }
    | null;
  const secret = (body?.secret ?? "").trim();
  if (!secret) {
    return NextResponse.json({ error: "Missing secret" }, { status: 400 });
  }

  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const { data: row, error: readErr } = await admin
    .from("ongeval_aangiften")
    .select("id, join_secret")
    .eq("id", id)
    .maybeSingle();
  if (readErr || !row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const joinSecret = asString((row as unknown as { join_secret?: unknown }).join_secret);
  if (!joinSecret || joinSecret !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  const nextPayload = isRecord(body) ? body.payload : undefined;
  const { error: updErr } = await admin
    .from("ongeval_aangiften")
    .update({
      payload: nextPayload ?? {},
      party_b_joined_at: new Date().toISOString(),
      join_role: "B",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updErr) {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

