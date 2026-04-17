import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { mergePayloadIntoState } from "@/lib/ongeval/engine";
import { formatDateForDisplay, formatTimeForDisplay } from "@/lib/ongeval/date-utils";
import {
  getSituationCategoryLabel,
  getSituationDetailLabel,
  getManeuverLabel,
} from "@/lib/ongeval/situations";

function yn(v: boolean | null): string {
  if (v === null) return "";
  return v ? "JA" : "NEE";
}

function drawLabel(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  size: number,
  font: PDFFont,
  maxWidth = 260,
) {
  if (!text) return;
  page.drawText(text, {
    x,
    y,
    size,
    font,
    color: rgb(0.1, 0.2, 0.28),
    maxWidth,
  });
}

async function embedSignaturePng(
  pdfDoc: PDFDocument,
  page: PDFPage,
  dataUrl: string | null,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (!dataUrl) return;
  try {
    const commaIdx = dataUrl.indexOf(",");
    if (commaIdx < 0) return;
    const base64 = dataUrl.slice(commaIdx + 1);
    const bytes = Buffer.from(base64, "base64");
    const png = await pdfDoc.embedPng(bytes);
    page.drawImage(png, { x, y, width, height });
  } catch (e) {
    console.warn("[pdf] signature embed failed", e);
  }
}

/**
 * Teken een mini auto-silhouet + rode pijl voor het raakpunt in de PDF zelf.
 * Coördinaten (`baseX`, `baseY`) zijn de linker-onderhoek van het kadertje,
 * `w`/`h` de grootte. `point` is {x,y} in 0..1.
 */
function drawImpactBox(
  page: PDFPage,
  font: PDFFont,
  baseX: number,
  baseY: number,
  w: number,
  h: number,
  point: { x: number; y: number } | null,
  party: "A" | "B",
) {
  // Kadertje
  page.drawRectangle({
    x: baseX,
    y: baseY,
    width: w,
    height: h,
    borderColor: rgb(0.6, 0.7, 0.8),
    borderWidth: 0.6,
  });
  // Auto-rechthoekje
  const carW = w * 0.45;
  const carH = h * 0.8;
  const carX = baseX + (w - carW) / 2;
  const carY = baseY + (h - carH) / 2;
  const body =
    party === "A" ? rgb(0.18, 0.5, 0.84) : rgb(0.97, 0.79, 0.28);
  page.drawRectangle({
    x: carX,
    y: carY,
    width: carW,
    height: carH,
    color: body,
    borderColor: rgb(0.1, 0.2, 0.28),
    borderWidth: 0.5,
  });
  // Voorruit-streepje
  page.drawRectangle({
    x: carX + carW * 0.15,
    y: carY + carH * 0.78,
    width: carW * 0.7,
    height: carH * 0.08,
    color: rgb(0.85, 0.93, 0.98),
  });
  drawLabel(page, party, carX + carW / 2 - 2, carY + carH / 2 - 3, 7, font, 20);
  if (point) {
    const px = carX + point.x * carW;
    const py = carY + (1 - point.y) * carH;
    // Rood rondje + pijl naar binnen.
    page.drawCircle({ x: px, y: py, size: 2.4, color: rgb(0.88, 0.11, 0.18) });
  }
}

