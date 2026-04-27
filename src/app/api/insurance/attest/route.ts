import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";

type InsuranceAttestContext = {
  merk_model: string | null;
  nummerplaat: string | null;
  vin: string | null;
  insurance_company: string | null;
  policy_number: string | null;
  green_card_number: string | null;
  green_card_valid_from: string | null;
  green_card_valid_to: string | null;
  // TODO: add to v_fleet_assistant_context + underlying insurance data once available
  omnium_company?: string | null;
  omnium_policy_number?: string | null;
};

function safe(v: string | null | undefined, fallback = "—"): string {
  const s = (v ?? "").trim();
  return s ? s : fallback;
}

function formatDateNl(iso: string | null | undefined): string {
  const s = (iso ?? "").trim();
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return s;
  }
}

function filenameSafe(input: string): string {
  return input
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 64);
}

async function buildInsuranceAttestPdfBytes(ctx: InsuranceAttestContext): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]); // A4 points
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const margin = 48;
  const width = page.getWidth();
  const topY = page.getHeight() - margin;

  // Header bar
  page.drawRectangle({
    x: 0,
    y: topY - 44,
    width,
    height: 44,
    color: rgb(0.153, 0.6, 0.84),
  });
  page.drawText("VERZEKERINGSATTEST", {
    x: margin,
    y: topY - 28,
    font: bold,
    size: 16,
    color: rgb(1, 1, 1),
  });
  page.drawText("AllPhi Fleet Companion", {
    x: margin,
    y: topY - 40,
    font,
    size: 9,
    color: rgb(1, 1, 1),
  });

  let y = topY - 74;

  const drawLabelValue = (label: string, value: string) => {
    page.drawText(label, {
      x: margin,
      y,
      font,
      size: 10,
      color: rgb(0.4, 0.47, 0.54),
    });
    page.drawText(value, {
      x: margin + 180,
      y,
      font: bold,
      size: 11,
      color: rgb(0.09, 0.17, 0.25),
      maxWidth: width - margin * 2 - 180,
    });
    y -= 18;
  };

  // Vehicle
  page.drawText("Voertuig", {
    x: margin,
    y,
    font: bold,
    size: 12,
    color: rgb(0.09, 0.17, 0.25),
  });
  y -= 16;
  drawLabelValue("Merk / Model", safe(ctx.merk_model));
  drawLabelValue("Nummerplaat / Kenteken", safe(ctx.nummerplaat));
  drawLabelValue("Chassisnummer (VIN)", safe(ctx.vin));
  drawLabelValue("Eigenaar", "AllPhi");

  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.88, 0.91, 0.94),
  });
  y -= 20;

  // Insurance
  page.drawText("Verzekering", {
    x: margin,
    y,
    font: bold,
    size: 12,
    color: rgb(0.09, 0.17, 0.25),
  });
  y -= 16;
  drawLabelValue("Verzekeringsmaatschappij", safe(ctx.insurance_company));
  drawLabelValue("Polisnummer", safe(ctx.policy_number));
  drawLabelValue("Nr. groene kaart", safe(ctx.green_card_number));
  drawLabelValue("Geldig van", formatDateNl(ctx.green_card_valid_from));
  drawLabelValue("Geldig tot", formatDateNl(ctx.green_card_valid_to));

  // Omnium (placeholder until data is available)
  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.88, 0.91, 0.94),
  });
  y -= 20;

  page.drawText("Omnium", {
    x: margin,
    y,
    font: bold,
    size: 12,
    color: rgb(0.09, 0.17, 0.25),
  });
  y -= 16;
  // TODO: omnium_company / omnium_policy_number are not yet in v_fleet_assistant_context.
  drawLabelValue("Omniumverzekering", safe(ctx.omnium_company ?? null, "Niet van toepassing"));
  drawLabelValue("Omnium polisnummer", safe(ctx.omnium_policy_number ?? null, "—"));

  y -= 18;
  page.drawText(
    "Dit attest is automatisch gegenereerd op basis van de beschikbare fleet-context data.",
    {
      x: margin,
      y,
      font,
      size: 9,
      color: rgb(0.4, 0.47, 0.54),
      maxWidth: width - margin * 2,
    },
  );

  return await pdf.save();
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "auth_required" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("v_fleet_assistant_context")
    .select(
      "merk_model, nummerplaat, vin, insurance_company, policy_number, green_card_number, green_card_valid_from, green_card_valid_to",
    )
    .ilike("emailadres", user.email)
    .order("merk_model", { ascending: true })
    .order("nummerplaat", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: "context_fetch_failed", detail: error.message },
      { status: 500 },
    );
  }

  const ctx = (data ?? null) as InsuranceAttestContext | null;
  const hasVehicle = Boolean(
    (ctx?.vin && ctx.vin.trim()) ||
      (ctx?.nummerplaat && ctx.nummerplaat.trim()) ||
      (ctx?.merk_model && ctx.merk_model.trim()),
  );
  if (!hasVehicle) {
    return NextResponse.json({ error: "no_active_vehicle" }, { status: 404 });
  }

  const pdfBytes = await buildInsuranceAttestPdfBytes({
    merk_model: ctx?.merk_model ?? null,
    nummerplaat: ctx?.nummerplaat ?? null,
    vin: ctx?.vin ?? null,
    insurance_company: ctx?.insurance_company ?? null,
    policy_number: ctx?.policy_number ?? null,
    green_card_number: ctx?.green_card_number ?? null,
    green_card_valid_from: ctx?.green_card_valid_from ?? null,
    green_card_valid_to: ctx?.green_card_valid_to ?? null,
    omnium_company: null,
    omnium_policy_number: null,
  });

  const nameHintRaw = ctx?.nummerplaat?.trim() || ctx?.vin?.trim() || "mijn-wagen";
  const nameHint = filenameSafe(nameHintRaw) || "mijn-wagen";
  const filename = `verzekeringsattest-${nameHint}.pdf`;

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

