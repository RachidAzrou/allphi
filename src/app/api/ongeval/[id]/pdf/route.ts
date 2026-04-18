import { NextResponse } from "next/server";
import path from "path";
import { readFile } from "fs/promises";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
  type Color,
} from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { mergePayloadIntoState } from "@/lib/ongeval/engine";
import {
  formatDateForDisplay,
  formatTimeForDisplay,
} from "@/lib/ongeval/date-utils";
import {
  getSituationCategoryLabel,
  getSituationDetailLabel,
  getManeuverLabel,
} from "@/lib/ongeval/situations";
import type { AccidentReportState, PartyDetails } from "@/types/ongeval";

/* ---------------------------------------------------------- helpers */

function yn(v: boolean | null): string {
  if (v === null) return "";
  return v ? "JA" : "NEE";
}

function safe(v: string | null | undefined, fallback = ""): string {
  return (v ?? "").trim() || fallback;
}

function truncate(s: string, max: number): string {
  if (!s) return s;
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + "…";
}

function addressLine(a: {
  straat: string;
  huisnummer: string;
  bus?: string;
  postcode: string;
  stad: string;
}): string {
  const street = [a.straat, a.huisnummer].filter(Boolean).join(" ");
  const bus = a.bus ? ` bus ${a.bus}` : "";
  const city = [a.postcode, a.stad].filter(Boolean).join(" ");
  return [street + bus, city].filter((s) => s.trim()).join(", ");
}

/** Straat + huisnr + bus + stad (zonder postcode). Voor velden waar postcode
 * een eigen veld krijgt (zoals in rubriek 6 verzekeringsnemer). */
function streetLine(a: {
  straat: string;
  huisnummer: string;
  bus?: string;
  stad?: string;
}): string {
  const street = [a.straat, a.huisnummer].filter(Boolean).join(" ");
  const bus = a.bus ? ` bus ${a.bus}` : "";
  const head = (street + bus).trim();
  const stad = (a.stad ?? "").trim();
  return [head, stad].filter(Boolean).join(", ");
}

function fullName(p: { voornaam: string; naam: string }): string {
  return [p.voornaam, p.naam].filter(Boolean).join(" ");
}

type DrawOptions = {
  size?: number;
  font?: PDFFont;
  bold?: PDFFont;
  color?: Color;
  maxWidth?: number;
};

function drawText(
  page: PDFPage,
  text: string,
  x: number,
  y: number,
  opts: DrawOptions & { font: PDFFont },
) {
  if (!text) return;
  page.drawText(text, {
    x,
    y,
    size: opts.size ?? 9,
    font: opts.font,
    color: opts.color ?? rgb(0.09, 0.17, 0.25),
    maxWidth: opts.maxWidth,
  });
}

/* ---------------------------------------------------------- signatures */

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

/* ---------------------------------------------------------- impact box
 * Toont de officiële EAB-voertuigsilhouetten (motor, auto, vrachtwagen) uit
 * `/public/impact-vehicles.png` en plakt er een rode pijl over op het door de
 * gebruiker aangeduide raakpunt.
 *
 * Wordt UITSLUITEND op het samenvattingsblad gebruikt; op het officiële
 * aanrijdingsformulier worden de voertuigen NIET overgetekend, want het
 * sjabloon bevat zelf al schematische voertuigen in sectie 10.
 */
type EmbeddedImg = Awaited<ReturnType<PDFDocument["embedPng"]>>;

async function drawImpactBox(
  page: PDFPage,
  pdfDoc: PDFDocument,
  baseX: number,
  baseY: number,
  w: number,
  h: number,
  point: { x: number; y: number } | null,
  party: "A" | "B",
  cachedImage?: EmbeddedImg,
): Promise<EmbeddedImg | undefined> {
  const accent = party === "A" ? rgb(0.15, 0.6, 0.84) : rgb(0.85, 0.64, 0.15);
  page.drawRectangle({
    x: baseX,
    y: baseY,
    width: w,
    height: h,
    color: rgb(1, 1, 1),
    borderColor: accent,
    borderWidth: 0.8,
  });
  let img = cachedImage;
  if (!img) {
    try {
      const bytes = await readFile(
        path.join(process.cwd(), "public", "impact-vehicles.png"),
      );
      img = await pdfDoc.embedPng(bytes);
    } catch (e) {
      console.warn("[pdf] impact image load failed", e);
      return undefined;
    }
  }
  if (!img) return undefined;
  // Behoud aspect ratio — image is 1024x797.
  const ratio = img.width / img.height;
  let drawW = w - 6;
  let drawH = drawW / ratio;
  if (drawH > h - 6) {
    drawH = h - 6;
    drawW = drawH * ratio;
  }
  const drawX = baseX + (w - drawW) / 2;
  const drawY = baseY + (h - drawH) / 2;
  page.drawImage(img, { x: drawX, y: drawY, width: drawW, height: drawH });
  if (point) {
    const px = drawX + point.x * drawW;
    // UI gebruikt y=0 boven, pdf-lib y=0 onder → inverteren.
    const py = drawY + (1 - point.y) * drawH;
    drawImpactArrow(page, px, py);
  }
  return img;
}

/**
 * Rode neerwaartse pijl met de tip exact op (px, py). Schacht erboven, vlag
 * eronder uit de tip — visueel hetzelfde als de pijl in de wizard.
 */