async function loadPayload(
  id: string,
  secret: string | null,
): Promise<{ payload: unknown; error?: string; status?: number }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user?.id) {
    const { data: row, error } = await supabase
      .from("ongeval_aangiften")
      .select("id, user_id, party_b_user_id, payload")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      return { payload: null, error: error.message, status: 500 };
    }
    if (!row) {
      return { payload: null, error: "not_found", status: 404 };
    }
    const owner = (row as { user_id: string }).user_id;
    const partyB = (row as { party_b_user_id: string | null }).party_b_user_id;
    if (owner !== user.id && partyB !== user.id) {
      if (!secret) {
        return { payload: null, error: "forbidden", status: 403 };
      }
    } else {
      return { payload: (row as { payload: unknown }).payload };
    }
  }

  // Guest pad: verify via secret
  if (!secret) {
    return { payload: null, error: "auth_required", status: 401 };
  }
  const { data, error } = await supabase.rpc("ongeval_fetch_with_secret", {
    rid: id,
    secret,
  });
  if (error) {
    const msg = error.message ?? "rpc_error";
    return { payload: null, error: msg, status: 403 };
  }
  return { payload: data };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const url = new URL(request.url);
    const secret = url.searchParams.get("s");
    const asAttachment = url.searchParams.get("dl") === "1";

    const { payload, error, status } = await loadPayload(id, secret);
    if (error) {
      return NextResponse.json({ error }, { status: status ?? 500 });
    }

    const state = mergePayloadIntoState(payload);

    const templatePath = path.join(
      process.cwd(),
      "public",
      "AANRIJDINGSFORMULIER.pdf",
    );
    const templateBytes = await readFile(templatePath);
    const pdfDoc = await PDFDocument.load(templateBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const pages = pdfDoc.getPages();
    const page1 = pages[0];

    const leftX = 52;
    const rightX = 320;
    const topY = 790;

    // 1) Date/time & place
    drawLabel(page1, formatTimeForDisplay(state.location.tijd), leftX + 12, topY - 25, 10, font);
    drawLabel(page1, formatDateForDisplay(state.location.datum), leftX + 90, topY - 25, 10, font);
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

    // 3/4) injuries & material damage
    drawLabel(page1, yn(state.gewonden), leftX + 410, topY - 48, 10, font);
    drawLabel(page1, yn(state.materieleSchadeAnders), leftX + 410, topY - 70, 10, font);

    // 5) witnesses
    drawLabel(page1, state.getuigen, leftX + 290, topY - 60, 8, font, 220);

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
    drawLabel(page1, formatDateForDisplay(a.bestuurder.geboortedatum), leftX + 92, 424, 8.5, font);
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
    drawLabel(page1, formatDateForDisplay(b.bestuurder.geboortedatum), rightX + 92, 424, 8.5, font);
    drawLabel(page1, b.bestuurder.rijbewijsNummer, rightX + 88, 388, 8.5, font);

    // Impact points (box 10 op echt formulier zit rond y≈300). We tekenen
    // kleine diagrammen links/rechts als indicatief overzicht.
    drawImpactBox(page1, font, leftX + 40, 230, 70, 90, state.impactPartyA, "A");
    drawImpactBox(page1, font, rightX + 40, 230, 70, 90, state.impactPartyB, "B");

    // Signatures (onderaan, vakken 15)
    await embedSignaturePng(pdfDoc, page1, state.signaturePartyA, leftX + 40, 90, 180, 60);
    await embedSignaturePng(pdfDoc, page1, state.signaturePartyB, rightX + 40, 90, 180, 60);

    // Type ongeval + detail in een margebanner onderaan.
    const catLabel = getSituationCategoryLabel(state.situationCategory);
    const detailLabel = getSituationDetailLabel(
      state.situationCategory,
      state.situationDetailKey,
    );
    const manA = getManeuverLabel("A", state.maneuverAKey);
    const manB = getManeuverLabel("B", state.maneuverBKey);
    drawLabel(
      page1,
      [catLabel, detailLabel].filter(Boolean).join(" · "),
      leftX,
      60,
      8,
      font,
      500,
    );
    if (manA || manB) {
      drawLabel(
        page1,
        `A: ${manA || "—"} | B: ${manB || "—"}`,
        leftX,
        48,
        8,
        font,
        500,
      );
    }

    const pdfBytes = await pdfDoc.save();

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `${asAttachment ? "attachment" : "inline"}; filename="aanrijdingsformulier-${id}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    console.error("[pdf] generation failed", e);
    const message = e instanceof Error ? e.message : "unknown_error";
    return NextResponse.json(
      { error: "pdf_generation_failed", detail: message },
      { status: 500 },
    );
  }
}
