/**
 * Wizard payload stored in `ongeval_aangiften.payload` (jsonb) and typed in the client.
 * Bump `version` when making breaking shape changes and migrate old rows if needed.
 */
export const ONGEVAL_PAYLOAD_VERSION = 4 as const;

/** All known wizard screen ids (extend when adding branches). */
export type OngevalStepId =
  | "incident_kind"
  | "safety_police"
  | "police_pv"
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
  | "circumstances_manual"
  | "vehicle_contact"
  | "impact_party_a"
  | "visible_damage_a"
  | "impact_party_b"
  | "visible_damage_b"
  | "accident_sketch"
  | "overview_intro"
  | "overview_detail"
  | "signature_a"
  | "signature_b"
  | "vehicle_mobility"
  | "damage_type"
  | "damage_glass"
  | "damage_theft_vandalism"
  | "damage_single_vehicle"
  | "franchise"
  | "escalation"
  | "complete";

export type SubmissionMode = "wizard" | "scan";

/**
 * Eén getuige bij sectie 5 van het Europees aanrijdingsformulier.
 * Voornaam + naam zijn verplicht; telefoon is optioneel.
 */
export type Witness = {
  voornaam: string;
  naam: string;
  telefoon: string;
};

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
  /** Rijbewijscategorie: A, B, BE, C, D, … (sectie 9 PDF). */
  rijbewijsCategorie: string;
  /** Geldigheidsdatum rijbewijs (ISO YYYY-MM-DD). */
  rijbewijsGeldigTot: string;
};

/**
 * Optionele agentschap-/makelaarsgegevens (sectie 8 PDF). Wordt enkel
 * weergegeven wanneer er minstens één veld is ingevuld.
 */
export type InsuranceAgent = {
  naam: string;
  /** Telefoonnr of e-mail (vrije tekst — past op één regel op PDF). */
  contact: string;
};

export type InsuranceInfo = {
  maatschappij: string;
  polisnummer: string;
  /** Nr. van groene kaart (sectie 8 PDF). Optioneel. */
  groeneKaartNr: string;
  /** Geldig vanaf (ISO YYYY-MM-DD). Optioneel. */
  geldigVan: string;
  /** Geldig tot (ISO YYYY-MM-DD). Optioneel. */
  geldigTot: string;
  /** Agentschap / makelaar — optioneel. */
  agentschap: InsuranceAgent;
  /**
   * Is de schade aan het voertuig verzekerd in het contract?
   * `null` = niet beantwoord / niet getoond.
   */
  schadeVerzekerd: boolean | null;
};

/**
 * Optionele aanhangwagen-info (sectie 7 PDF). `null` betekent dat er geen
 * aanhangwagen aan het voertuig hing op het moment van het ongeval.
 */
export type TrailerInfo = {
  nummerplaat: string;
  landInschrijving: string;
};