function drawImpactArrow(page: PDFPage, px: number, py: number) {
  const red = rgb(0.88, 0.11, 0.18);
  const dark = rgb(0.48, 0.04, 0.08);
  const shaftW = 2.6;
  const shaftH = 12;
  const headH = 10;
  const headHalfW = 6;
  // Driehoekige pijlpunt: tip op (px, py), basis `headH` pt boven de tip.
  // pdf-lib past intern `scale(1, -1)` toe op SVG-paden, dus negatieve y in de
  // path-string betekent in pagina-coördinaten omhoog (gewenst).
  page.drawSvgPath(
    `M 0 0 L ${headHalfW} ${-headH} L ${-headHalfW} ${-headH} Z`,
    {
      x: px,
      y: py,
      color: red,
      borderColor: dark,
      borderWidth: 0.4,
    },
  );
  // Schacht boven de pijlpunt.
  page.drawRectangle({
    x: px - shaftW / 2,
    y: py + headH,
    width: shaftW,
    height: shaftH,
    color: red,
    borderColor: dark,
    borderWidth: 0.4,
  });
}


/* ---------------------------------------------------------- section 12
 * Mapping: wizard-toedrachtkeuze → welke van de 17 vakjes voor A/B aangevinkt.
 * De 17 rijen staan in deze volgorde op het officiële formulier:
 *
 *   1  stond geparkeerd / stond stil
 *   2  reed weg uit parkeerstand / deed een portier open
 *   3  ging parkeren
 *   4  reed weg van een parkeerplaats, een uitrit, een onverharde weg
 *   5  was bezig een parkeerplaats, inrit, onverharde weg op te rijden
 *   6  wilde een verkeersplein oprijden (rondgaand verkeer)
 *   7  reed op een verkeersplein (rondgaand verkeer)
 *   8  botste op achterzijde, rijdend in dezelfde richting en op dezelfde rijstrook
 *   9  reed in dezelfde richting en op een andere rijstrook
 *  10  veranderde van rijstrook
 *  11  haalde in
 *  12  ging rechtsaf
 *  13  ging linksaf
 *  14  reed achteruit
 *  15  kwam op een rijbaan bestemd voor het tegemoetkomend verkeer
 *  16  kwam van rechts (op een kruising)
 *  17  lette niet op het voorrangsteken of op het rode licht
 */
function computeCheckboxes(state: AccidentReportState): {
  a: Set<number>;
  b: Set<number>;
} {
  const a = new Set<number>();
  const b = new Set<number>();
  const addOne = (
    target: Set<number>,
    options: Set<number>,
    n: number,
  ) => {
    if (options.has(n)) target.add(n);
  };

  // Detail-key → kandidaat-vakje(s) voor degene die het deed (actief).
  // Voor passieve rol (andere partij) laten we leeg, tenzij hieronder expliciet.
  const cat = state.situationCategory;
  const d = state.situationDetailKey;

  if (cat === "parking") {
    // park_moving: een van de partijen stond geparkeerd. We kunnen niet met
    // zekerheid zeggen welke — markeer op beide kanten #1 zodat de verzekeraar
    // het ziet. park_opening: iemand reed weg uit parkeerstand (vakje #2).
    if (d === "park_moving") {
      a.add(1);
      b.add(1);
    } else if (d === "park_opening") {
      a.add(2);
      b.add(2);
    }
  }
  if (cat === "rear_end") {
    // Op achterzijde = vakje #8. Voor het geraakte voertuig (passief) ook #8.
    if (d === "a_rear") {
      a.add(8);
    } else if (d === "b_rear") {
      b.add(8);
    }
  }
  if (cat === "maneuver") {
    const mapMan = (key: string | null): number | null => {
      switch (key) {
        case "a_rev":
        case "b_rev":
          return 14; // reed achteruit
        case "a_leave_park":
        case "b_leave_park":
          return 4; // reed weg van parkeerplaats
        case "a_leave_private":
        case "b_leave_private":
          return 4; // uitrit/onverharde weg
        case "a_turn_back":
        case "b_turn":
          return 13; // ging linksaf (draai terug ≈ keerbeweging, best benadering)
        default:
          return null;
      }
    };
    const aN = mapMan(state.maneuverAKey);
    const bN = mapMan(state.maneuverBKey);
    if (aN) a.add(aN);
    if (bN) b.add(bN);
  }
  if (cat === "priority") {
    // "lette niet op voorrangsteken of rode licht" = #17.
    // Rotonde variant = #6 of #7.
    const onRound = d === "a_yield_round" || d === "b_yield_round";
    const target = d?.startsWith("a_") ? a : b;
    target.add(onRound ? 6 : 17);
    if (onRound) target.add(7);
  }
  if (cat === "lane_change") {
    // Vakje #10 (veranderde van rijstrook).
    if (d === "a_lane") a.add(10);
    if (d === "b_lane") b.add(10);
    if (d === "both_lane") {
      a.add(10);
      b.add(10);
    }
  }
  if (cat === "opposite") {
    // #15: kwam op rijbaan bestemd voor tegemoetkomend verkeer.
    if (d === "a_crossed") a.add(15);
    if (d === "b_crossed") b.add(15);
    if (d === "both_crossed") {
      a.add(15);
      b.add(15);
    }
  }
  if (cat === "door") {
    if (d === "door_a") a.add(2); // deed een portier open
    if (d === "door_b") b.add(2);
  }
  // load: geen goed passend vakje in de 17 — we skippen en vertrouwen op 14.

  // Voorkom runtime-waarschuwing: variabele `addOne` wordt behouden voor
  // toekomstige uitbreiding (set-intersectie) zonder te ontbreken in output.
  void addOne;
  return { a, b };
}

