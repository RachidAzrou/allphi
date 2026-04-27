import type {
  AccidentReportState,
  OngevalStepId,
  PartyDetails,
} from "@/types/ongeval";
import { createInitialAccidentState } from "@/types/ongeval";
import { toIsoDate, toIsoTime } from "@/lib/ongeval/date-utils";

const ACCIDENT_PHASE_ORDER: OngevalStepId[][] = [
  [
    "incident_kind",
    "safety_police",
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
  ["circumstances_manual"],
  [
    "vehicle_contact",
    "impact_party_a",
    "visible_damage_a",
    "impact_party_b",
    "visible_damage_b",
    "accident_sketch",
  ],
  ["overview_intro", "overview_detail"],
  ["signature_a", "signature_b", "vehicle_mobility", "escalation", "complete"],
];

const DAMAGE_PHASE_ORDER: OngevalStepId[][] = [
  ["incident_kind", "damage_type"],
  ["damage_glass", "damage_theft_vandalism", "damage_single_vehicle", "police_pv"],
  ["franchise", "vehicle_mobility", "escalation", "complete"],
];

/**
 * Veel kortere phase-balk voor de scan-fallback flow. Drie fases:
 * 1) modus kiezen, 2) pagina's scannen, 3) bevestigen + verzenden.
 */
const SCAN_PHASE_ORDER: OngevalStepId[][] = [
  ["incident_kind", "safety_police", "submission_mode"],
  ["scan_capture"],
  ["vehicle_mobility", "escalation", "complete"],
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
  const inferredIncident =
    state?.incidentKind ??
    ([
      "damage_type",
      "damage_glass",
      "damage_theft_vandalism",
      "damage_single_vehicle",
      "franchise",
    ].includes(stepId)
      ? "damage_only"
      : "accident_with_other_party");

  const usingScanTrack =
    inferredIncident === "accident_with_other_party" &&
    (state?.submissionMode === "scan" || SCAN_TRACK_STEP_IDS.has(stepId));

  const phases =
    inferredIncident === "damage_only"
      ? DAMAGE_PHASE_ORDER
      : usingScanTrack
        ? SCAN_PHASE_ORDER
        : ACCIDENT_PHASE_ORDER;
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

/**
 * Voor multi-select. Geeft de geordende lijst sub-stappen terug op basis van
 * de gekozen categorieën. Eén categorie kan meerdere sub-stappen aanleveren
 * (bv. "maneuver" → A én B).
 */
const CATEGORY_SUB_STEPS: Record<
  AccidentReportState["situationCategories"][number],
  OngevalStepId[]
> = {
  parking: ["sit_parking"],
  rear_end: ["sit_rear_end"],
  maneuver: ["sit_maneuver_a", "sit_maneuver_b"],
  priority: ["sit_priority"],
  lane_change: ["sit_lane_change"],
  opposite: ["sit_center_line"],
  door: ["sit_door"],
  load: ["sit_load"],
};

/**
 * Bouwt de chronologische lijst sub-stappen op basis van de gekozen
 * categorieën. Volgorde komt uit `SITUATION_CATEGORIES` zodat de UI altijd
 * dezelfde volgorde gebruikt als de keuzelijst.
 */
function getOrderedSituationSubSteps(
  state: AccidentReportState,
): OngevalStepId[] {
  // Volgorde uit SITUATION_CATEGORIES zonder hier te importeren (cyclus
  // vermijden): zelfde literal-array hieronder.
  const order: AccidentReportState["situationCategories"] = [
    "parking",
    "rear_end",
    "maneuver",
    "priority",
    "lane_change",
    "opposite",
    "door",
    "load",
  ];
  const selected = new Set(state.situationCategories);
  const steps: OngevalStepId[] = [];
  for (const cat of order) {
    if (!selected.has(cat)) continue;
    for (const step of CATEGORY_SUB_STEPS[cat]) steps.push(step);
  }
  return steps;
}

function nextSituationSubStep(
  state: AccidentReportState,
  current: OngevalStepId,
): OngevalStepId {
  const steps = getOrderedSituationSubSteps(state);
  if (steps.length === 0) return "circumstances_manual";
  if (current === "situation_main") return steps[0];
  const idx = steps.indexOf(current);
  if (idx === -1 || idx === steps.length - 1) return "circumstances_manual";
  return steps[idx + 1];
}

export function getNextStepId(
  from: OngevalStepId,
  state: AccidentReportState,
): OngevalStepId | null {
  switch (from) {
    case "incident_kind":
      if (state.incidentKind === "damage_only") return "damage_type";
      if (state.incidentKind === "accident_with_other_party") return "safety_police";
      return "incident_kind";
    case "safety_police":
      // Voor ongeval-flow gaan we altijd via de submission-mode picker
      // (wizard vs scan). Schade-flow komt hier niet.
      return "submission_mode";
    case "police_pv":
      return "franchise";
    case "damage_type":
      if (state.damageType === "glass") return "damage_glass";
      if (state.damageType === "theft_vandalism") return "damage_theft_vandalism";
      if (state.damageType === "single_vehicle") return "damage_single_vehicle";
      return "damage_type";
    case "damage_glass":
      return "franchise";
    case "damage_theft_vandalism":
      return "police_pv";
    case "damage_single_vehicle":
      return "franchise";
    case "franchise":
      return "vehicle_mobility";
    case "vehicle_mobility":
      return "escalation";
    case "escalation":
      return "complete";
    case "submission_mode":
      if (state.submissionMode === "scan") return "scan_capture";
      return "driver_select";
    case "scan_capture":
      return "vehicle_mobility";
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
      // Met slechts één partij aanwezig zijn alle B-gerelateerde stappen
      // (toestelkeuze, rol/QR, taal en het optionele B-formulier) niet
      // relevant: er is geen tweede partij om mee in te vullen. Spring
      // meteen naar plaats & tijd.
      if (state.partiesCount === 1) return "location_time";
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
    case "situation_main":
    case "sit_rear_end":
    case "sit_center_line":
    case "sit_priority":
    case "sit_lane_change":
    case "sit_parking":
    case "sit_door":
    case "sit_load":
    case "sit_maneuver_a":
    case "sit_maneuver_b":
      return nextSituationSubStep(state, from);
    case "circumstances_manual":
      return "vehicle_contact";
    case "vehicle_contact":
      if (state.vehicleContact === true) return "impact_party_a";
      return "accident_sketch";
    case "impact_party_a":
      return "visible_damage_a";
    case "visible_damage_a":
      return "impact_party_b";
    case "impact_party_b":
      return "visible_damage_b";
    case "visible_damage_b":
      return "accident_sketch";
    case "accident_sketch":
      return "overview_intro";
    case "overview_intro":
      return "overview_detail";
    case "overview_detail":
      return "signature_a";
    case "signature_a":
      return "signature_b";
    case "signature_b":
      // Partij B should not see fleet-related steps (mobility/escalation).
      // They can be a private driver with no fleet context.
      if (state.role === "B") return "complete";
      return "vehicle_mobility";
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
    case "incident_kind":
      return state.incidentKind !== null;
    case "safety_police":
      // Informative step: no explicit confirmation required.
      return true;
    case "damage_type":
      return state.damageType !== null;
    case "damage_glass":
      return (
        state.photosTaken !== null &&
        (state.photosTaken === false || state.damagePhotos.length > 0)
      );
    case "damage_theft_vandalism":
      return state.damagePhotos.length > 0;
    case "damage_single_vehicle":
      return (
        state.photosTaken !== null &&
        (state.photosTaken === false || state.damagePhotos.length > 0)
      );
    case "police_pv":
      return state.policeReportNumber.trim().length > 0;
    case "franchise":
      return state.employeeLevel !== null;
    case "vehicle_mobility":
      return state.vehicleMobile !== null;
    case "escalation":
      return true;
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
        state.otherDriver.rijbewijsNummer.trim().length > 0 &&
        state.otherDriver.rijbewijsCategorie.trim().length > 0 &&
        state.otherDriver.rijbewijsGeldigTot.trim().length > 0
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
        state.employeeDriver.rijbewijsNummer.trim().length > 0 &&
        state.employeeDriver.rijbewijsCategorie.trim().length > 0 &&
        state.employeeDriver.rijbewijsGeldigTot.trim().length > 0
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
        state.partyA.verzekering.polisnummer.trim().length > 0 &&
        state.partyA.verzekering.groeneKaartNr.trim().length > 0 &&
        state.partyA.verzekering.geldigVan.trim().length > 0 &&
        state.partyA.verzekering.geldigTot.trim().length > 0
      );
    case "vehicle_confirm": {
      const trailerA = state.partyA.voertuig.aanhanger;
      return (
        state.partyA.voertuig.merkModel.trim().length > 0 &&
        state.partyA.voertuig.nummerplaat.trim().length > 0 &&
        state.partyA.voertuig.landInschrijving.trim().length > 0 &&
        (trailerA === null ||
          (trailerA.nummerplaat.trim().length > 0 &&
            trailerA.landInschrijving.trim().length > 0))
      );
    }
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
    case "party_b_form": {
      const trailerB = state.partyB.voertuig.aanhanger;
      return (
        state.partyB.verzekeringsnemer.naam.trim().length > 0 &&
        state.partyB.verzekeringsnemer.voornaam.trim().length > 0 &&
        state.partyB.verzekering.maatschappij.trim().length > 0 &&
        state.partyB.verzekering.polisnummer.trim().length > 0 &&
        state.partyB.verzekering.groeneKaartNr.trim().length > 0 &&
        state.partyB.verzekering.geldigVan.trim().length > 0 &&
        state.partyB.verzekering.geldigTot.trim().length > 0 &&
        state.partyB.voertuig.merkModel.trim().length > 0 &&
        state.partyB.voertuig.nummerplaat.trim().length > 0 &&
        state.partyB.bestuurder.voornaam.trim().length > 0 &&
        state.partyB.bestuurder.naam.trim().length > 0 &&
        (trailerB === null ||
          (trailerB.nummerplaat.trim().length > 0 &&
            trailerB.landInschrijving.trim().length > 0))
      );
    }
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
    case "witnesses": {
      if (state.hasGetuigen === null) return false;
      if (state.hasGetuigen === false) return true;
      // Bij ja: minstens één getuige met voornaam + naam ingevuld.
      return state.getuigenList.some(
        (w) => w.voornaam.trim().length > 0 && w.naam.trim().length > 0,
      );
    }
    case "situation_main":
      return state.situationCategories.length > 0;
    case "sit_rear_end":
      return state.situationDetailKeys.some((k) =>
        ["a_rear", "b_rear"].includes(k),
      );
    case "sit_center_line":
      return state.situationDetailKeys.some((k) =>
        ["a_crossed", "b_crossed", "both_crossed"].includes(k),
      );
    case "sit_priority":
      return state.situationDetailKeys.some((k) =>
        [
          "a_yield_x",
          "b_yield_x",
          "a_stop_x",
          "b_stop_x",
          "a_yield_round",
          "b_yield_round",
        ].includes(k),
      );
    case "sit_lane_change":
      return state.situationDetailKeys.some((k) =>
        ["a_lane", "b_lane", "both_lane"].includes(k),
      );
    case "sit_parking":
      return state.situationDetailKeys.some((k) =>
        ["park_moving", "park_opening"].includes(k),
      );
    case "sit_door":
      return state.situationDetailKeys.some((k) =>
        ["door_a", "door_b"].includes(k),
      );
    case "sit_load":
      return state.situationDetailKeys.some((k) =>
        ["load_a", "load_b"].includes(k),
      );
    // Voor manoeuvres mag elke pagina leeg zijn, zolang minstens één keuze
    // gemaakt is over A én B samen (anders heeft "manoeuvre" geen inhoud).
    case "sit_maneuver_a":
      return true;
    case "sit_maneuver_b":
      return state.maneuverAKeys.length + state.maneuverBKeys.length > 0;
    case "circumstances_manual":
      return true;
    case "vehicle_contact":
      return state.vehicleContact !== null;
    case "impact_party_a":
      return state.vehicleContact === false || state.impactPartyA !== null;
    case "impact_party_b":
      return state.vehicleContact === false || state.impactPartyB !== null;
    // Schade-omschrijving en situatieschets zijn optioneel — gebruiker kan ze
    // overslaan zonder iets in te vullen.
    case "visible_damage_a":
      return true;
    case "visible_damage_b":
      return true;
    case "accident_sketch":
      return true;
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
    incident_kind: "Wat wil je melden?",
    safety_police: "Veiligheid & politie",
    police_pv: "PV-nummer",
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
    circumstances_manual: "Aanvullende opmerkingen (optioneel)",
    vehicle_contact: "Raakpunt aan de voertuigen",
    impact_party_a: "Raakpunt voertuig A",
    impact_party_b: "Raakpunt voertuig B",
    visible_damage_a: "Zichtbare schade voertuig A",
    visible_damage_b: "Zichtbare schade voertuig B",
    accident_sketch: "Situatieschets",
    overview_intro: "Overzicht ongevalsaangifte",
    overview_detail: "Overzicht",
    signature_a: "Handtekening A",
    signature_b: "Handtekening B",
    vehicle_mobility: "Mobiliteit",
    damage_type: "Type schade",
    damage_glass: "Glasbreuk",
    damage_theft_vandalism: "Diefstal / vandalisme",
    damage_single_vehicle: "Eenzijdige schade",
    franchise: "Eigen risico",
    escalation: "Escalatie",
    complete: "Voltooiing",
  };
  return titles[stepId];
}

/** Veilige getters voor het lezen van losse velden uit een onbekend object. */
function asObj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}
function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

