import type {
  AccidentReportState,
  OngevalStepId,
} from "@/types/ongeval";
import { createInitialAccidentState } from "@/types/ongeval";
import { toIsoDate, toIsoTime } from "@/lib/ongeval/date-utils";

const PHASE_ORDER: OngevalStepId[][] = [
  [
    "submission_mode",
    "driver_select",
    "driver_employee_form",
    "driver_other_form",
    "policyholder_select",
    "policyholder_form",
    "insurer_select",
    "vehicle_confirm",
  ],
  [
    "parties_count",
    "devices_count",
    "role_select",
    "share_qr",
    "scan_qr",
    "party_b_language",
    "party_b_optional",
    "party_b_form",
  ],
  ["location_time", "injuries_material", "witnesses"],
  [
    "situation_main",
    "sit_rear_end",
    "sit_center_line",
    "sit_priority",
    "sit_maneuver_a",
    "sit_maneuver_b",
    "sit_lane_change",
    "sit_parking",
    "sit_door",
    "sit_load",
  ],
  ["proposal_intro", "proposal_decision", "circumstances_manual"],
  ["vehicle_contact", "impact_party_a", "impact_party_b"],
  ["overview_intro", "overview_detail"],
  ["signature_a", "signature_b", "complete"],
];

/**
 * Veel kortere phase-balk voor de scan-fallback flow. Drie fases:
 * 1) modus kiezen, 2) pagina's scannen, 3) bevestigen + verzenden.
 */
const SCAN_PHASE_ORDER: OngevalStepId[][] = [
  ["submission_mode"],
  ["scan_capture"],
  ["complete"],
];

const SCAN_TRACK_STEP_IDS = new Set<OngevalStepId>(["scan_capture"]);

/**
 * Plaats + tijd vereisen wederzijdse goedkeuring zodra beide partijen
 * elk op hun eigen toestel zitten. In single-device of single-party scenario's
 * wordt de approval-flow overgeslagen.
 */
export function requiresLocationApproval(state: AccidentReportState): boolean {
  return state.partiesCount === 2 && state.devicesCount === 2;
}

/** Stabiele FNV-1a 32-bit hash, voldoende om mutatie van velden te detecteren. */
function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Hash van de location-velden waarop B akkoord ging. */
export function computeLocationHash(
  loc: AccidentReportState["location"],
): string {
  return fnv1a(
    [loc.straat, loc.huisnummer, loc.postcode, loc.stad, loc.land, loc.datum, loc.tijd]
      .map((s) => (s ?? "").trim())
      .join("|"),
  );
}

export function getProgressForStep(
  stepId: OngevalStepId,
  state?: AccidentReportState,
): {
  step: number;
  total: number;
  fraction: number;
} {
  const usingScanTrack =
    state?.submissionMode === "scan" || SCAN_TRACK_STEP_IDS.has(stepId);
  const phases = usingScanTrack ? SCAN_PHASE_ORDER : PHASE_ORDER;
  const total = phases.length;
  let phaseIndex = 0;
  for (let i = 0; i < phases.length; i++) {
    if (phases[i].includes(stepId)) {
      phaseIndex = i;
      break;
    }
  }
  const fraction = (phaseIndex + 1) / total;
  return { step: phaseIndex + 1, total, fraction };
}

function afterDriverSelect(state: AccidentReportState): OngevalStepId {
  if (state.driverWasEmployee === false) return "driver_other_form";
  return "driver_employee_form";
}

function afterPolicyholderSelect(state: AccidentReportState): OngevalStepId {
  // Always allow reviewing/editing policyholder fields; company/other need manual.
  return "policyholder_form";
}

function afterDevicesCount(state: AccidentReportState): OngevalStepId {
  if (state.devicesCount === 2) return "role_select";
  return "party_b_language";
}

function afterRoleSelect(state: AccidentReportState): OngevalStepId {
  if (state.role === "A") return "share_qr";
  if (state.role === "B") return "scan_qr";
  return "role_select";
}