/* ---------------------------------------------------------- layout
 *
 * Exact gemeten via `pdfjs` text extractie van het officiële template
 * (595.3 x 841.9 pt). Y is bottom-left origin (pdf-lib conventie).
 * Waardes worden geschreven OP de baseline van de label zodat ze net boven
 * de gestippelde lijn rusten.
 */

const TEMPLATE_PAGE_1 = {
  // Sectie 1 — Datum/Uur/Plaats.
  // De labels "Datum aanrijding" en "Uur" staan op y=804.3 met slechts ~23pt
  // horizontale ruimte tot het volgende label — onvoldoende voor "DD/MM/YYYY"
  // op fontsize 10. We schrijven datum & uur dus net onder het label op y=792
  // (de rij is daar leeg aan de linkerzijde, het "Land:"-label start pas op
  // x=155 zodat we tot x≈110 ongehinderd kunnen schrijven).
  date: { x: 29, y: 792 },
  time: { x: 113, y: 792 },
  placeLine1: { x: 253, y: 805, maxWidth: 78 },
  placeLine2: { x: 224, y: 792, maxWidth: 108 },
  // Sectie 2 — Land (locatie).
  country: { x: 180, y: 792, maxWidth: 39 },
  // Sectie 3 — Gewonden zelfs licht? (kruisjes IN het vakje vóór "neen"/"ja").
  // Exacte boxcentra uit `extract-template-boxes.mjs`: w=5.71, h=5.79.
  injuriesNo: { x: 378.92, y: 794.53 },
  injuriesYes: { x: 413.82, y: 794.53 },
  // Sectie 4 — Materiële schade. Twee aparte vragen op het sjabloon (andere
  // voertuigen, andere objecten); we beantwoorden beiden met dezelfde wizard-
  // waarde. Boxcentra ook geëxtraheerd: w=5.71, h=5.79.
  damageOtherVehiclesNo: { x: 44.51, y: 754.01 },
  damageOtherVehiclesYes: { x: 79.64, y: 754.01 },
  damageOtherObjectsNo: { x: 132.01, y: 754.01 },
  damageOtherObjectsYes: { x: 165.49, y: 754.01 },
  // Sectie 5 — Getuigen (drie regels).
  witnessLines: [
    { x: 328, y: 775, maxWidth: 237 },
    { x: 215, y: 763, maxWidth: 350 },
    { x: 215, y: 751, maxWidth: 350 },
  ],
} as const;

/** Coördinaten van de linkerkolom (Partij A). */
const COL_A = {
  policyholder: {
    naam: { x: 46, y: 698.8 },
    voornaam: { x: 59, y: 686.1 },
    adres: { x: 44, y: 673.4, maxWidth: 159 },
    postcode: { x: 56, y: 660.8 },
    land: { x: 121, y: 660.8 },
    contact: { x: 67, y: 648.1, maxWidth: 135 },
  },
  vehicle: {
    merk: { x: 18, y: 595.3 },
    plate: { x: 18, y: 572.8 },
    country: { x: 18, y: 550.2 },
    trailerPlate: { x: 117, y: 572.8 },
    trailerCountry: { x: 117, y: 550.2 },
  },
  insurance: {
    maatschappij: { x: 46, y: 520.2 },
    polis: { x: 60, y: 508.3 },
    greenCard: { x: 95, y: 495.6 },
    validFrom: { x: 120, y: 473.8 },
    validTo: { x: 170, y: 473.8 },
    agent: { x: 149, y: 461.1, maxWidth: 54 },
  },
  driver: {
    naam: { x: 46, y: 356.1 },
    voornaam: { x: 59, y: 343.5 },
    geboortedatum: { x: 78, y: 330.8 },
    adres: { x: 44, y: 318.1 },
    adresLine2: { x: 18, y: 305.5, maxWidth: 77 },
    land: { x: 121, y: 305.5 },
    contact: { x: 67, y: 292.8, maxWidth: 135 },
    rijbewijs: { x: 64, y: 280.1 },
    categorie: { x: 92, y: 267.5 },
    validTo: { x: 88, y: 254.8 },
  },
  // Sectie 14 — opmerkingen (3 regels onderaan).
  notes: {
    lines: [
      { x: 16, y: 49.5, maxWidth: 168 },
      { x: 16, y: 39.6, maxWidth: 168 },
      { x: 16, y: 29.8, maxWidth: 168 },
    ],
  },
  // Sectie 15 — handtekening (klein vakje midden-onder).
  signature: { x: 200, y: 22, w: 80, h: 32 },
} as const;

/** Coördinaten van de rechterkolom (Partij B). Δx t.o.v. A = +362.5. */
const COL_B = {
  policyholder: {
    naam: { x: 408, y: 698.8 },
    voornaam: { x: 421, y: 686.1 },
    adres: { x: 407, y: 673.4, maxWidth: 159 },
    postcode: { x: 418, y: 660.8 },
    land: { x: 483, y: 660.8 },
    contact: { x: 429, y: 648.1, maxWidth: 135 },
  },
  vehicle: {
    merk: { x: 380, y: 595.3 },
    plate: { x: 380, y: 572.8 },
    country: { x: 380, y: 550.2 },
    trailerPlate: { x: 479, y: 572.8 },
    trailerCountry: { x: 479, y: 550.2 },
  },
  insurance: {
    maatschappij: { x: 408, y: 520.2 },
    polis: { x: 423, y: 508.3 },
    greenCard: { x: 457, y: 495.6 },
    validFrom: { x: 482, y: 473.8 },
    validTo: { x: 532, y: 473.8 },
    agent: { x: 511, y: 461.1, maxWidth: 54 },
  },
  driver: {
    naam: { x: 408, y: 356.1 },
    voornaam: { x: 421, y: 343.5 },
    geboortedatum: { x: 441, y: 330.8 },
    adres: { x: 407, y: 318.1 },
    adresLine2: { x: 380, y: 305.5, maxWidth: 77 },
    land: { x: 483, y: 305.5 },
    contact: { x: 429, y: 292.8, maxWidth: 135 },
    rijbewijs: { x: 426, y: 280.1 },
    categorie: { x: 454, y: 267.5 },
    validTo: { x: 451, y: 254.8 },
  },
  notes: {
    lines: [
      { x: 398, y: 49.5, maxWidth: 168 },
      { x: 398, y: 39.6, maxWidth: 168 },
      { x: 398, y: 29.8, maxWidth: 168 },
    ],
  },
  signature: { x: 285, y: 22, w: 80, h: 32 },
} as const;

