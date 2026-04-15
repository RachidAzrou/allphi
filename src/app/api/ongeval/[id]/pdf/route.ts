import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { mergePayloadIntoState } from "@/lib/ongeval/engine";

function yn(v: boolean | null): string {
  if (v === null) return "";
  return v ? "JA" : "NEE";
}

function fullName(p?: { voornaam?: string; naam?: string }): string {
  const parts = [p?.voornaam ?? "", p?.naam ?? ""].map((s) => s.trim()).filter(Boolean);
  return parts.join(" ");
}

function drawLabel(
  page: any,
  text: string,
  x: number,
  y: number,
  size: number,
  font: any,
) {
  if (!text) return;
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0.1, 0.2, 0.28),
    maxWidth: 260,
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("ongeval_aangiften")
    .select("id, user_id, payload")
    .eq("id", id)
    .maybeSingle();

  if (error || !row || (row as any).user_id !== user.id) {
    return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
  }

  const state = mergePayloadIntoState((row as any).payload);

  const templatePath = path.join(process.cwd(), "public", "AANRIJDINGSFORMULIER.pdf");
  const templateBytes = await readFile(templatePath);
  const pdfDoc = await PDFDocument.load(templateBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const pages = pdfDoc.getPages();
  const page1 = pages[0];

  // Coordinates tuned for A4 PDF-lib (origin bottom-left).
  // These are approximate but readable; adjust later if needed.
  const leftX = 52;
  const rightX = 320;
  const topY = 790;

  // 1) Date/time & place
  drawLabel(page1, state.location.tijd, leftX + 12, topY - 25, 10, font);
  drawLabel(page1, state.location.datum, leftX + 90, topY - 25, 10, font);
  drawLabel(
    page1,
    `${state.location.straat} ${state.location.huisnummer}`.trim(),
    leftX + 12,
    topY - 60,
    10,
    font,
  );
  drawLabel(page1, state.location.stad, leftX + 12, topY - 74, 10, font);
  drawLabel(page1, state.location.land, leftX + 210, topY - 74, 10, font);

  // 3/4) injuries & material damage (simple text in margins)
  drawLabel(page1, yn(state.gewonden), leftX + 410, topY - 48, 10, font);
  drawLabel(page1, yn(state.materieleSchadeAnders), leftX + 410, topY - 70, 10, font);

  // 5) witnesses
  drawLabel(page1, state.getuigen, leftX + 290, topY - 60, 8, font);

  // Party A block
  const a = state.partyA;
  drawLabel(page1, a.verzekeringsnemer.naam, leftX + 58, 660, 9, font);
  drawLabel(page1, a.verzekeringsnemer.voornaam, leftX + 70, 646, 9, font);
  drawLabel(
    page1,
    `${a.verzekeringsnemer.adres.straat} ${a.verzekeringsnemer.adres.huisnummer} ${a.verzekeringsnemer.adres.bus}`.trim(),
    leftX + 52,
    632,
    8.5,
    font,
  );
  drawLabel(page1, a.verzekeringsnemer.adres.postcode, leftX + 58, 618, 8.5, font);
  drawLabel(page1, a.verzekeringsnemer.adres.land, leftX + 190, 618, 8.5, font);
  drawLabel(page1, a.voertuig.merkModel, leftX + 50, 586, 8.5, font);
  drawLabel(page1, a.voertuig.nummerplaat, leftX + 50, 566, 8.5, font);
  drawLabel(page1, a.voertuig.landInschrijving, leftX + 50, 546, 8.5, font);
  drawLabel(page1, a.verzekering.maatschappij, leftX + 50, 508, 8.5, font);
  drawLabel(page1, a.verzekering.polisnummer, leftX + 70, 494, 8.5, font);
  drawLabel(page1, a.bestuurder.naam, leftX + 50, 452, 8.5, font);
  drawLabel(page1, a.bestuurder.voornaam, leftX + 70, 438, 8.5, font);
  drawLabel(page1, a.bestuurder.geboortedatum, leftX + 92, 424, 8.5, font);
  drawLabel(page1, a.bestuurder.rijbewijsNummer, leftX + 88, 388, 8.5, font);

  // Party B block (right)
  const b = state.partyB;
  drawLabel(page1, b.verzekeringsnemer.naam, rightX + 58, 660, 9, font);
  drawLabel(page1, b.verzekeringsnemer.voornaam, rightX + 70, 646, 9, font);
  drawLabel(
    page1,
    `${b.verzekeringsnemer.adres.straat} ${b.verzekeringsnemer.adres.huisnummer} ${b.verzekeringsnemer.adres.bus}`.trim(),
    rightX + 52,
    632,
    8.5,
    font,
  );
  drawLabel(page1, b.verzekeringsnemer.adres.postcode, rightX + 58, 618, 8.5, font);
  drawLabel(page1, b.verzekeringsnemer.adres.land, rightX + 190, 618, 8.5, font);
  drawLabel(page1, b.voertuig.merkModel, rightX + 50, 586, 8.5, font);
  drawLabel(page1, b.voertuig.nummerplaat, rightX + 50, 566, 8.5, font);
  drawLabel(page1, b.voertuig.landInschrijving, rightX + 50, 546, 8.5, font);
  drawLabel(page1, b.verzekering.maatschappij, rightX + 50, 508, 8.5, font);
  drawLabel(page1, b.verzekering.polisnummer, rightX + 70, 494, 8.5, font);
  drawLabel(page1, b.bestuurder.naam, rightX + 50, 452, 8.5, font);
  drawLabel(page1, b.bestuurder.voornaam, rightX + 70, 438, 8.5, font);
  drawLabel(page1, b.bestuurder.geboortedatum, rightX + 92, 424, 8.5, font);
  drawLabel(page1, b.bestuurder.rijbewijsNummer, rightX + 88, 388, 8.5, font);

  const pdfBytes = await pdfDoc.save();

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="aanrijdingsformulier-${id}.pdf"`,
      "cache-control": "no-store",
    },
  });
}