function afterPartyBOptional(state: AccidentReportState): OngevalStepId {
  // If only one party is present and user doesn't want to enter B details,
  // skip B-related inputs and start accident questions.
  if (state.partiesCount === 1 && state.wantsFillPartyB === true) {
    return "party_b_form";
  }
  return "location_time";
}

function situationSubStep(
  state: AccidentReportState,
): OngevalStepId | null {
  const c = state.situationCategory;
  if (!c) return null;
  switch (c) {
    case "rear_end":
      return "sit_rear_end";
    case "opposite":
      return "sit_center_line";
    case "priority":
      return "sit_priority";
    case "maneuver":
      return "sit_maneuver_a";
    case "lane_change":
      return "sit_lane_change";
    case "parking":
      return "sit_parking";
    case "door":
      return "sit_door";
    case "load":
      return "sit_load";
    default:
      return "situation_main";
  }
}

function afterSituationSub(state: AccidentReportState): OngevalStepId {
  if (state.situationCategory === "maneuver") {
    if (state.currentStepId === "sit_maneuver_a") return "sit_maneuver_b";
  }
  return "proposal_intro";
}

export function getNextStepId(
  from: OngevalStepId,
  state: AccidentReportState,
): OngevalStepId | null {
  switch (from) {
    case "submission_mode":
      if (state.submissionMode === "scan") return "scan_capture";
      return "driver_select";
    case "scan_capture":
      return "complete";
    case "driver_select":
      return afterDriverSelect(state);
    case "driver_employee_form":
      return "policyholder_form";
    case "driver_other_form":
      return "policyholder_form";
    case "policyholder_select":
      return afterPolicyholderSelect(state);
    case "policyholder_form":
      return "insurer_select";
    case "insurer_select":
      return "vehicle_confirm";
    case "vehicle_confirm":
      return "parties_count";
    case "parties_count":
      return "devices_count";
    case "devices_count":
      return afterDevicesCount(state);
    case "role_select":
      return afterRoleSelect(state);
    case "share_qr":
      return "location_time";
    case "scan_qr":
      return "location_time";
    case "party_b_language":
      if (state.role === "B") return "party_b_form";
      return "party_b_optional";
    case "party_b_optional":
      return afterPartyBOptional(state);
    case "party_b_form":
      return "location_time";
    case "location_time":
      return "injuries_material";
    case "injuries_material":
      return "witnesses";
    case "witnesses":
      return "situation_main";
    case "situation_main": {
      const sub = situationSubStep(state);
      return sub ?? "situation_main";
    }
    case "sit_rear_end":
    case "sit_center_line":
    case "sit_priority":
    case "sit_lane_change":
    case "sit_parking":
    case "sit_door":
    case "sit_load":
      return "proposal_intro";
    case "sit_maneuver_a":
      return afterSituationSub(state);
    case "sit_maneuver_b":
      return "proposal_intro";
    case "proposal_intro":
      return "proposal_decision";
    case "proposal_decision":
      if (state.proposalAccepted === false) return "circumstances_manual";
      return "vehicle_contact";
    case "circumstances_manual":
      return "vehicle_contact";
    case "vehicle_contact":
      if (state.vehicleContact === true) return "impact_party_a";
      return "overview_intro";
    case "impact_party_a":
      return "impact_party_b";
    case "impact_party_b":
      return "overview_intro";
    case "overview_intro":
      return "overview_detail";
    case "overview_detail":
      return "signature_a";
    case "signature_a":
      return "signature_b";
    case "signature_b":
      return "complete";
    case "complete":
      return null;
    default:
      return null;
  }
}

/** Skip overview detail (user already saw intro) — goes to first signature step. */
export function getNextAfterOverviewSkip(): OngevalStepId {
  return "signature_a";
}

export function getPreviousStepId(state: AccidentReportState): OngevalStepId | null {
  const n = state.navigationHistory.length;
  if (n === 0) return null;
  return state.navigationHistory[n - 1] ?? null;
}