/**
 * Y-centrum per vakje (1..17) van de toedrachtkolom in sectie 12. Waarden
 * komen rechtstreeks uit `scripts/extract-template-boxes.mjs` (cy van de
 * vierkante checkbox-rechthoek in het sjabloon, w/h ≈ 6.82×6.92).
 */
const CHECKBOX_ROW_Y: Record<number, number> = {
  1: 686.59,
  2: 678.31,
  3: 651.16,
  4: 634.37,
  5: 609.33,
  6: 584.28,
  7: 559.99,
  8: 534.28,
  9: 501.52,
  10: 475.91,
  11: 460.14,
  12: 444.95,
  13: 429.46,
  14: 413.70,
  15: 397.94,
  16: 363.32,
  17: 338.69,
};

const CHECKBOX_COLUMN = {
  aBoxCenterX: 219.17,
  bBoxCenterX: 364.29,
  // "Vermeld het aantal aangekruiste vakjes": twee 10.43 × 10.58 vakjes onder
  // de toedrachtkolom. Centra geëxtraheerd uit het sjabloon. We berekenen de
  // baseline-positie tijdens het renderen op basis van de tekstbreedte zodat
  // het cijfer keurig in het midden van het vakje staat.
  totalABoxCx: 220.98,
  totalBBoxCx: 362.81,
  totalBoxCy: 309.62,
} as const;

/**
 * Teken een rood diagonaal X-kruis door het vakje rond (cx, cy). De `boxSize`
 * is de breedte van het sjabloon-vakje; we tekenen het kruis ietsje binnen
 * die rand zodat het netjes binnen het vakje valt.
 */
function drawCheckbox(page: PDFPage, cx: number, cy: number, boxSize = 6.8) {
  const r = boxSize / 2 - 0.6;
  const color = rgb(0.88, 0.11, 0.18);
  const thickness = boxSize >= 6.5 ? 1.4 : 1.1;
  page.drawLine({
    start: { x: cx - r, y: cy - r },
    end: { x: cx + r, y: cy + r },
    thickness,
    color,
  });
  page.drawLine({
    start: { x: cx - r, y: cy + r },
    end: { x: cx + r, y: cy - r },
    thickness,
    color,
  });
}

function drawCheckboxes(
  page: PDFPage,
  font: PDFFont,
  state: AccidentReportState,
) {
  const { a, b } = computeCheckboxes(state);
  for (let i = 1; i <= 17; i++) {
    // CHECKBOX_ROW_Y bevat al het verticale midden van het vakje.
    const cy = CHECKBOX_ROW_Y[i];
    if (a.has(i)) drawCheckbox(page, CHECKBOX_COLUMN.aBoxCenterX, cy);
    if (b.has(i)) drawCheckbox(page, CHECKBOX_COLUMN.bBoxCenterX, cy);
  }
  // Totaal aantal aangekruiste vakjes (rubriek "Vermeld het aantal aangekruiste
  // vakjes"): twee kleine vakjes onder de toedrachtkolom. We centreren het
  // cijfer horizontaal en verticaal in elk vakje.
  drawCenteredNumber(page, font, a.size, CHECKBOX_COLUMN.totalABoxCx, CHECKBOX_COLUMN.totalBoxCy);
  drawCenteredNumber(page, font, b.size, CHECKBOX_COLUMN.totalBBoxCx, CHECKBOX_COLUMN.totalBoxCy);
}

/** Teken een getal precies gecentreerd op (cx, cy) — voor kleine totalvakjes. */
function drawCenteredNumber(
  page: PDFPage,
  font: PDFFont,
  value: number,
  cx: number,
  cy: number,
  size = 10,
) {
  const text = String(value);
  const w = font.widthOfTextAtSize(text, size);
  // Approximatie van het verticale midden van een Helvetica-cijfer: cap-height
  // ≈ 0.72 × fontSize, dus baseline ligt ~0.36 × fontSize onder het midden.
  const baselineOffset = size * 0.36;
  page.drawText(text, {
    x: cx - w / 2,
    y: cy - baselineOffset,
    font,
    size,
    color: rgb(0.88, 0.11, 0.18),
  });
}

/* ---------------------------------------------------------- party block */