export type VehicleInfo = {
  merkModel: string;
  nummerplaat: string;
  landInschrijving: string;
  /** Aanhangwagen — `null` indien geen aanhanger. */
  aanhanger: TrailerInfo | null;
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

export type IncidentKind = "accident_with_other_party" | "damage_only";

export type PoliceReason = "refused_to_sign" | "hit_and_run" | "suspected_impairment";

export type DamageType = "glass" | "theft_vandalism" | "single_vehicle";

export type DamagePhoto = {
  bucket: "ongeval-photos";
  path: string;
  name: string;
  mime: string;
  uploadedAt: string;
};

export type EmployeeLevel = 1 | 2 | 3;

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

  /** Hoofdkeuze: ongeval met tegenpartij vs schade zonder tegenpartij. */
  incidentKind: IncidentKind | null;

  /** Veiligheid / politie instructies (deterministische beslisboom). */
  vehicleParkedSafe: boolean | null;
  policeReasons: PoliceReason[];
  policeReportNumber: string;
  hitAndRun: boolean | null;

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

  /**
   * Waren er getuigen ter plaatse?
   * - `null`: nog niet beantwoord.
   * - `false`: geen getuigen — `getuigenList` is leeg.
   * - `true`: minstens één getuige in `getuigenList`.
   */
  hasGetuigen: boolean | null;
  getuigenList: Witness[];

  partyA: PartyDetails;

  partyB: PartyDetails;

  /**
   * UI-hulp: in partij B formulier kan de bestuurder dezelfde persoon zijn als
   * de verzekeringsnemer. Indien `true` nemen we naam + adres automatisch over
   * zodat de gebruiker dit niet dubbel hoeft in te vullen.
   */
  partyBDriverSameAsPolicyholder: boolean;

  /**
   * Eén of meerdere gekozen ongevalsituaties.
   * Volgt de volgorde van `SITUATION_CATEGORIES`. Door multi-select kunnen
   * meerdere categorieën samen aangevinkt worden (bv. parking + lane_change).
   */
  situationCategories: SituationCategoryId[];
  /**
   * Plat gehouden lijst van detail-keys over alle categorieën heen. Iedere
   * detail-id (bv. `a_rear`, `door_b`, `park_moving`) is uniek over de hele
   * app, dus we hoeven hem niet per categorie te groeperen voor opslag.
   */
  situationDetailKeys: string[];

  /** Manoeuvre-keys voor partij A — meerdere keuzes mogelijk. */
  maneuverAKeys: string[];
  /** Manoeuvre-keys voor partij B — meerdere keuzes mogelijk. */
  maneuverBKeys: string[];

  /**
   * Optionele vrije tekst voor sectie 14 (opmerkingen) van het Europees
   * aanrijdingsformulier. Mag leeg blijven.
   */
  circumstancesNotes: string;

  vehicleContact: boolean | null;

  impactPartyA: ImpactPoint | null;
  impactPartyB: ImpactPoint | null;

  /**
   * Vrije omschrijving van de zichtbare schade per voertuig (sectie 11 PDF).
   * Maximum 3 regels op het sjabloon — handmatig wrappen tijdens render.
   */
  visibleDamagePartyA: string;
  visibleDamagePartyB: string;

  /**
   * Optionele situatieschets als PNG dataURL (sectie 13 PDF). Wordt
   * gerenderd in het schetsvak van het sjabloon én op de coversheet.
   * `null` = overgeslagen.
   */
  accidentSketch: string | null;

  overviewSkipped: boolean;

  /** PNG data URLs from signature canvas */
  signaturePartyA: string | null;
  signaturePartyB: string | null;

  /** Dismissed info banners per step id */
  dismissedBanners: Record<string, boolean>;

  /** Mobiliteit en takelbeslissing (na melding). */
  vehicleMobile: boolean | null;
  towingRequired: boolean | null;

  /** Schade-only track */
  damageType: DamageType | null;
  photosTaken: boolean | null;
  damagePhotos: DamagePhoto[];
  glassRepairProvider: string;
  claimNotes: string;

  /** Franchise / eigen risico */
  employeeLevel: EmployeeLevel | null;
  /** Optionele schatting (EUR) om uitzonderingsregel te tonen. */
  repairCostEstimateEur: number | null;

  /** Escalatie (human-in-the-loop) signalen */
  escalation: {
    uncertainLiability: boolean;
    heavyOrComplexDamage: boolean;
    grossNegligenceSuspected: boolean;
    unreportedDamageAtReturn: boolean;
  };
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
    rijbewijsCategorie: "",
    rijbewijsGeldigTot: "",
  });

  const emptyInsurance = (): InsuranceInfo => ({
    maatschappij: "",
    polisnummer: "",
    groeneKaartNr: "",
    geldigVan: "",
    geldigTot: "",
    agentschap: { naam: "", contact: "" },
    schadeVerzekerd: null,
  });

  const emptyParty = (): PartyDetails => ({
    verzekeringsnemerType: "company",
    verzekeringsnemer: emptyPerson(),
    bestuurder: emptyDriver(),
    verzekering: emptyInsurance(),
    voertuig: {
      merkModel: "",
      nummerplaat: "",
      landInschrijving: "België",
      aanhanger: null,
    },
  });

  return {
    version: ONGEVAL_PAYLOAD_VERSION,
    currentStepId: "incident_kind",
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
    incidentKind: null,
    vehicleParkedSafe: null,
    policeReasons: [],
    policeReportNumber: "",
    hitAndRun: null,
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
    hasGetuigen: null,
    getuigenList: [],
    partyA: emptyParty(),
    partyB: emptyParty(),
    partyBDriverSameAsPolicyholder: false,
    situationCategories: [],
    situationDetailKeys: [],
    maneuverAKeys: [],
    maneuverBKeys: [],
    circumstancesNotes: "",
    vehicleContact: null,
    impactPartyA: null,
    impactPartyB: null,
    visibleDamagePartyA: "",
    visibleDamagePartyB: "",
    accidentSketch: null,
    overviewSkipped: false,
    signaturePartyA: null,
    signaturePartyB: null,
    dismissedBanners: {},
    vehicleMobile: null,
    towingRequired: null,
    damageType: null,
    photosTaken: null,
    damagePhotos: [],
    glassRepairProvider: "Carglass",
    claimNotes: "",
    employeeLevel: null,
    repairCostEstimateEur: null,
    escalation: {
      uncertainLiability: false,
      heavyOrComplexDamage: false,
      grossNegligenceSuspected: false,
      unreportedDamageAtReturn: false,
    },
  };
}