/** Move forward: push current step on history, set new current. */
export function advanceState(
  state: AccidentReportState,
  nextId: OngevalStepId,
): AccidentReportState {
  return {
    ...state,
    navigationHistory: [...state.navigationHistory, state.currentStepId],
    currentStepId: nextId,
  };
}

export function popHistory(state: AccidentReportState): AccidentReportState {
  if (state.navigationHistory.length === 0) return state;
  const previousId =
    state.navigationHistory[state.navigationHistory.length - 1];
  return {
    ...state,
    navigationHistory: state.navigationHistory.slice(0, -1),
    currentStepId: previousId,
  };
}

export function validateStep(
  stepId: OngevalStepId,
  state: AccidentReportState,
): boolean {
  const loc = state.location;
  switch (stepId) {
    case "submission_mode":
      return state.submissionMode !== null;
    case "scan_capture": {
      const m = state.scanSubmission.metadata;
      return (
        state.scanSubmission.storagePath !== null &&
        state.scanSubmission.uploadedAt !== null &&
        state.scanSubmission.pageCount >= 1 &&
        m.datum.trim().length > 0 &&
        m.stad.trim().length > 0 &&
        m.nummerplaat.trim().length > 0
      );
    }
    case "driver_select":
      return state.driverWasEmployee !== null;
    case "driver_other_form":
      return (
        state.otherDriver.naam.trim().length > 0 &&
        state.otherDriver.voornaam.trim().length > 0 &&
        state.otherDriver.geboortedatum.trim().length > 0 &&
        state.otherDriver.adres.straat.trim().length > 0 &&
        state.otherDriver.adres.huisnummer.trim().length > 0 &&
        state.otherDriver.adres.postcode.trim().length > 0 &&
        state.otherDriver.adres.stad.trim().length > 0 &&
        state.otherDriver.adres.land.trim().length > 0 &&
        state.otherDriver.rijbewijsNummer.trim().length > 0
      );
    case "driver_employee_form":
      return (
        state.employeeDriver.naam.trim().length > 0 &&
        state.employeeDriver.voornaam.trim().length > 0 &&
        state.employeeDriver.geboortedatum.trim().length > 0 &&
        state.employeeDriver.adres.straat.trim().length > 0 &&
        state.employeeDriver.adres.huisnummer.trim().length > 0 &&
        state.employeeDriver.adres.postcode.trim().length > 0 &&
        state.employeeDriver.adres.stad.trim().length > 0 &&
        state.employeeDriver.adres.land.trim().length > 0 &&
        state.employeeDriver.rijbewijsNummer.trim().length > 0
      );
    case "policyholder_select":
      return Boolean(state.partyA.verzekeringsnemerType);
    case "policyholder_form":
      return (
        state.partyA.verzekeringsnemer.naam.trim().length > 0 &&
        state.partyA.verzekeringsnemer.adres.straat.trim().length > 0 &&
        state.partyA.verzekeringsnemer.adres.huisnummer.trim().length > 0 &&
        state.partyA.verzekeringsnemer.adres.postcode.trim().length > 0 &&
        state.partyA.verzekeringsnemer.adres.stad.trim().length > 0 &&
        state.partyA.verzekeringsnemer.adres.land.trim().length > 0
      );
    case "insurer_select":
      return (
        state.partyA.verzekering.maatschappij.trim().length > 0 &&
        state.partyA.verzekering.polisnummer.trim().length > 0
      );
    case "vehicle_confirm":
      return (
        state.partyA.voertuig.merkModel.trim().length > 0 &&
        state.partyA.voertuig.nummerplaat.trim().length > 0 &&
        state.partyA.voertuig.landInschrijving.trim().length > 0
      );
    case "parties_count":
      return state.partiesCount !== null;
    case "devices_count":
      return state.devicesCount !== null;
    case "role_select":
      return state.devicesCount !== 2 || state.role !== null;
    case "share_qr":
      return true;
    case "scan_qr":
      return true;
    case "party_b_language":
      return state.partyBLanguage !== null;
    case "party_b_optional":
      return state.partiesCount !== 1 || state.wantsFillPartyB !== null;
    case "party_b_form":
      return (
        state.partyB.verzekeringsnemer.naam.trim().length > 0 &&
        state.partyB.verzekeringsnemer.voornaam.trim().length > 0 &&
        state.partyB.verzekering.maatschappij.trim().length > 0 &&
        state.partyB.verzekering.polisnummer.trim().length > 0 &&
        state.partyB.voertuig.merkModel.trim().length > 0 &&
        state.partyB.voertuig.nummerplaat.trim().length > 0 &&
        state.partyB.bestuurder.voornaam.trim().length > 0 &&
        state.partyB.bestuurder.naam.trim().length > 0
      );
    case "location_time": {
      const fieldsOk =
        loc.straat.trim().length > 0 &&
        loc.huisnummer.trim().length > 0 &&
        loc.postcode.trim().length > 0 &&
        loc.stad.trim().length > 0 &&
        loc.land.trim().length > 0 &&
        loc.datum.trim().length > 0 &&
        loc.tijd.trim().length > 0;
      if (!fieldsOk) return false;
      if (!requiresLocationApproval(state)) return true;
      return state.locationApproval.status === "approved";
    }
    case "injuries_material":
      return state.gewonden !== null && state.materieleSchadeAnders !== null;
    case "witnesses":
      return true;
    case "situation_main":
      return state.situationCategory !== null;
    case "sit_rear_end":
    case "sit_center_line":
    case "sit_priority":
    case "sit_lane_change":
    case "sit_parking":
    case "sit_door":
    case "sit_load":
      return state.situationDetailKey !== null;
    case "sit_maneuver_a":
      return state.maneuverAKey !== null;
    case "sit_maneuver_b":
      return state.maneuverBKey !== null;
    case "proposal_intro":
      return true;
    case "proposal_decision":
      return state.proposalAccepted !== null;
    case "circumstances_manual":
      return true;
    case "vehicle_contact":
      return state.vehicleContact !== null;
    case "impact_party_a":
      return state.vehicleContact === false || state.impactPartyA !== null;
    case "impact_party_b":
      return state.vehicleContact === false || state.impactPartyB !== null;
    case "overview_intro":
      return true;
    case "overview_detail":
      return true;
    case "signature_a":
      return state.signaturePartyA !== null;
    case "signature_b":
      return state.signaturePartyB !== null;
    case "complete":
      return true;
    default:
      return true;
  }
}

