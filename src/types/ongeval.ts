/**
 * Wizard payload stored in `ongeval_aangiften.payload` (jsonb) and typed in the client.
 * Bump `version` when making breaking shape changes and migrate old rows if needed.
 */
export const ONGEVAL_PAYLOAD_VERSION = 2 as const;

/** All known wizard screen ids (extend when adding branches). */
export type OngevalStepId =
  | "submission_mode"
  | "scan_capture"
  | "driver_select"
  | "driver_employee_form"
  | "driver_other_form"
  | "policyholder_select"
  | "policyholder_form"
  | "insurer_select"
  | "vehicle_confirm"
  | "parties_count"
  | "devices_count"
  | "role_select"
  | "share_qr"
  | "scan_qr"
  | "party_b_language"
  | "party_b_optional"
  | "party_b_form"
  | "location_time"
  | "injuries_material"
  | "witnesses"
  | "situation_main"
  | "sit_rear_end"
  | "sit_center_line"
  | "sit_priority"
  | "sit_maneuver_a"
  | "sit_maneuver_b"
  | "sit_lane_change"
  | "sit_parking"
  | "sit_door"
  | "sit_load"
  | "proposal_intro"
  | "proposal_decision"
  | "circumstances_manual"
  | "vehicle_contact"
  | "impact_party_a"
  | "impact_party_b"
  | "overview_intro"
  | "overview_detail"
  | "signature_a"
  | "signature_b"
  | "complete";

export type SubmissionMode = "wizard" | "scan";

/**
 * Metadata gathered in de scan-fallback flow. Geen wizard-velden, enkel het
 * minimum om de mail naar de fleetmanager goed onderwerpen + opvolgen.
 */
export type ScanSubmission = {
  /** Server-side path in `ongeval-scans` bucket (na upload). */
  storagePath: string | null;
  pageCount: number;
  uploadedAt: string | null;
  metadata: {
    /** Datum van het ongeval (YYYY-MM-DD). */
    datum: string;
    /** Stad van het ongeval (voor onderwerp). */
    stad: string;
    /** Eigen nummerplaat (voor onderwerp + identificatie). */
    nummerplaat: string;
    /** Optionele toelichting voor de fleetmanager. */
    notitie: string;
  };
};

export type PartyEntryMode = "qr" | "profile" | "manual";

/** Normalized point on the car diagram (0–1 in viewBox). */
export type ImpactPoint = { x: number; y: number };

export type Address = {
  straat: string;
  huisnummer: string;
  bus: string;
  postcode: string;
  stad: string;
  land: string;
};

export type Person = {
  voornaam: string;
  naam: string;
  ondernemingsnummer: string;
  geboortedatum: string;
  telefoon: string;
  email: string;
  adres: Address;
};

export type Driver = Person & {
  rijbewijsNummer: string;
};

export type InsuranceInfo = {
  maatschappij: string;
  polisnummer: string;
};

export type VehicleInfo = {
  merkModel: string;
  nummerplaat: string;
  landInschrijving: string;
};

export type PolicyholderType = "employee" | "company" | "other";

export type PartyDetails = {
  verzekeringsnemerType: PolicyholderType;
  verzekeringsnemer: Person;
  bestuurder: Driver;
  verzekering: InsuranceInfo;
  voertuig: VehicleInfo;
};

export type SituationCategoryId =
  | "parking"
  | "rear_end"
  | "maneuver"
  | "priority"
  | "lane_change"
  | "opposite"
  | "door"
  | "load";

/**
 * Full wizard state: answers + UI navigation.
 * `navigationHistory` holds prior step ids when using “Terug” (stack).
 */
