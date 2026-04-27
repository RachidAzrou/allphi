import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";

function extractDataUrlBase64(dataUrl: string): Buffer | null {
  if (!dataUrl) return null;
  const idx = dataUrl.indexOf(",");
  if (idx < 0) return null;
  try {
    return Buffer.from(dataUrl.slice(idx + 1), "base64");
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { signatureDataUrl?: string } | null;
  const signatureDataUrl = String(body?.signatureDataUrl ?? "").trim();
  if (!signatureDataUrl) {
    return NextResponse.json({ ok: false, error: "Geen handtekening" }, { status: 400 });
  }

  const { data: row, error } = await supabase
    .from("wagen_bestellingen")
    .select("id, user_id, contribution_doc_path")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ ok: false, error: "Niet gevonden" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }
  if (!row.contribution_doc_path) {
    return NextResponse.json({ ok: false, error: "Genereer eerst het PDF-document" }, { status: 400 });
  }

  // Download current PDF and stamp signature in the signature box.
  const { data: dl, error: dlErr } = await supabase.storage
    .from("wagen-bijdrage-docs")
    .download(row.contribution_doc_path);

  if (dlErr || !dl) {
    console.error(dlErr);
    return NextResponse.json({ ok: false, error: "Kon PDF niet ophalen" }, { status: 500 });
  }

  const pdfBytes = new Uint8Array(await dl.arrayBuffer());
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pages = pdfDoc.getPages();
  const page = pages[0];

  const sigBytes = extractDataUrlBase64(signatureDataUrl);
  if (sigBytes) {
    try {
      const png = await pdfDoc.embedPng(sigBytes);
      const { width, height } = page.getSize();
      const margin = 48;
      // Signature box in generate route: y=140, h=60, full width.
      const boxX = margin;
      const boxY = 140;
      const boxW = width - margin * 2;
      const boxH = 60;

      // Fit image inside box with padding.
      const pad = 8;
      const targetW = boxW - pad * 2;
      const targetH = boxH - pad * 2;
      page.drawImage(png, { x: boxX + pad, y: boxY + pad, width: targetW, height: targetH });
    } catch (e) {
      console.warn("[wagen-bestellen] embed signature failed", e);
    }
  }

  // Add a small footer timestamp.
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  page.drawText(`Ondertekend op ${new Date().toLocaleString("nl-BE")}`, {
    x: 48,
    y: 66,
    font,
    size: 9,
    color: rgb(0.4, 0.47, 0.54),
  });

  const updated = await pdfDoc.save();
  const pdfBlob = new Blob([updated.slice().buffer as ArrayBuffer], {
    type: "application/pdf",
  });

  const { error: upErr } = await supabase.storage
    .from("wagen-bijdrage-docs")
    .upload(row.contribution_doc_path, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (upErr) {
    console.error(upErr);
    return NextResponse.json({ ok: false, error: "Kon PDF niet opslaan" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("wagen_bestellingen")
    .update({
      contribution_signature: { dataUrl: signatureDataUrl } as unknown as Record<string, unknown>,
      contribution_signed_at: nowIso,
    })
    .eq("id", id);

  return NextResponse.json({ ok: true });
}