export function getStepTitle(stepId: OngevalStepId): string {
  const titles: Record<OngevalStepId, string> = {
    submission_mode: "Hoe wil je aangifte doen?",
    scan_capture: "Papieren formulier scannen",
    driver_select: "Bestuurder",
    driver_employee_form: "Bestuurder",
    driver_other_form: "Bestuurder",
    policyholder_select: "Verzekeringsnemer",
    policyholder_form: "Verzekeringsnemer",
    insurer_select: "Verzekering",
    vehicle_confirm: "Voertuig",
    parties_count: "Aantal partijen",
    devices_count: "Aantal toestellen",
    role_select: "Kies je rol",
    share_qr: "Deel QR-code",
    scan_qr: "Scan QR-code",
    party_b_language: "Taal partij B",
    party_b_optional: "Partij B",
    party_b_form: "Gegevens partij B",
    location_time: "Plaats en tijd",
    injuries_material: "Gewonden en schade",
    witnesses: "Getuigen",
    situation_main: "Ongevalsituaties",
    sit_rear_end: "Aanrijding achteraan",
    sit_center_line: "Een voertuig overschrijdt de middenlijn",
    sit_priority: "Een partij heeft een voorrangsteken niet nageleefd",
    sit_maneuver_a: "Manoeuvre partij A",
    sit_maneuver_b: "Manoeuvre partij B",
    sit_lane_change: "Verandering van file",
    sit_parking: "Parkeerstand",
    sit_door: "Openen portier",
    sit_load: "Verlies van lading",
    proposal_intro: "Voorstel van aangifte",
    proposal_decision: "Voorstel van aangifte",
    circumstances_manual: "Toedracht (aanvulling)",
    vehicle_contact: "Raakpunt aan de voertuigen",
    impact_party_a: "Raakpunt voertuig A",
    impact_party_b: "Raakpunt voertuig B",
    overview_intro: "Overzicht ongevalsaangifte",
    overview_detail: "Overzicht",
    signature_a: "Handtekening A",
    signature_b: "Handtekening B",
    complete: "Voltooiing",
  };
  return titles[stepId];
}