export type AccidentReportState = {
  version: typeof ONGEVAL_PAYLOAD_VERSION;
  currentStepId: OngevalStepId;
  navigationHistory: OngevalStepId[];

  /**
   * Hoe de aangifte tot stand komt.
   * - "wizard" (default): bestaande stap-voor-stap flow.
   * - "scan": A scant het papieren formulier en stuurt enkel de PDF door.
   * `null` zolang de gebruiker nog niets gekozen heeft op de mode-picker.
   */
  submissionMode: SubmissionMode | null;

  /** Status + metadata wanneer `submissionMode === "scan"`. */
  scanSubmission: ScanSubmission;

  partiesCount: 1 | 2 | null;
  devicesCount: 1 | 2 | null;
  role: "A" | "B" | null;
  partyBLanguage: "nl" | "fr" | "en" | null;
  wantsFillPartyB: boolean | null;

  driverWasEmployee: boolean | null;
  employeeDriver: Driver;
  otherDriver: Driver;

  location: {
    straat: string;
    huisnummer: string;
    postcode: string;
    stad: string;
    land: string;
    datum: string;
    tijd: string;
  };

  /**
   * Wederzijdse goedkeuring van plaats + tijd.
   * Enkel relevant in 2 partijen + 2 toestellen-scenario.
   * - "idle": A bewerkt vrij, nog niet voorgelegd.
   * - "pending": A heeft ter goedkeuring gestuurd, B beslist.
   * - "approved": B akkoord; A kan verder. Hash bewaart de waarden.
   * - "rejected": B niet akkoord; A ziet opmerking en past aan.
   */
  locationApproval: {
    status: "idle" | "pending" | "approved" | "rejected";
    approvedAt: string | null;
    rejectedAt: string | null;
    rejectionNote: string;
    approvedValuesHash: string | null;
  };

  gewonden: boolean | null;
  materieleSchadeAnders: boolean | null;

  getuigen: string;

  partyA: PartyDetails;

  partyB: PartyDetails;

  situationCategory: SituationCategoryId | null;
  /** Sub-selection key within the category (rear A/B, center option id, etc.). */
  situationDetailKey: string | null;

  maneuverAKey: string | null;
  maneuverBKey: string | null;

  proposalAccepted: boolean | null;

  /** Section 12–style free circumstances when user rejects the proposal. */
  circumstancesNotes: string;

  vehicleContact: boolean | null;

  impactPartyA: ImpactPoint | null;
  impactPartyB: ImpactPoint | null;

  overviewSkipped: boolean;

  /** PNG data URLs from signature canvas */
  signaturePartyA: string | null;
  signaturePartyB: string | null;

  /** Dismissed info banners per step id */
  dismissedBanners: Record<string, boolean>;
};

export function createInitialAccidentState(): AccidentReportState {
  const emptyAddress = (): Address => ({
    straat: "",
    huisnummer: "",
    bus: "",
    postcode: "",
    stad: "",
    land: "België",
  });

  const emptyPerson = (): Person => ({
    voornaam: "",
    naam: "",
    ondernemingsnummer: "",
    geboortedatum: "",
    telefoon: "",
    email: "",
    adres: emptyAddress(),
  });

  const emptyDriver = (): Driver => ({
    ...emptyPerson(),
    rijbewijsNummer: "",
  });

  const emptyParty = (): PartyDetails => ({
    verzekeringsnemerType: "company",
    verzekeringsnemer: emptyPerson(),
    bestuurder: emptyDriver(),
    verzekering: { maatschappij: "", polisnummer: "" },
    voertuig: { merkModel: "", nummerplaat: "", landInschrijving: "België" },
  });

  return {
    version: ONGEVAL_PAYLOAD_VERSION,
    currentStepId: "submission_mode",
    navigationHistory: [],
    submissionMode: null,
    scanSubmission: {
      storagePath: null,
      pageCount: 0,
      uploadedAt: null,
      metadata: {
        datum: "",
        stad: "",
        nummerplaat: "",
        notitie: "",
      },
    },
    partiesCount: null,
    devicesCount: null,
    role: null,
    partyBLanguage: null,
    wantsFillPartyB: null,
    driverWasEmployee: null,
    employeeDriver: emptyDriver(),
    otherDriver: emptyDriver(),
    location: {
      straat: "",
      huisnummer: "",
      postcode: "",
      stad: "",
      land: "België",
      datum: "",
      tijd: "",
    },
    locationApproval: {
      status: "idle",
      approvedAt: null,
      rejectedAt: null,
      rejectionNote: "",
      approvedValuesHash: null,
    },
    gewonden: null,
    materieleSchadeAnders: null,
    getuigen: "",
    partyA: emptyParty(),
    partyB: emptyParty(),
    situationCategory: null,
    situationDetailKey: null,
    maneuverAKey: null,
    maneuverBKey: null,
    proposalAccepted: null,
    circumstancesNotes: "",
    vehicleContact: null,
    impactPartyA: null,
    impactPartyB: null,
    overviewSkipped: false,
    signaturePartyA: null,
    signaturePartyB: null,
    dismissedBanners: {},
  };
}