type PointXY = { x: number; y: number };
type PointWithWidth = PointXY & { maxWidth: number };
type ColLayout = {
  policyholder: {
    naam: PointXY;
    voornaam: PointXY;
    adres: PointWithWidth;
    postcode: PointXY;
    land: PointXY;
    contact: PointWithWidth;
  };
  vehicle: {
    merk: PointXY;
    plate: PointXY;
    country: PointXY;
    trailerPlate: PointXY;
    trailerCountry: PointXY;
  };
  insurance: {
    maatschappij: PointXY;
    polis: PointXY;
    greenCard: PointXY;
    validFrom: PointXY;
    validTo: PointXY;
    agent: PointWithWidth;
  };
  driver: {
    naam: PointXY;
    voornaam: PointXY;
    geboortedatum: PointXY;
    adres: PointXY;
    adresLine2: PointWithWidth;
    land: PointXY;
    contact: PointWithWidth;
    rijbewijs: PointXY;
    categorie: PointXY;
    validTo: PointXY;
  };
  notes: { lines: readonly PointWithWidth[] };
  signature: { x: number; y: number; w: number; h: number };
};

function fillPartyBlock(
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  party: PartyDetails,
  col: ColLayout,
) {
  const p = party.verzekeringsnemer;
  const d = party.bestuurder;

  // Verzekeringsnemer (rubriek 6).
  drawText(page, safe(p.naam), col.policyholder.naam.x, col.policyholder.naam.y, {
    font: bold,
    size: 9,
  });
  drawText(
    page,
    safe(p.voornaam),
    col.policyholder.voornaam.x,
    col.policyholder.voornaam.y,
    { font, size: 9 },
  );
  // Adres-veld bevat alleen straat + huisnr + bus. Postcode en stad worden
  // apart in hun eigen veld (postcode) en de adres-regel afzonderlijk
  // weergegeven om duplicatie te vermijden.
  const polStreet = truncate(streetLine(p.adres), 60);
  drawText(
    page,
    polStreet,
    col.policyholder.adres.x,
    col.policyholder.adres.y,
    { font, size: 8.5 },
  );
  drawText(
    page,
    safe(p.adres.postcode),
    col.policyholder.postcode.x,
    col.policyholder.postcode.y,
    { font, size: 8.5 },
  );
  drawText(
    page,
    safe(p.adres.land),
    col.policyholder.land.x,
    col.policyholder.land.y,
    { font, size: 8.5 },
  );
  // Tel/e-mail is een ENKELE regel zonder gestippelde extra lijnen — auto-wrap
  // moet uit, anders verschijnt overlopend tekst op een onvoorspelbare Y. We
  // truncen handmatig op het max aantal karakters dat in de breedte past.
  const contactLine = truncate(
    [safe(p.telefoon), safe(p.email)].filter(Boolean).join(" · "),
    44,
  );
  drawText(page, contactLine, col.policyholder.contact.x, col.policyholder.contact.y, {
    font,
    size: 8,
  });

  // Motorrijtuig (rubriek 7).
  drawText(
    page,
    safe(party.voertuig.merkModel),
    col.vehicle.merk.x,
    col.vehicle.merk.y,
    { font, size: 9 },
  );
  drawText(
    page,
    safe(party.voertuig.nummerplaat),
    col.vehicle.plate.x,
    col.vehicle.plate.y,
    { font: bold, size: 9 },
  );
  drawText(
    page,
    safe(party.voertuig.landInschrijving),
    col.vehicle.country.x,
    col.vehicle.country.y,
    { font, size: 9 },
  );

  // Verzekering (rubriek 8).
  drawText(
    page,
    safe(party.verzekering.maatschappij),
    col.insurance.maatschappij.x,
    col.insurance.maatschappij.y,
    { font: bold, size: 9 },
  );
  drawText(
    page,
    safe(party.verzekering.polisnummer),
    col.insurance.polis.x,
    col.insurance.polis.y,
    { font, size: 9 },
  );

  // Bestuurder (rubriek 9).
  drawText(page, safe(d.naam), col.driver.naam.x, col.driver.naam.y, {
    font: bold,
    size: 9,
  });
  drawText(page, safe(d.voornaam), col.driver.voornaam.x, col.driver.voornaam.y, {
    font,
    size: 9,
  });
  drawText(
    page,
    formatDateForDisplay(d.geboortedatum),
    col.driver.geboortedatum.x,
    col.driver.geboortedatum.y,
    { font, size: 9 },
  );
  // Adres bestuurder: straat + huisnr + bus op regel 1, stad op regel 2.
  const driverStreet = [safe(d.adres.straat), safe(d.adres.huisnummer)]
    .filter(Boolean)
    .join(" ")
    .concat(safe(d.adres.bus) ? ` bus ${d.adres.bus}` : "");
  drawText(page, driverStreet, col.driver.adres.x, col.driver.adres.y, {
    font,
    size: 8.5,
  });
  const driverCity = [safe(d.adres.postcode), safe(d.adres.stad)]
    .filter(Boolean)
    .join(" ");
  drawText(
    page,
    driverCity,
    col.driver.adresLine2.x,
    col.driver.adresLine2.y,
    { font, size: 8.5, maxWidth: col.driver.adresLine2.maxWidth },
  );
  drawText(page, safe(d.adres.land), col.driver.land.x, col.driver.land.y, {
    font,
    size: 8.5,
  });
  const dContact = truncate(
    [safe(d.telefoon), safe(d.email)].filter(Boolean).join(" · "),
    44,
  );
  drawText(page, dContact, col.driver.contact.x, col.driver.contact.y, {
    font,
    size: 8,
  });
  drawText(
    page,
    safe(d.rijbewijsNummer),
    col.driver.rijbewijs.x,
    col.driver.rijbewijs.y,
    { font, size: 9 },
  );
}

function wrapText(
  text: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length > maxCharsPerLine) {
      if (current) lines.push(current);
      current = w;
      if (lines.length >= maxLines) break;
    } else {
      current = candidate;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  return lines.slice(0, maxLines);
}