/**
 * Mergen van één partij (A of B) uit een onbekende payload op de defaults.
 * Gebruikt veilige getters i.p.v. `as any` zodat er geen lint-overtredingen
 * worden geïntroduceerd bij het toevoegen van nieuwe geneste velden.
 */
function mergeParty(base: PartyDetails, raw: unknown): PartyDetails {
  const p = asObj(raw);
  const vh = asObj(p.verzekeringsnemer);
  const vhAdres = asObj(vh.adres);
  const bd = asObj(p.bestuurder);
  const bdAdres = asObj(bd.adres);
  const vz = asObj(p.verzekering);
  const vzAg = asObj(vz.agentschap);
  const vt = asObj(p.voertuig);
  const trailer = vt.aanhanger as unknown;
  const tr = asObj(trailer);

  return {
    ...base,
    ...(p as Partial<PartyDetails>),
    verzekeringsnemer: {
      ...base.verzekeringsnemer,
      ...(vh as Partial<PartyDetails["verzekeringsnemer"]>),
      adres: {
        ...base.verzekeringsnemer.adres,
        ...(vhAdres as Partial<PartyDetails["verzekeringsnemer"]["adres"]>),
      },
    },
    bestuurder: {
      ...base.bestuurder,
      ...(bd as Partial<PartyDetails["bestuurder"]>),
      adres: {
        ...base.bestuurder.adres,
        ...(bdAdres as Partial<PartyDetails["bestuurder"]["adres"]>),
      },
    },
    verzekering: {
      ...base.verzekering,
      ...(vz as Partial<PartyDetails["verzekering"]>),
      agentschap: {
        ...base.verzekering.agentschap,
        ...(vzAg as Partial<PartyDetails["verzekering"]["agentschap"]>),
      },
    },
    voertuig: {
      ...base.voertuig,
      ...(vt as Partial<PartyDetails["voertuig"]>),
      aanhanger:
        trailer && typeof trailer === "object"
          ? {
              nummerplaat: asString(tr.nummerplaat),
              landInschrijving: asString(tr.landInschrijving, "België"),
            }
          : null,
    },
  };
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
        ? mergeParty(base.partyA, o.partyA)
        : partyA,
    partyB:
      typeof o.partyB === "object" && o.partyB && !maybeV1Party(o.partyB)
        ? mergeParty(base.partyB, o.partyB)
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

  // Backwards-compat: oude drafts (voor incident-keuze) beschouwen we als
  // "ongeval met tegenpartij", zodat ze niet naar het begin terugvallen.
  if (merged.incidentKind === null) {
    const damageSteps = new Set<OngevalStepId>([
      "damage_type",
      "damage_glass",
      "damage_theft_vandalism",
      "damage_single_vehicle",
      "franchise",
      "police_pv",
    ]);
    if (!damageSteps.has(merged.currentStepId)) {
      merged.incidentKind = "accident_with_other_party";
    }
  }

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
    // Voorstel-stappen zijn vervangen door één optionele opmerkingen-stap.
    proposal_intro: "circumstances_manual",
    proposal_decision: "circumstances_manual",
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

  // Getuigen: nieuwe gestructureerde vorm + legacy vrije-tekst best-effort.
  const rawWitnessList = (o as { getuigenList?: unknown }).getuigenList;
  if (Array.isArray(rawWitnessList)) {
    merged.getuigenList = rawWitnessList
      .map((w) => {
        if (!w || typeof w !== "object") return null;
        const r = w as Record<string, unknown>;
        return {
          voornaam: typeof r.voornaam === "string" ? r.voornaam : "",
          naam: typeof r.naam === "string" ? r.naam : "",
          telefoon: typeof r.telefoon === "string" ? r.telefoon : "",
        };
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);
  } else {
    merged.getuigenList = base.getuigenList;
  }
  const rawHas = (o as { hasGetuigen?: unknown }).hasGetuigen;
  if (rawHas === true || rawHas === false) {
    merged.hasGetuigen = rawHas;
  } else {
    // Geen expliciete boolean → leid af van legacy `getuigen` string.
    const legacyText =
      typeof (o as { getuigen?: unknown }).getuigen === "string"
        ? ((o as { getuigen: string }).getuigen ?? "").trim()
        : "";
    if (legacyText.length > 0) {
      merged.hasGetuigen = true;
      if (merged.getuigenList.length === 0) {
        merged.getuigenList = [
          { voornaam: "", naam: legacyText, telefoon: "" },
        ];
      }
    } else {
      merged.hasGetuigen = base.hasGetuigen;
    }
  }

  // Ongevalsituaties: nieuwe arrays + legacy single-value migratie.
  const validCats: AccidentReportState["situationCategories"] = [
    "parking",
    "rear_end",
    "maneuver",
    "priority",
    "lane_change",
    "opposite",
    "door",
    "load",
  ];
  const isValidCat = (
    v: unknown,
  ): v is AccidentReportState["situationCategories"][number] =>
    typeof v === "string" &&
    (validCats as readonly string[]).includes(v);

  const dedupe = <T,>(arr: T[]): T[] => Array.from(new Set(arr));

  const rawCats = (o as { situationCategories?: unknown }).situationCategories;
  let mergedCats = Array.isArray(rawCats)
    ? rawCats.filter(isValidCat)
    : [];
  const legacyCat = (o as { situationCategory?: unknown }).situationCategory;
  if (isValidCat(legacyCat) && !mergedCats.includes(legacyCat)) {
    mergedCats = [...mergedCats, legacyCat];
  }
  merged.situationCategories = dedupe(mergedCats);

  const rawDetails = (o as { situationDetailKeys?: unknown }).situationDetailKeys;
  let mergedDetails = Array.isArray(rawDetails)
    ? rawDetails.filter((v): v is string => typeof v === "string")
    : [];
  const legacyDetail = (o as { situationDetailKey?: unknown }).situationDetailKey;
  if (typeof legacyDetail === "string" && legacyDetail.length > 0) {
    mergedDetails = [...mergedDetails, legacyDetail];
  }
  merged.situationDetailKeys = dedupe(mergedDetails);

  const rawManA = (o as { maneuverAKeys?: unknown }).maneuverAKeys;
  let mergedManA = Array.isArray(rawManA)
    ? rawManA.filter((v): v is string => typeof v === "string")
    : [];
  const legacyManA = (o as { maneuverAKey?: unknown }).maneuverAKey;
  if (typeof legacyManA === "string" && legacyManA.length > 0) {
    mergedManA = [...mergedManA, legacyManA];
  }
  merged.maneuverAKeys = dedupe(mergedManA);

  const rawManB = (o as { maneuverBKeys?: unknown }).maneuverBKeys;
  let mergedManB = Array.isArray(rawManB)
    ? rawManB.filter((v): v is string => typeof v === "string")
    : [];
  const legacyManB = (o as { maneuverBKey?: unknown }).maneuverBKey;
  if (typeof legacyManB === "string" && legacyManB.length > 0) {
    mergedManB = [...mergedManB, legacyManB];
  }
  merged.maneuverBKeys = dedupe(mergedManB);

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
