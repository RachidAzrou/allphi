import { Resend } from "resend";

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { mergePayloadIntoState } from "@/lib/ongeval/engine";
import { formatDateForDisplay } from "@/lib/ongeval/date-utils";
import { buildAccidentPdfBytes } from "@/app/api/ongeval/[id]/pdf/route";
import type { AccidentReportState, DamagePhoto } from "@/types/ongeval";

export type SendReportError =
  | "auth_required"
  | "not_found"
  | "forbidden"
  | "incomplete"
  | "no_recipient"
  | "pdf_failed"
  | "email_failed"
  | "config_missing";

export type SendReportResult =
  | {
      ok: true;
      messageId: string | null;
      simulated: boolean;
      recipient: string;
      cc: string | null;
    }
  | { ok: false; error: SendReportError; detail?: string };

type CompanyProfile = {
  id: number;
  name: string;
  claims_email: string | null;
};

type ReportRow = {
  id: string;
  user_id: string;
  party_b_user_id: string | null;
  status: "draft" | "submitted";
  payload: unknown;
  medewerker_id?: number | null;
  email_status: "queued" | "sending" | "sent" | "failed" | null;
  email_attempts: number | null;
  submission_mode: "wizard" | "scan" | null;
  scan_storage_path: string | null;
  scan_page_count: number | null;
};

function buildSubject(
  state: AccidentReportState,
  driverName: string,
): string {
  const stad = state.location.stad?.trim() || "onbekende plaats";
  const datum = formatDateForDisplay(state.location.datum) || "datum onbekend";
  const plaat = state.partyA.voertuig.nummerplaat?.trim() || "—";
  const medewerker = driverName.trim() || "medewerker onbekend";
  return `Schade-aangifte - ${stad} - ${datum} - ${medewerker} (${plaat})`;
}

function buildScanSubject(
  state: AccidentReportState,
  driverName: string,
): string {
  const m = state.scanSubmission.metadata;
  const stad = m.stad?.trim() || "onbekende plaats";
  const datum = formatDateForDisplay(m.datum) || "datum onbekend";
  const plaat = m.nummerplaat?.trim() || "—";
  const medewerker = driverName.trim() || "medewerker onbekend";
  return `Schade-aangifte (gescand) - ${stad} - ${datum} - ${medewerker} (${plaat})`;
}

function buildScanBody(
  state: AccidentReportState,
  reportId: string,
  driverName: string,
  appOrigin: string | null,
): { html: string; text: string } {
  const m = state.scanSubmission.metadata;
  const datum = formatDateForDisplay(m.datum) || "—";
  const dossierLink = appOrigin
    ? `${appOrigin.replace(/\/+$/, "")}/ongeval/${reportId}`
    : null;

  const lines = [
    `Beste,`,
    ``,
    `In bijlage vind je een gescande versie van het Europees aanrijdingsformulier van ${
      driverName || "een medewerker"
    }.`,
    ``,
    `Samenvatting (uit de scan-flow):`,
    `- Datum: ${datum}`,
    `- Plaats: ${m.stad?.trim() || "—"}`,
    `- Nummerplaat medewerker: ${m.nummerplaat?.trim() || "—"}`,
    `- Aantal pagina's: ${state.scanSubmission.pageCount}`,
    m.notitie?.trim() ? `- Notitie: ${m.notitie.trim()}` : null,
    ``,
    `Let op: dit is een fotokopie van het papieren formulier — ALLE details (toedracht, schade, handtekeningen, …) staan op de scan zelf.`,
    ``,
    dossierLink ? `Dossier in AllPhi: ${dossierLink}` : null,
    ``,
    `Met vriendelijke groet,`,
    `AllPhi`,
  ].filter((l): l is string => l !== null);

  const text = lines.join("\n");
  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;color:#163247">
${lines
  .map((l) => {
    if (l.startsWith("- ")) return `<li>${htmlEscape(l.slice(2))}</li>`;
    if (l === "") return "<br/>";
    return `<p style="margin:0 0 8px">${htmlEscape(l)}</p>`;
  })
  .join("\n")}
</body></html>`;
  return { html, text };
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBody(
  state: AccidentReportState,
  reportId: string,
  driverName: string,
  appOrigin: string | null,
  photoLines?: string[] | null,
): { html: string; text: string } {
  const datum = formatDateForDisplay(state.location.datum) || "—";
  const tijd = state.location.tijd?.trim() || "—";
  const plaats = [
    [state.location.straat, state.location.huisnummer].filter(Boolean).join(" "),
    [state.location.postcode, state.location.stad].filter(Boolean).join(" "),
    state.location.land,
  ]
    .filter((s) => (s ?? "").trim())
    .join(", ") || "—";
  const plaatA = state.partyA.voertuig.nummerplaat?.trim() || "—";
  const plaatB = state.partyB.voertuig.nummerplaat?.trim() || "—";
  const verzA = state.partyA.verzekering.maatschappij?.trim() || "—";
  const polA = state.partyA.verzekering.polisnummer?.trim() || "—";
  const verzB = state.partyB.verzekering.maatschappij?.trim() || "—";
  const polB = state.partyB.verzekering.polisnummer?.trim() || "—";
  const gewonden =
    state.gewonden === true ? "ja" : state.gewonden === false ? "neen" : "onbekend";

  const dossierLink = appOrigin
    ? `${appOrigin.replace(/\/+$/, "")}/ongeval/${reportId}`
    : null;

  const lines = [
    `Beste,`,
    ``,
    `In bijlage vind je de Europese aanrijdingsformulier-PDF van ${driverName || "een medewerker"}.`,
    ``,
    `Samenvatting:`,
    `- Datum / uur: ${datum} ${tijd}`,
    `- Plaats: ${plaats}`,
    `- Voertuig medewerker (A): ${plaatA} — ${verzA} (polis ${polA})`,
    `- Voertuig partij B: ${plaatB} — ${verzB} (polis ${polB})`,
    `- Gewonden: ${gewonden}`,
    ...(photoLines && photoLines.length > 0
      ? ["", "Foto’s (damage track):", ...photoLines]
      : []),
    ``,
    dossierLink ? `Dossier in AllPhi: ${dossierLink}` : null,
    ``,
    `Met vriendelijke groet,`,
    `AllPhi`,
  ].filter((l): l is string => l !== null);

  const text = lines.join("\n");

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;color:#163247">
${lines
  .map((l) => {
    if (l.startsWith("- ")) return `<li>${htmlEscape(l.slice(2))}</li>`;
    if (l === "") return "<br/>";
    return `<p style="margin:0 0 8px">${htmlEscape(l)}</p>`;
  })
  .join("\n")}
</body></html>`;

  return { html, text };
}