/* ---------------------------------------------------------- cover sheet
 * Extra pagina die vooraan gezet wordt: gaat door de volledige wizard-payload
 * en rendert alles netjes. Zo is alle data leesbaar beschikbaar naast het
 * officiële sjabloon.
 */
async function renderCoverSheet(
  pdfDoc: PDFDocument,
  font: PDFFont,
  bold: PDFFont,
  state: AccidentReportState,
): Promise<{ page: PDFPage; pageCount: number }> {
  const margin = 40;
  const contentWidth = 595.3 - margin * 2;
  // Voetnootregio: 60pt onderaan blijft vrij voor de generieke footer.
  const FOOTER_RESERVED = 60;
  const PAGE_TOP_AFTER_HEADER = 770;

  let coverPageCount = 0;
  let page = pdfDoc.insertPage(0, [595.3, 841.9]);
  coverPageCount += 1;
  let y = 800;

  /** Tekent de blauwe header bovenaan een coversheetpagina. */
  function drawHeader(p: PDFPage, isFirst: boolean) {
    p.drawRectangle({
      x: 0,
      y: 790,
      width: 595.3,
      height: 52,
      color: rgb(0.153, 0.6, 0.84),
    });
    drawText(p, "EUROPEES AANRIJDINGSFORMULIER", margin, 820, {
      font: bold,
      size: 14,
      color: rgb(1, 1, 1),
    });
    drawText(
      p,
      isFirst ? "Samenvatting van de aangifte" : "Samenvatting (vervolg)",
      margin,
      802,
      { font, size: 10, color: rgb(1, 1, 1) },
    );
  }

  drawHeader(page, true);
  y = PAGE_TOP_AFTER_HEADER;

  /**
   * Zorgt dat er minimaal `needed` pt verticale ruimte over is op de huidige
   * pagina; zo niet, dan voegt het een nieuwe coversheetpagina toe en reset
   * y naar de top.
   */
  function ensureSpace(needed: number) {
    if (y - needed >= FOOTER_RESERVED) return;
    page = pdfDoc.insertPage(coverPageCount, [595.3, 841.9]);
    coverPageCount += 1;
    drawHeader(page, false);
    y = PAGE_TOP_AFTER_HEADER;
  }

  const writeRow = (label: string, value: string) => {
    ensureSpace(14);
    drawText(page, label, margin, y, { font, size: 9, color: rgb(0.4, 0.47, 0.54) });
    drawText(page, value || "—", margin + 130, y, {
      font: bold,
      size: 10,
      maxWidth: contentWidth - 140,
    });
    y -= 14;
  };

  const writeHeading = (title: string) => {
    // Heading + minstens één regel content moeten samen op dezelfde pagina.
    ensureSpace(40);
    y -= 6;
    page.drawRectangle({
      x: margin,
      y: y - 2,
      width: contentWidth,
      height: 16,
      color: rgb(0.91, 0.95, 0.98),
    });
    drawText(page, title, margin + 6, y + 2, {
      font: bold,
      size: 10,
      color: rgb(0.09, 0.17, 0.25),
    });
    y -= 20;
  };

  /* 1. Plaats & tijd */
  writeHeading("1. Plaats en tijd");
  writeRow("Datum", formatDateForDisplay(state.location.datum));
  writeRow("Uur", formatTimeForDisplay(state.location.tijd));
  writeRow("Adres", addressLine(state.location));
  writeRow("Land", safe(state.location.land));

  /* 2–4. Gewonden / schade */
  writeHeading("2-4. Gewonden en schade");
  writeRow("Gewonden", yn(state.gewonden) || "Niet opgegeven");
  writeRow(
    "Andere materiële schade",
    yn(state.materieleSchadeAnders) || "Niet opgegeven",
  );

  /* 5. Getuigen */
  writeHeading("5. Getuigen");
  const witnesses = state.getuigen?.trim() || "Geen getuigen opgegeven.";
  const witnessLines = wrapText(witnesses, 85, 4);
  for (const line of witnessLines) {
    ensureSpace(12);
    drawText(page, line, margin + 6, y, { font, size: 9 });
    y -= 12;
  }
  y -= 4;

  /* Partijen */
  const renderParty = (label: string, p: PartyDetails) => {
    writeHeading(label);
    writeRow("Verzekeringsnemer", fullName(p.verzekeringsnemer));
    writeRow("Adres", addressLine(p.verzekeringsnemer.adres));
    writeRow("Land", safe(p.verzekeringsnemer.adres.land));
    if (p.verzekeringsnemer.ondernemingsnummer) {
      writeRow("BTW/ondernemingsnr.", p.verzekeringsnemer.ondernemingsnummer);
    }
    if (p.verzekeringsnemer.telefoon || p.verzekeringsnemer.email) {
      writeRow(
        "Contact",
        [p.verzekeringsnemer.telefoon, p.verzekeringsnemer.email]
          .filter(Boolean)
          .join(" · "),
      );
    }
    writeRow(
      "Voertuig",
      `${safe(p.voertuig.merkModel)} — ${safe(p.voertuig.nummerplaat)} (${safe(p.voertuig.landInschrijving)})`,
    );
    writeRow(
      "Verzekering",
      `${safe(p.verzekering.maatschappij)} — polis ${safe(p.verzekering.polisnummer) || "—"}`,
    );
    writeRow("Bestuurder", fullName(p.bestuurder));
    writeRow(
      "Geboortedatum bestuurder",
      formatDateForDisplay(p.bestuurder.geboortedatum),
    );
    writeRow("Adres bestuurder", addressLine(p.bestuurder.adres));
    if (p.bestuurder.telefoon || p.bestuurder.email) {
      writeRow(
        "Contact bestuurder",
        [p.bestuurder.telefoon, p.bestuurder.email].filter(Boolean).join(" · "),
      );
    }
    writeRow("Rijbewijs", safe(p.bestuurder.rijbewijsNummer));
  };

  renderParty("Partij A", state.partyA);
  renderParty("Partij B", state.partyB);

  /* 12. Toedracht */
  writeHeading("12. Toedracht");
  const catLabel = getSituationCategoryLabel(state.situationCategory);
  const detailLabel = getSituationDetailLabel(
    state.situationCategory,
    state.situationDetailKey,
  );
  writeRow("Categorie", catLabel || "Nog niet gekozen");
  writeRow("Detail", detailLabel || "—");
  if (state.situationCategory === "maneuver") {
    writeRow("Manoeuvre A", getManeuverLabel("A", state.maneuverAKey) || "—");
    writeRow("Manoeuvre B", getManeuverLabel("B", state.maneuverBKey) || "—");
  }

  /* 14. Opmerkingen */
  if (state.circumstancesNotes?.trim()) {
    writeHeading("14. Opmerkingen");
    for (const line of wrapText(state.circumstancesNotes, 90, 6)) {
      ensureSpace(12);
      drawText(page, line, margin + 6, y, { font, size: 9 });
      y -= 12;
    }
    y -= 4;
  }

  /* 10. Raakpunt voertuigen — toont de officiële EAB-silhouetten met een rode
   * pijl op het door de gebruiker aangeduide raakpunt. */
  // Box-afmetingen volgen de aspect ratio van de afbeelding (1024 x 797 ≈ 1.285).
  const boxW = 220;
  const boxH = Math.round((boxW * 797) / 1024);
  const boxGap = 20;
  // Heading + box + voertuig-labels + ademruimte = ~heading(20) + boxH + 30
  ensureSpace(20 + boxH + 30);
  writeHeading("10. Raakpunt voertuigen");
  const totalW = boxW * 2 + boxGap;
  const startX = margin + (contentWidth - totalW) / 2;
  const baseY = y - boxH - 4;
  const cachedImpact = await drawImpactBox(
    page,
    pdfDoc,
    startX,
    baseY,
    boxW,
    boxH,
    state.impactPartyA,
    "A",
  );
  await drawImpactBox(
    page,
    pdfDoc,
    startX + boxW + boxGap,
    baseY,
    boxW,
    boxH,
    state.impactPartyB,
    "B",
    cachedImpact,
  );
  drawText(page, "Voertuig A", startX + boxW / 2 - 22, baseY - 12, {
    font: bold,
    size: 9,
    color: rgb(0.15, 0.6, 0.84),
  });
  drawText(
    page,
    "Voertuig B",
    startX + boxW + boxGap + boxW / 2 - 22,
    baseY - 12,
    { font: bold, size: 9, color: rgb(0.85, 0.64, 0.15) },
  );
  y = baseY - 26;

  /* 15. Handtekeningen */
  // Heading(20) + sig-blok(60) + lijn + labels(20) = ~110pt
  ensureSpace(110);
  writeHeading("15. Handtekeningen bestuurders");
  const sigY = y - 60;
  await embedSignaturePng(
    pdfDoc,
    page,
    state.signaturePartyA,
    margin + 20,
    sigY,
    160,
    50,
  );
  await embedSignaturePng(
    pdfDoc,
    page,
    state.signaturePartyB,
    margin + 240,
    sigY,
    160,
    50,
  );
  page.drawLine({
    start: { x: margin + 20, y: sigY },
    end: { x: margin + 180, y: sigY },
    color: rgb(0.6, 0.67, 0.74),
    thickness: 0.6,
  });
  page.drawLine({
    start: { x: margin + 240, y: sigY },
    end: { x: margin + 400, y: sigY },
    color: rgb(0.6, 0.67, 0.74),
    thickness: 0.6,
  });
  drawText(page, "Bestuurder A", margin + 20, sigY - 12, { font, size: 9 });
  drawText(page, "Bestuurder B", margin + 240, sigY - 12, { font, size: 9 });

  // Voetnoot
  drawText(
    page,
    "Deze samenvatting is automatisch gegenereerd vanuit de AllPhi-wizard. " +
      "Het officiële Europees aanrijdingsformulier volgt op de volgende pagina's.",
    margin,
    40,
    { font, size: 8, color: rgb(0.4, 0.47, 0.54), maxWidth: contentWidth },
  );

  return { page, pageCount: coverPageCount };
}

