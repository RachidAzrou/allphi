import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { mergePayloadIntoState } from "@/lib/ongeval/engine";
import { buildAccidentPdfBytes } from "@/app/api/ongeval/[id]/pdf/route";

type MedewerkerRole = "medewerker" | "fleet_manager" | "management";

async function assertFleetOrManagement() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false as const, status: 401 as const, error: "Niet geautoriseerd" };
  }

  const { data: medewerker, error } = await supabase
    .from("medewerkers")
    .select("role, rol")
    .ilike("emailadres", user.email)
    .maybeSingle();
  if (error) {
    return { ok: false as const, status: 500 as const, error: "server_error" };
  }

  const role = (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null } | null)
    ? (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null }).role ??
      (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null }).rol ??
      "medewerker"
    : "medewerker";

  if (role !== "fleet_manager" && role !== "management") {
    return { ok: false as const, status: 403 as const, error: "Forbidden" };
  }

  return { ok: true as const, supabase };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await assertFleetOrManagement();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const url = new URL(req.url);
  const asAttachment = url.searchParams.get("dl") === "1";

  const { data: row, error } = await auth.supabase
    .from("ongeval_aangiften")
    .select("id, payload")
    .eq("id", id)
    .maybeSingle();
  if (error || !row) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const adminClient = createServiceRoleClient() ?? auth.supabase;
  const state = mergePayloadIntoState((row as { payload: unknown }).payload);
  const pdfBytes = await buildAccidentPdfBytes(state, {
    downloadDamagePhoto: async (p) => {
      const { data: blob, error: dlErr } = await adminClient.storage
        .from(p.bucket)
        .download(p.path);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "download_failed");
      return {
        bytes: new Uint8Array(await blob.arrayBuffer()),
        mime: p.mime || "image/jpeg",
        name: p.name || "foto",
      };
    },
  });

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${asAttachment ? "attachment" : "inline"}; filename="aanrijdingsformulier-${id}.pdf"`,
      "cache-control": "no-store",
    },
  });
}