async function buildDamagePhotoLines(
  adminClient: ReturnType<typeof createServerSupabase>,
  photos: DamagePhoto[],
): Promise<string[]> {
  const lines: string[] = [];
  for (const p of photos) {
    const label = p.name?.trim() || "foto";
    try {
      const { data, error } = await adminClient.storage
        .from(p.bucket)
        .createSignedUrl(p.path, 60 * 60 * 24 * 7);
      if (error || !data?.signedUrl) {
        lines.push(`- ${label}: (link niet beschikbaar)`);
      } else {
        lines.push(`- ${label}: ${data.signedUrl}`);
      }
    } catch {
      lines.push(`- ${label}: (link niet beschikbaar)`);
    }
  }
  return lines;
}

function uint8ToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/**
 * Stuur de definitieve schade-aangifte als PDF naar het centrale claims-adres
 * van het bedrijf. Werkt enkel voor de eigenaar (partij A). Het resultaat wordt
 * op de rij `ongeval_aangiften` gelogd zodat de wizard live status kan tonen
 * en de gebruiker kan retryen.
 */
export async function sendAccidentReport(
  reportId: string,
  options: { appOrigin?: string | null } = {},
): Promise<SendReportResult> {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return { ok: false, error: "auth_required" };
  }

  const { data: rowRaw, error: rowErr } = await supabase
    .from("ongeval_aangiften")
    .select(
      "id, user_id, party_b_user_id, status, payload, email_status, email_attempts, submission_mode, scan_storage_path, scan_page_count",
    )
    .eq("id", reportId)
    .maybeSingle();
  if (rowErr) {
    return { ok: false, error: "not_found", detail: rowErr.message };
  }
  const row = rowRaw as ReportRow | null;
  if (!row) return { ok: false, error: "not_found" };
  if (row.user_id !== user.id) {
    // Enkel partij A (eigenaar) mag verzenden.
    return { ok: false, error: "forbidden" };
  }

  const state = mergePayloadIntoState(row.payload);

  // Bepaal of we een wizard-PDF bouwen of een gescande PDF uit storage halen.
  // De expliciete kolom op de rij is leidend; payload is enkel fallback.
  const submissionMode: "wizard" | "scan" =
    row.submission_mode ?? state.submissionMode ?? "wizard";

  // Minimale completeness-check zodat we geen lege PDF mailen.
  const incidentKind = state.incidentKind ?? "accident_with_other_party";
  // Alleen bij een volledig Europees aanrijdingsformulier (tegenpartij) eisen we handtekening A.
  // In de "damage_only" track (glasbreuk/diefstal/eenzijdig) bestaat geen handtekeningstap.
  if (submissionMode === "wizard" && incidentKind === "accident_with_other_party" && !state.signaturePartyA) {
    return { ok: false, error: "incomplete", detail: "signature_a" };
  }
  if (submissionMode === "scan") {
    const path = row.scan_storage_path ?? state.scanSubmission.storagePath;
    const pageCount =
      row.scan_page_count ?? state.scanSubmission.pageCount ?? 0;
    if (!path || pageCount < 1) {
      return { ok: false, error: "incomplete", detail: "scan_missing" };
    }
    const meta = state.scanSubmission.metadata;
    if (
      !meta.datum.trim() ||
      !meta.stad.trim() ||
      !meta.nummerplaat.trim()
    ) {
      return { ok: false, error: "incomplete", detail: "scan_metadata" };
    }
  }

  // Centraal claims-adres ophalen. Single-tenant: eerste rij in
  // company_profile. Service-role client zodat we ook leeswerk doen wanneer
  // RLS roeit.
  const adminClient = createServiceRoleClient() ?? supabase;

  // Enrich DB row + payload with medewerker/vehicle context (best-effort).
  // This ensures fleet manager can always resolve medewerker + wagen, even when
  // the user didn't fill those fields in the wizard payload.
  try {
    const email = (user.email ?? "").trim();
    if (email) {
      const { data: m } = await adminClient
        .from("medewerkers")
        .select("*")
        .ilike("emailadres", email)
        .maybeSingle();
      const medewerkerId = (m as { id?: number } | null)?.id ?? null;

      const { data: vctx } = await adminClient
        .from("v_fleet_assistant_context")
        .select("nummerplaat, merk_model, insurance_company, policy_number")
        .ilike("emailadres", email)
        .order("merk_model", { ascending: true })
        .order("nummerplaat", { ascending: true })
        .limit(1)
        .maybeSingle();

      const plate = (vctx as { nummerplaat?: string | null } | null)?.nummerplaat?.trim() ?? "";
      const merkModel = (vctx as { merk_model?: string | null } | null)?.merk_model?.trim() ?? "";
      const insuranceCompany =
        (vctx as { insurance_company?: string | null } | null)?.insurance_company?.trim() ?? "";
      const policyNumber =
        (vctx as { policy_number?: string | null } | null)?.policy_number?.trim() ?? "";

      const patchPayload = { ...(row.payload as Record<string, unknown>) } as Record<string, unknown>;
      const pPartyA = (patchPayload.partyA ?? {}) as Record<string, unknown>;
      const pBestuurder = (pPartyA.bestuurder ?? {}) as Record<string, unknown>;
      const pVoertuig = (pPartyA.voertuig ?? {}) as Record<string, unknown>;
      const pVerzekering = (pPartyA.verzekering ?? {}) as Record<string, unknown>;

      const curEmail =
        typeof pBestuurder.email === "string" ? pBestuurder.email.trim() : "";
      const curPlate =
        typeof pVoertuig.nummerplaat === "string" ? pVoertuig.nummerplaat.trim() : "";

      if (!curEmail) pBestuurder.email = email;
      if (!curPlate && plate) pVoertuig.nummerplaat = plate;
      if (typeof pVoertuig.merkModel !== "string" || !String(pVoertuig.merkModel).trim()) {
        if (merkModel) pVoertuig.merkModel = merkModel;
      }
      if (
        (typeof pVerzekering.maatschappij !== "string" ||
          !String(pVerzekering.maatschappij).trim()) &&
        insuranceCompany
      ) {
        pVerzekering.maatschappij = insuranceCompany;
      }
      if (
        (typeof pVerzekering.polisnummer !== "string" ||
          !String(pVerzekering.polisnummer).trim()) &&
        policyNumber
      ) {
        pVerzekering.polisnummer = policyNumber;
      }

      pPartyA.bestuurder = pBestuurder;
      pPartyA.voertuig = pVoertuig;
      pPartyA.verzekering = pVerzekering;
      patchPayload.partyA = pPartyA;

      await adminClient
        .from("ongeval_aangiften")
        .update({
          medewerker_id: medewerkerId,
          payload: patchPayload,
        })
        .eq("id", reportId);
    }
  } catch (e) {
    // best-effort enrichment; ignore failures
  }
  const { data: companyRaw, error: companyErr } = await adminClient
    .from("company_profile")
    .select("id, name, claims_email")
    .order("id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (companyErr) {
    return { ok: false, error: "config_missing", detail: companyErr.message };
  }
  const company = companyRaw as CompanyProfile | null;
  const recipient = company?.claims_email?.trim();
  if (!recipient) {
    return { ok: false, error: "no_recipient" };
  }

  // PDF bytes: ofwel wizard-template-render, ofwel uit storage downloaden.
  let pdfBytes: Uint8Array;
  let pdfFilename: string;
  try {
    if (submissionMode === "scan") {
      const path = row.scan_storage_path ?? state.scanSubmission.storagePath;
      if (!path) throw new Error("scan_storage_path_missing");
      const { data: blob, error: dlErr } = await adminClient.storage
        .from("ongeval-scans")
        .download(path);
      if (dlErr || !blob) {
        throw new Error(dlErr?.message ?? "download_failed");
      }
      pdfBytes = new Uint8Array(await blob.arrayBuffer());
      pdfFilename = `aanrijdingsformulier-scan-${reportId}.pdf`;
    } else {
      pdfBytes = await buildAccidentPdfBytes(state, {
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
      pdfFilename = `aanrijdingsformulier-${reportId}.pdf`;
    }
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    await supabase
      .from("ongeval_aangiften")
      .update({
        email_status: "failed",
        email_error: `pdf:${detail}`,
        email_attempts: (row.email_attempts ?? 0) + 1,
      })
      .eq("id", reportId);
    return { ok: false, error: "pdf_failed", detail };
  }

  const driverName = [
    state.partyA.bestuurder.voornaam,
    state.partyA.bestuurder.naam,
  ]
    .filter((s) => (s ?? "").trim())
    .join(" ");
  const subject =
    submissionMode === "scan"
      ? buildScanSubject(state, driverName)
      : buildSubject(state, driverName);

  const damagePhotos = Array.isArray((state as unknown as { damagePhotos?: unknown }).damagePhotos)
    ? ((state as unknown as { damagePhotos: DamagePhoto[] }).damagePhotos ?? [])
    : [];
  const photoLines =
    submissionMode === "wizard" && damagePhotos.length > 0
      ? await buildDamagePhotoLines(adminClient, damagePhotos)
      : [];
  const { html, text } =
    submissionMode === "scan"
      ? buildScanBody(state, reportId, driverName, options.appOrigin ?? null)
      : buildBody(state, reportId, driverName, options.appOrigin ?? null, photoLines);

  // Markeer "sending" zodat realtime-luisteraars (wizard) feedback krijgen.
  await supabase
    .from("ongeval_aangiften")
    .update({
      email_status: "sending",
      email_recipient: recipient,
      email_cc: user.email ?? null,
      email_error: null,
    })
    .eq("id", reportId);

  const apiKey = process.env.RESEND_API_KEY?.trim();
  const fromAddress =
    process.env.RESEND_FROM_ADDRESS?.trim() || "AllPhi <noreply@allphi.be>";
  const bccRaw = process.env.RESEND_BCC?.trim();
  const bccList = bccRaw
    ? bccRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : undefined;

  const attachments = [
    {
      filename: pdfFilename,
      content: uint8ToBase64(pdfBytes),
    },
  ];

  // Geen API-key → simulated success (handig voor lokaal/dev). We loggen wel
  // duidelijk in de server-output.
  if (!apiKey) {
    console.warn(
      "[send-report] RESEND_API_KEY ontbreekt — verzending wordt gesimuleerd",
      { reportId, recipient, subject },
    );
    await supabase
      .from("ongeval_aangiften")
      .update({
        email_status: "sent",
        email_sent_at: new Date().toISOString(),
        email_message_id: null,
        email_attempts: (row.email_attempts ?? 0) + 1,
        email_error: null,
        status: "submitted",
        fleet_unread: true,
        fleet_read_at: null,
      })
      .eq("id", reportId);
    return {
      ok: true,
      messageId: null,
      simulated: true,
      recipient,
      cc: user.email ?? null,
    };
  }

  try {
    const resend = new Resend(apiKey);
    const sendResult = await resend.emails.send({
      from: fromAddress,
      to: recipient,
      cc: user.email ? [user.email] : undefined,
      bcc: bccList,
      subject,
      text,
      html,
      attachments,
    });

    if (sendResult.error) {
      const detail = sendResult.error.message ?? "send_failed";
      await supabase
        .from("ongeval_aangiften")
        .update({
          email_status: "failed",
          email_error: detail,
          email_attempts: (row.email_attempts ?? 0) + 1,
        })
        .eq("id", reportId);
      return { ok: false, error: "email_failed", detail };
    }

    const messageId = sendResult.data?.id ?? null;
    await supabase
      .from("ongeval_aangiften")
      .update({
        email_status: "sent",
        email_sent_at: new Date().toISOString(),
        email_message_id: messageId,
        email_attempts: (row.email_attempts ?? 0) + 1,
        email_error: null,
        status: "submitted",
        fleet_unread: true,
        fleet_read_at: null,
      })
      .eq("id", reportId);

    return {
      ok: true,
      messageId,
      simulated: false,
      recipient,
      cc: user.email ?? null,
    };
  } catch (e) {
    const detail = e instanceof Error ? e.message : "unknown";
    await supabase
      .from("ongeval_aangiften")
      .update({
        email_status: "failed",
        email_error: detail,
        email_attempts: (row.email_attempts ?? 0) + 1,
      })
      .eq("id", reportId);
    return { ok: false, error: "email_failed", detail };
  }
}