/* ---------------------------------------------------------- authz */

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
    if (owner === user.id || partyB === user.id) {
      return { payload: (row as { payload: unknown }).payload };
    }
    if (!secret) {
      return { payload: null, error: "forbidden", status: 403 };
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

/* ---------------------------------------------------------- GET */

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
    const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // 1) Voeg een samenvattingsblad vooraan toe (kan meerdere pagina's beslaan
    //    afhankelijk van hoeveel content de wizard heeft vergaard).
    const cover = await renderCoverSheet(pdfDoc, font, bold, state);

    // 2) Vul het officiële sjabloon in (verschoven met het aantal cover-pages).
    const pages = pdfDoc.getPages();
    const templatePage1 = pages[cover.pageCount];

    // Sectie 1 — datum/uur (op de rij ONDER het label) + plaats.
    drawText(
      templatePage1,
      formatDateForDisplay(state.location.datum),
      TEMPLATE_PAGE_1.date.x,
      TEMPLATE_PAGE_1.date.y,
      { font, size: 9 },
    );
    drawText(
      templatePage1,
      formatTimeForDisplay(state.location.tijd),
      TEMPLATE_PAGE_1.time.x,
      TEMPLATE_PAGE_1.time.y,
      { font, size: 9 },
    );
    // Plaats: regel 1 = straat (kort, 78pt), regel 2 = postcode + stad (108pt).
    const street1 = streetLine({
      straat: state.location.straat,
      huisnummer: state.location.huisnummer,
    });
    const cityLine = [
      safe(state.location.postcode),
      safe(state.location.stad),
    ]
      .filter(Boolean)
      .join(" ");
    drawText(
      templatePage1,
      truncate(street1, 32),
      TEMPLATE_PAGE_1.placeLine1.x,
      TEMPLATE_PAGE_1.placeLine1.y,
      { font, size: 9 },
    );
    drawText(
      templatePage1,
      truncate(cityLine, 44),
      TEMPLATE_PAGE_1.placeLine2.x,
      TEMPLATE_PAGE_1.placeLine2.y,
      { font, size: 9 },
    );
    drawText(
      templatePage1,
      safe(state.location.land),
      TEMPLATE_PAGE_1.country.x,
      TEMPLATE_PAGE_1.country.y,
      { font, size: 9 },
    );

    // Sectie 2 — Gewonden (kruisje bij neen of ja).
    const injuryPos =
      state.gewonden === true
        ? TEMPLATE_PAGE_1.injuriesYes
        : state.gewonden === false
          ? TEMPLATE_PAGE_1.injuriesNo
          : null;
    if (injuryPos) drawCheckbox(templatePage1, injuryPos.x, injuryPos.y, 5.71);

    // Sectie 3/4 — materiële schade. Het officiële sjabloon stelt twee aparte
    // vragen ("andere voertuigen dan A en B" en "andere objecten dan
    // voertuigen"). De wizard heeft slechts één antwoord — we kruisen dat
    // antwoord in beide kolommen aan.
    if (state.materieleSchadeAnders !== null) {
      const isYes = state.materieleSchadeAnders;
      const v = isYes
        ? TEMPLATE_PAGE_1.damageOtherVehiclesYes
        : TEMPLATE_PAGE_1.damageOtherVehiclesNo;
      const o = isYes
        ? TEMPLATE_PAGE_1.damageOtherObjectsYes
        : TEMPLATE_PAGE_1.damageOtherObjectsNo;
      drawCheckbox(templatePage1, v.x, v.y, 5.71);
      drawCheckbox(templatePage1, o.x, o.y, 5.71);
    }

    // Sectie 5 — getuigen (max. 3 regels). Eerste regel is korter (deelt rij
    // met "Getuigen:" label) — daarom 3 aparte posities. Eerste regel max ~95
    // chars (237pt), de andere ~140 chars (350pt). We wrappen veiligheidshalve
    // op de smalste limiet voor regel 1, en hertekenen vanaf daar.
    const witnessText = safe(state.getuigen);
    const w1 = wrapText(witnessText, 95, 1);
    const remainder = witnessText.slice((w1[0] ?? "").length).trim();
    const w23 = wrapText(remainder, 140, 2);
    const allWitnessLines = [...w1, ...w23];
    for (let i = 0; i < allWitnessLines.length; i++) {
      const slot = TEMPLATE_PAGE_1.witnessLines[i];
      drawText(templatePage1, allWitnessLines[i], slot.x, slot.y, {
        font,
        size: 8,
      });
    }

    // Secties 6-9 per partij.
    fillPartyBlock(templatePage1, font, bold, state.partyA, COL_A);
    fillPartyBlock(templatePage1, font, bold, state.partyB, COL_B);

    // Sectie 10 (raakpunt) wordt op het officiële sjabloon NIET overgetekend:
    // het sjabloon bevat al schematische voertuigen waar de gebruiker zelf de
    // pijl tekent. Onze raakpuntdata wordt enkel op het samenvattingsblad
    // afgebeeld (zie renderCoverSheet).

    // Sectie 12 — 17 vakjes toedracht.
    drawCheckboxes(templatePage1, bold, state);

    // Sectie 14 — opmerkingen per partij (we schrijven dezelfde notities links
    // én rechts omdat de wizard één gedeelde circumstancesNotes kent).
    if (state.circumstancesNotes?.trim()) {
      // 3 regels van ~168pt breed bij fontsize 8 ≈ 65 chars per regel.
      const noteLines = wrapText(state.circumstancesNotes, 65, 3);
      for (let i = 0; i < noteLines.length; i++) {
        const slotA = COL_A.notes.lines[i];
        const slotB = COL_B.notes.lines[i];
        if (slotA) {
          drawText(templatePage1, noteLines[i], slotA.x, slotA.y, {
            font,
            size: 8,
          });
        }
        if (slotB) {
          drawText(templatePage1, noteLines[i], slotB.x, slotB.y, {
            font,
            size: 8,
          });
        }
      }
    }

    // Sectie 15 — handtekeningen.
    await embedSignaturePng(
      pdfDoc,
      templatePage1,
      state.signaturePartyA,
      COL_A.signature.x,
      COL_A.signature.y,
      COL_A.signature.w,
      COL_A.signature.h,
    );
    await embedSignaturePng(
      pdfDoc,
      templatePage1,
      state.signaturePartyB,
      COL_B.signature.x,
      COL_B.signature.y,
      COL_B.signature.w,
      COL_B.signature.h,
    );

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
