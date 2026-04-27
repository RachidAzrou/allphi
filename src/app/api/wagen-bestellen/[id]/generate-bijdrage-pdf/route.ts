import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";

function safe(v: string | null | undefined, fallback = "—"): string {
  const s = (v ?? "").trim();
  return s ? s : fallback;
}

function formatEur(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(v);
}

async function buildPdfBytes(params: {
  medewerkerNaam: string;
  merkModel: string;
  dealer: string;
  offerTotalEur: number | null;
  overspendEur: number | null;
  contributionEur: number | null;
}): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = page.getWidth();
  const topY = page.getHeight() - margin;

  page.drawRectangle({
    x: 0,
    y: topY - 44,
    width,
    height: 44,
    color: rgb(0.153, 0.6, 0.84),
  });
  page.drawText("PERSOONLIJKE BIJDRAGE — NIEUWE WAGEN", {
    x: margin,
    y: topY - 28,
    font: bold,
    size: 14,
    color: rgb(1, 1, 1),
  });
  page.drawText("AllPhi Fleet Companion", {
    x: margin,
    y: topY - 40,
    font,
    size: 9,
    color: rgb(1, 1, 1),
  });

  let y = topY - 80;

  const drawLabelValue = (label: string, value: string) => {
    page.drawText(label, {
      x: margin,
      y,
      font,
      size: 10,
      color: rgb(0.4, 0.47, 0.54),
    });
    page.drawText(value, {
      x: margin + 190,
      y,
      font: bold,
      size: 11,
      color: rgb(0.09, 0.17, 0.25),
      maxWidth: width - margin * 2 - 190,
    });
    y -= 18;
  };

  page.drawText("Samenvatting", {
    x: margin,
    y,
    font: bold,
    size: 12,
    color: rgb(0.09, 0.17, 0.25),
  });
  y -= 16;

  drawLabelValue("Medewerker", params.medewerkerNaam);
  drawLabelValue("Model", safe(params.merkModel));
  drawLabelValue("Dealer", safe(params.dealer));
  drawLabelValue("Offerte totaal", formatEur(params.offerTotalEur));
  drawLabelValue("Overschrijding", formatEur(params.overspendEur));
  drawLabelValue("Persoonlijke bijdrage", formatEur(params.contributionEur));

  y -= 12;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.88, 0.91, 0.94),
  });
  y -= 18;

  const body =
    "Ik bevestig dat ik kennis heb genomen van de berekende persoonlijke bijdrage " +
    "in het kader van de bestelling van een nieuwe wagen, en dat ik akkoord ga met de ondertekening hiervan.";

  page.drawText(body, {
    x: margin,
    y,
    font,
    size: 10.5,
    color: rgb(0.09, 0.17, 0.25),
    maxWidth: width - margin * 2,
    lineHeight: 14,
  });

  // Signature box
  const sigY = 140;
  page.drawText("Handtekening medewerker", {
    x: margin,
    y: sigY + 70,
    font: bold,
    size: 10,
    color: rgb(0.09, 0.17, 0.25),
  });
  page.drawRectangle({
    x: margin,
    y: sigY,
    width: width - margin * 2,
    height: 60,
    borderColor: rgb(0.88, 0.91, 0.94),
    borderWidth: 1,
    color: rgb(0.98, 0.985, 0.99),
  });

  page.drawText(`Gegenereerd op ${new Date().toLocaleString("nl-BE")}`, {
    x: margin,
    y: 86,
    font,
    size: 9,
    color: rgb(0.4, 0.47, 0.54),
  });

  return await pdf.save();
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("wagen_bestellingen")
    .select("id, user_id, payload, overspend_amount_eur, personal_contribution_amount_eur")
    .eq("id", id)
    .single();

  if (error || !row) {
    return NextResponse.json({ ok: false, error: "Niet gevonden" }, { status: 404 });
  }
  if (row.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const model = (payload["model"] ?? {}) as Record<string, unknown>;

  const merkModel = String(model["merkModel"] ?? "").trim();
  const dealer = String(model["dealer"] ?? "").trim();
  const offerTotalEur =
    typeof model["offerTotalEur"] === "number" ? (model["offerTotalEur"] as number) : null;

  const { data: medewerker } = await supabase
    .from("medewerkers")
    .select("voornaam, naam")
    .ilike("emailadres", user.email)
    .maybeSingle();

  const medewerkerNaam = [medewerker?.voornaam, medewerker?.naam].filter(Boolean).join(" ") || user.email;

  const pdfBytes = await buildPdfBytes({
    medewerkerNaam,
    merkModel,
    dealer,
    offerTotalEur,
    overspendEur: row.overspend_amount_eur ?? null,
    contributionEur: row.personal_contribution_amount_eur ?? null,
  });

  const path = `${user.id}/${id}/bijdrage.pdf`;
  const pdfBlob = new Blob([pdfBytes.slice().buffer as ArrayBuffer], {
    type: "application/pdf",
  });

  const { error: uploadErr } = await supabase.storage
    .from("wagen-bijdrage-docs")
    .upload(path, pdfBlob, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadErr) {
    console.error(uploadErr);
    return NextResponse.json({ ok: false, error: "Upload mislukt" }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  await supabase
    .from("wagen_bestellingen")
    .update({
      contribution_doc_path: path,
      contribution_doc_generated_at: nowIso,
    })
    .eq("id", id);

  return NextResponse.json({ ok: true, path });
}