export function mergePayloadIntoState(
  raw: unknown,
): AccidentReportState {
  const base = createInitialAccidentState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;

  // v1 → v2 migration (best-effort)
  const maybeV1Party = (p: unknown) =>
    p &&
    typeof p === "object" &&
    ("verzekeringsnemerNaam" in (p as object) ||
      "bestuurderNaam" in (p as object));

  const migratePartyFromV1 = (p: any, target: any) => {
    const verzekeringsnemerNaam =
      typeof p?.verzekeringsnemerNaam === "string" ? p.verzekeringsnemerNaam : "";
    const bestuurderNaam =
      typeof p?.bestuurderNaam === "string" ? p.bestuurderNaam : "";

    const [vhVoornaam, ...vhNaamParts] = verzekeringsnemerNaam
      .split(" ")
      .filter(Boolean);
    const vhNaam = vhNaamParts.join(" ");

    const [bdVoornaam, ...bdNaamParts] = bestuurderNaam
      .split(" ")
      .filter(Boolean);
    const bdNaam = bdNaamParts.join(" ");

    return {
      ...target,
      verzekeringsnemerType: "company",
      verzekeringsnemer: {
        ...target.verzekeringsnemer,
        voornaam: vhVoornaam ?? "",
        naam: vhNaam ?? "",
        telefoon: typeof p?.telefoon === "string" ? p.telefoon : "",
        email: typeof p?.email === "string" ? p.email : "",
        adres: {
          ...target.verzekeringsnemer.adres,
          straat: typeof p?.adres === "string" ? p.adres : "",
          postcode: typeof p?.postcode === "string" ? p.postcode : "",
          stad: typeof p?.stad === "string" ? p.stad : "",
          land: typeof p?.land === "string" ? p.land : target.verzekeringsnemer.adres.land,
        },
      },
      bestuurder: {
        ...target.bestuurder,
        voornaam: bdVoornaam ?? "",
        naam: bdNaam ?? "",
        rijbewijsNummer:
          typeof p?.rijbewijsNummer === "string" ? p.rijbewijsNummer : "",
      },
      verzekering: {
        maatschappij: typeof p?.maatschappij === "string" ? p.maatschappij : "",
        polisnummer: typeof p?.polisnummer === "string" ? p.polisnummer : "",
      },
      voertuig: {
        merkModel:
          [p?.merk, p?.typeVoertuig].filter((s: any) => typeof s === "string" && s.trim()).join(" "),
        nummerplaat: typeof p?.nummerplaat === "string" ? p.nummerplaat : "",
        landInschrijving: "België",
      },
    };
  };

  let partyA = base.partyA;
  let partyB = base.partyB;
  if (maybeV1Party(o.partyA)) partyA = migratePartyFromV1(o.partyA, base.partyA);
  if (maybeV1Party(o.partyB)) partyB = migratePartyFromV1(o.partyB, base.partyB);

  const merged: AccidentReportState = {
    ...base,
    ...o,
    location: { ...base.location, ...(o.location as object) },
    employeeDriver: {
      ...base.employeeDriver,
      ...(typeof o.employeeDriver === "object" && o.employeeDriver ? (o.employeeDriver as any) : {}),
      adres: {
        ...base.employeeDriver.adres,
        ...(typeof (o as any).employeeDriver?.adres === "object" && (o as any).employeeDriver?.adres
          ? ((o as any).employeeDriver.adres as any)
          : {}),
      },
    },
    otherDriver: {
      ...base.otherDriver,
      ...(typeof o.otherDriver === "object" && o.otherDriver ? (o.otherDriver as any) : {}),
      adres: {
        ...base.otherDriver.adres,
        ...(typeof (o as any).otherDriver?.adres === "object" && (o as any).otherDriver?.adres
          ? ((o as any).otherDriver.adres as any)
          : {}),
      },
    },
    partyA:
      typeof o.partyA === "object" && o.partyA && !maybeV1Party(o.partyA)
        ? ({
            ...base.partyA,
            ...(o.partyA as any),
            verzekeringsnemer: {
              ...base.partyA.verzekeringsnemer,
              ...((o.partyA as any)?.verzekeringsnemer ?? {}),
              adres: {
                ...base.partyA.verzekeringsnemer.adres,
                ...((o.partyA as any)?.verzekeringsnemer?.adres ?? {}),
              },
            },
            bestuurder: {
              ...base.partyA.bestuurder,
              ...((o.partyA as any)?.bestuurder ?? {}),
              adres: {
                ...base.partyA.bestuurder.adres,
                ...((o.partyA as any)?.bestuurder?.adres ?? {}),
              },
            },
            verzekering: { ...base.partyA.verzekering, ...((o.partyA as any)?.verzekering ?? {}) },
            voertuig: { ...base.partyA.voertuig, ...((o.partyA as any)?.voertuig ?? {}) },
          } as any)
        : partyA,
    partyB:
      typeof o.partyB === "object" && o.partyB && !maybeV1Party(o.partyB)
        ? ({
            ...base.partyB,
            ...(o.partyB as any),
            verzekeringsnemer: {
              ...base.partyB.verzekeringsnemer,
              ...((o.partyB as any)?.verzekeringsnemer ?? {}),
              adres: {
                ...base.partyB.verzekeringsnemer.adres,
                ...((o.partyB as any)?.verzekeringsnemer?.adres ?? {}),
              },
            },
            bestuurder: {
              ...base.partyB.bestuurder,
              ...((o.partyB as any)?.bestuurder ?? {}),
              adres: {
                ...base.partyB.bestuurder.adres,
                ...((o.partyB as any)?.bestuurder?.adres ?? {}),
              },
            },
            verzekering: { ...base.partyB.verzekering, ...((o.partyB as any)?.verzekering ?? {}) },
            voertuig: { ...base.partyB.voertuig, ...((o.partyB as any)?.voertuig ?? {}) },
          } as any)
        : partyB,
    dismissedBanners: {
      ...base.dismissedBanners,
      ...(typeof o.dismissedBanners === "object" && o.dismissedBanners
        ? (o.dismissedBanners as Record<string, boolean>)
        : {}),
    },
    currentStepId: (o.currentStepId as OngevalStepId) ?? base.currentStepId,
    navigationHistory: Array.isArray(o.navigationHistory)
      ? (o.navigationHistory as OngevalStepId[])
      : base.navigationHistory,
  } as AccidentReportState;

  // Guard against legacy step ids that no longer exist in the flow.
  const legacyReset = new Set(["party_a_mode", "party_b_mode"]);
  if (legacyReset.has(String((o as any).currentStepId))) {
    merged.currentStepId = "driver_select";
    merged.navigationHistory = [];
  }
  // Mappings voor hernoemde stappen zodat oude drafts niet naar het begin vallen.
  const legacyStepMap: Record<string, OngevalStepId> = {
    signature_a_intro: "signature_a",
    signature_b_intro: "signature_b",
    party_a_form: "policyholder_form",
  };
  const rawCurrent = String((o as { currentStepId?: unknown }).currentStepId ?? "");
  const mapped = legacyStepMap[rawCurrent];
  if (mapped) {
    merged.currentStepId = mapped;
  }
  merged.navigationHistory = merged.navigationHistory
    .map((s) => legacyStepMap[String(s)] ?? s)
    .filter((s): s is OngevalStepId => !legacyReset.has(String(s)));

  // Normaliseer datum/uur-velden naar ISO (matcht native <input type="date"/"time">).
  merged.location = {
    ...merged.location,
    datum: toIsoDate(merged.location.datum),
    tijd: toIsoTime(merged.location.tijd),
  };

  // Submission-mode + scan-submission veilig mergen vanuit ruwe payload.
  const rawMode = (o as { submissionMode?: unknown }).submissionMode;
  if (rawMode === "wizard" || rawMode === "scan") {
    merged.submissionMode = rawMode;
  } else if (
    merged.currentStepId !== "submission_mode" &&
    !SCAN_TRACK_STEP_IDS.has(merged.currentStepId)
  ) {
    // Bestaande draft van vóór de mode-picker: forceer wizard zodat we niet
    // terugvallen naar de keuzestap.
    merged.submissionMode = "wizard";
  } else {
    merged.submissionMode = base.submissionMode;
  }
  const rawScan = (o as { scanSubmission?: unknown }).scanSubmission;
  if (rawScan && typeof rawScan === "object") {
    const s = rawScan as Record<string, unknown>;
    const rawMeta =
      typeof s.metadata === "object" && s.metadata !== null
        ? (s.metadata as Record<string, unknown>)
        : {};
    merged.scanSubmission = {
      storagePath: typeof s.storagePath === "string" ? s.storagePath : null,
      pageCount: typeof s.pageCount === "number" ? s.pageCount : 0,
      uploadedAt: typeof s.uploadedAt === "string" ? s.uploadedAt : null,
      metadata: {
        datum: typeof rawMeta.datum === "string" ? toIsoDate(rawMeta.datum) : "",
        stad: typeof rawMeta.stad === "string" ? rawMeta.stad : "",
        nummerplaat:
          typeof rawMeta.nummerplaat === "string" ? rawMeta.nummerplaat : "",
        notitie: typeof rawMeta.notitie === "string" ? rawMeta.notitie : "",
      },
    };
  } else {
    merged.scanSubmission = base.scanSubmission;
  }

  // Approval-state vullen + verouderde approvals invalideren.
  const rawApproval = (o as { locationApproval?: unknown }).locationApproval;
  merged.locationApproval = {
    ...base.locationApproval,
    ...(typeof rawApproval === "object" && rawApproval !== null
      ? (rawApproval as Partial<AccidentReportState["locationApproval"]>)
      : {}),
  };
  if (
    merged.locationApproval.status === "approved" &&
    merged.locationApproval.approvedValuesHash !== null &&
    computeLocationHash(merged.location) !== merged.locationApproval.approvedValuesHash
  ) {
    merged.locationApproval = {
      status: "idle",
      approvedAt: null,
      rejectedAt: null,
      rejectionNote: "",
      approvedValuesHash: null,
    };
  }
  merged.employeeDriver = {
    ...merged.employeeDriver,
    geboortedatum: toIsoDate(merged.employeeDriver.geboortedatum),
  };
  merged.otherDriver = {
    ...merged.otherDriver,
    geboortedatum: toIsoDate(merged.otherDriver.geboortedatum),
  };
  merged.partyA = {
    ...merged.partyA,
    bestuurder: {
      ...merged.partyA.bestuurder,
      geboortedatum: toIsoDate(merged.partyA.bestuurder.geboortedatum),
    },
  };
  merged.partyB = {
    ...merged.partyB,
    bestuurder: {
      ...merged.partyB.bestuurder,
      geboortedatum: toIsoDate(merged.partyB.bestuurder.geboortedatum),
    },
  };

  return merged;
}
