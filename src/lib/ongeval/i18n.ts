import type { OngevalStepId, SituationCategoryId } from "@/types/ongeval";

export type OngevalLang = "nl" | "fr" | "en";

/** Neem de taal van Partij B over wanneer we die rol zijn; anders standaard NL. */
export function resolveLang(
  role: "A" | "B" | null,
  partyBLanguage: OngevalLang | null,
): OngevalLang {
  if (role === "B" && partyBLanguage) return partyBLanguage;
  return "nl";
}

type Dict = Record<string, string>;
type LangDict = Record<OngevalLang, Dict>;

// Step titles — worden in de header getoond via WizardShell.
const STEP_TITLES: LangDict = {
  nl: {
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
  },
  fr: {
    incident_kind: "Que souhaitez-vous déclarer ?",
    safety_police: "Sécurité & police",
    police_pv: "Numéro PV",
    submission_mode: "Comment souhaitez-vous déclarer ?",
    scan_capture: "Scanner le formulaire papier",
    driver_select: "Conducteur",
    driver_employee_form: "Conducteur",
    driver_other_form: "Conducteur",
    policyholder_select: "Preneur d'assurance",
    policyholder_form: "Preneur d'assurance",
    insurer_select: "Assurance",
    vehicle_confirm: "Véhicule",
    parties_count: "Nombre de parties",
    devices_count: "Nombre d'appareils",
    role_select: "Choisissez votre rôle",
    share_qr: "Partager le QR-code",
    scan_qr: "Scanner le QR-code",
    party_b_language: "Langue partie B",
    party_b_optional: "Partie B",
    party_b_form: "Données partie B",
    location_time: "Lieu et heure",
    injuries_material: "Blessés et dégâts",
    witnesses: "Témoins",
    situation_main: "Circonstances",
    sit_rear_end: "Choc à l'arrière",
    sit_center_line: "Un véhicule franchit la ligne médiane",
    sit_priority: "Non-respect d'un signal de priorité",
    sit_maneuver_a: "Manœuvre partie A",
    sit_maneuver_b: "Manœuvre partie B",
    sit_lane_change: "Changement de file",
    sit_parking: "En stationnement",
    sit_door: "Ouverture de portière",
    sit_load: "Perte de chargement",
    circumstances_manual: "Remarques supplémentaires (optionnel)",
    vehicle_contact: "Point de choc",
    impact_party_a: "Point de choc véhicule A",
    impact_party_b: "Point de choc véhicule B",
    visible_damage_a: "Dégâts apparents véhicule A",
    visible_damage_b: "Dégâts apparents véhicule B",
    accident_sketch: "Croquis de l'accident",
    overview_intro: "Aperçu de la déclaration",
    overview_detail: "Aperçu",
    signature_a: "Signature A",
    signature_b: "Signature B",
    vehicle_mobility: "Mobilité",
    damage_type: "Type de dommage",
    damage_glass: "Bris de vitre",
    damage_theft_vandalism: "Vol / vandalisme",
    damage_single_vehicle: "Dommage unilatéral",
    franchise: "Franchise",
    escalation: "Escalade",
    complete: "Terminé",
  },
  en: {
    incident_kind: "What do you want to report?",
    safety_police: "Safety & police",
    police_pv: "Police report no.",
    submission_mode: "How do you want to file the report?",
    scan_capture: "Scan paper form",
    driver_select: "Driver",
    driver_employee_form: "Driver",
    driver_other_form: "Driver",
    policyholder_select: "Policyholder",
    policyholder_form: "Policyholder",
    insurer_select: "Insurance",
    vehicle_confirm: "Vehicle",
    parties_count: "Number of parties",
    devices_count: "Number of devices",
    role_select: "Choose your role",
    share_qr: "Share QR code",
    scan_qr: "Scan QR code",
    party_b_language: "Language party B",
    party_b_optional: "Party B",
    party_b_form: "Party B details",
    location_time: "Place and time",
    injuries_material: "Injuries and damage",
    witnesses: "Witnesses",
    situation_main: "Accident situations",
    sit_rear_end: "Rear-end collision",
    sit_center_line: "A vehicle crossed the centre line",
    sit_priority: "A party ignored a right-of-way sign",
    sit_maneuver_a: "Manoeuvre party A",
    sit_maneuver_b: "Manoeuvre party B",
    sit_lane_change: "Lane change",
    sit_parking: "Parked",
    sit_door: "Door opening",
    sit_load: "Loss of load",
    circumstances_manual: "Additional remarks (optional)",
    vehicle_contact: "Vehicle contact",
    impact_party_a: "Impact point vehicle A",
    impact_party_b: "Impact point vehicle B",
    visible_damage_a: "Visible damage vehicle A",
    visible_damage_b: "Visible damage vehicle B",
    accident_sketch: "Accident sketch",
    overview_intro: "Report overview",
    overview_detail: "Overview",
    signature_a: "Signature A",
    signature_b: "Signature B",
    vehicle_mobility: "Mobility",
    damage_type: "Damage type",
    damage_glass: "Glass damage",
    damage_theft_vandalism: "Theft / vandalism",
    damage_single_vehicle: "Single-vehicle damage",
    franchise: "Deductible",
    escalation: "Escalation",
    complete: "Finished",
  },
};

// Category labels (worden overal gebruikt: overview + situation grid).
const CATEGORY_LABELS: LangDict = {
  nl: {
    parking: "Parkeerstand",
    rear_end: "Aanrijding achteraan",
    maneuver: "Manoeuvre",
    priority: "Weigering van voorrang",
    lane_change: "Verandering van file",
    opposite: "Tegengestelde richtingen",
    door: "Openen portier",
    load: "Verlies van lading",
  },
  fr: {
    parking: "En stationnement",
    rear_end: "Choc à l'arrière",
    maneuver: "Manœuvre",
    priority: "Refus de priorité",
    lane_change: "Changement de file",
    opposite: "Sens opposés",
    door: "Ouverture de portière",
    load: "Perte de chargement",
  },
  en: {
    parking: "Parked",
    rear_end: "Rear-end collision",
    maneuver: "Manoeuvre",
    priority: "Failure to yield",
    lane_change: "Lane change",
    opposite: "Opposite directions",
    door: "Door opening",
    load: "Loss of load",
  },
};

const CATEGORY_DESCRIPTIONS: LangDict = {
  nl: {
    parking: "Botsing met een geparkeerd voertuig.",
    rear_end: "Op een voertuig voor u.",
    maneuver: "Door een manoeuvre van één of beide partijen (achteruit, …).",
    priority: "Bij het niet verlenen van voorrang op kruispunt of rotonde.",
    lane_change: "Door rijstrook- of filewissel, ook op rotonde.",
    opposite: "Tegenliggers waarbij één of beide de middenlijn overschrijden.",
    door: "Door open deur, achterklep of laadplatform.",
    load: "Door verlies van lading of deel van het voertuig.",
  },
  fr: {
    parking: "Collision avec un véhicule en stationnement.",
    rear_end: "Dans un véhicule qui vous précède.",
    maneuver:
      "Suite à une manœuvre d'une ou des deux parties (marche arrière, …).",
    priority:
      "En ne cédant pas la priorité à un carrefour ou un rond-point.",
    lane_change:
      "Lors d'un changement de file, également sur un rond-point.",
    opposite:
      "Véhicules en sens opposés dont un ou les deux franchit la ligne médiane.",
    door: "Par ouverture de portière, hayon ou plateau.",
    load: "Par perte d'un chargement ou d'une partie du véhicule.",
  },
  en: {
    parking: "Collision with a parked vehicle.",
    rear_end: "Into a vehicle ahead of you.",
    maneuver:
      "Caused by a manoeuvre of one or both parties (reversing, …).",
    priority:
      "When failing to yield at an intersection or roundabout.",
    lane_change:
      "While changing lanes, also on roundabouts.",
    opposite:
      "Oncoming vehicles where one or both crossed the centre line.",
    door: "Via an open door, boot or load platform.",
    load: "Through loss of cargo or part of the vehicle.",
  },
};

/** Situatie-detailopties: dezelfde key maar per taal een label. */
const DETAIL_LABELS: LangDict = {
  nl: {
    a_rear: "Voertuig A is achteraan aangereden",
    b_rear: "Voertuig B is achteraan aangereden",
    a_crossed: "Voertuig A heeft de middenlijn overschreden",
    b_crossed: "Voertuig B heeft de middenlijn overschreden",
    both_crossed: "Beide voertuigen hebben de middenlijn overschreden",
    a_yield_x: "Voertuig A: omgekeerde driehoek op kruispunt niet nageleefd",
    b_yield_x: "Voertuig B: omgekeerde driehoek op kruispunt niet nageleefd",
    a_stop_x: "Voertuig A: stopteken op kruispunt niet nageleefd",
    b_stop_x: "Voertuig B: stopteken op kruispunt niet nageleefd",
    a_yield_round: "Voertuig A: omgekeerde driehoek op rotonde niet nageleefd",
    b_yield_round: "Voertuig B: omgekeerde driehoek op rotonde niet nageleefd",
    a_rev: "Voertuig A rijdt achteruit",
    a_leave_park: "Voertuig A verliet een parkeerplaats",
    a_leave_private: "Voertuig A verliet een private weg",
    a_turn_back: "Voertuig A draaide terug",
    b_rev: "Voertuig B rijdt achteruit",
    b_leave_park: "Voertuig B verliet een parkeerplaats",
    b_leave_private: "Voertuig B verliet een private weg",
    b_turn: "Voertuig B draaide om",
    a_lane: "Voertuig A wisselde van rijstrook of file",
    b_lane: "Voertuig B wisselde van rijstrook of file",
    both_lane: "Beide voertuigen wisselden gelijktijdig",
    park_moving: "Botsing met stilstaand voertuig",
    park_opening: "Botsing bij het wegrijden van een parkeerplaats",
    door_a: "Portier van voertuig A werd geopend",
    door_b: "Portier van voertuig B werd geopend",
    load_a: "Lading van voertuig A",
    load_b: "Lading van voertuig B",
  },
  fr: {
    a_rear: "Véhicule A heurté à l'arrière",
    b_rear: "Véhicule B heurté à l'arrière",
    a_crossed: "Véhicule A a franchi la ligne médiane",
    b_crossed: "Véhicule B a franchi la ligne médiane",
    both_crossed: "Les deux véhicules ont franchi la ligne médiane",
    a_yield_x: "Véhicule A : triangle inversé non respecté au carrefour",
    b_yield_x: "Véhicule B : triangle inversé non respecté au carrefour",
    a_stop_x: "Véhicule A : stop non respecté au carrefour",
    b_stop_x: "Véhicule B : stop non respecté au carrefour",
    a_yield_round: "Véhicule A : triangle inversé non respecté sur rond-point",
    b_yield_round: "Véhicule B : triangle inversé non respecté sur rond-point",
    a_rev: "Véhicule A reculait",
    a_leave_park: "Véhicule A sortait d'un emplacement de stationnement",
    a_leave_private: "Véhicule A sortait d'une voie privée",
    a_turn_back: "Véhicule A faisait demi-tour",
    b_rev: "Véhicule B reculait",
    b_leave_park: "Véhicule B sortait d'un emplacement de stationnement",
    b_leave_private: "Véhicule B sortait d'une voie privée",
    b_turn: "Véhicule B faisait demi-tour",
    a_lane: "Véhicule A a changé de file",
    b_lane: "Véhicule B a changé de file",
    both_lane: "Les deux véhicules ont changé de file simultanément",
    park_moving: "Collision avec un véhicule à l'arrêt",
    park_opening: "Collision en quittant un emplacement de stationnement",
    door_a: "La portière du véhicule A a été ouverte",
    door_b: "La portière du véhicule B a été ouverte",
    load_a: "Chargement du véhicule A",
    load_b: "Chargement du véhicule B",
  },
  en: {
    a_rear: "Vehicle A was hit from behind",
    b_rear: "Vehicle B was hit from behind",
    a_crossed: "Vehicle A crossed the centre line",
    b_crossed: "Vehicle B crossed the centre line",
    both_crossed: "Both vehicles crossed the centre line",
    a_yield_x: "Vehicle A: inverted triangle at intersection ignored",
    b_yield_x: "Vehicle B: inverted triangle at intersection ignored",
    a_stop_x: "Vehicle A: stop sign at intersection ignored",
    b_stop_x: "Vehicle B: stop sign at intersection ignored",
    a_yield_round: "Vehicle A: inverted triangle at roundabout ignored",
    b_yield_round: "Vehicle B: inverted triangle at roundabout ignored",
    a_rev: "Vehicle A was reversing",
    a_leave_park: "Vehicle A was leaving a parking space",
    a_leave_private: "Vehicle A was leaving a private road",
    a_turn_back: "Vehicle A was making a U-turn",
    b_rev: "Vehicle B was reversing",
    b_leave_park: "Vehicle B was leaving a parking space",
    b_leave_private: "Vehicle B was leaving a private road",
    b_turn: "Vehicle B was making a U-turn",
    a_lane: "Vehicle A changed lane or line",
    b_lane: "Vehicle B changed lane or line",
    both_lane: "Both vehicles changed lanes simultaneously",
    park_moving: "Collision with a stationary vehicle",
    park_opening: "Collision while leaving a parking spot",
    door_a: "Door of vehicle A was opened",
    door_b: "Door of vehicle B was opened",
    load_a: "Load of vehicle A",
    load_b: "Load of vehicle B",
  },
};

// Alle UI-strings die partij B in zijn flow te zien krijgt. Keys zijn
// grofweg "scherm.veld". Gebruik `t(lang, "key")`.
const UI_STRINGS: LangDict = {
  nl: {
    // Common
    "common.next": "Volgende",
    "common.back": "Terug",
    "common.ok": "OK",
    "common.confirm": "Bevestigen",
    "common.yes": "Ja",
    "common.no": "Nee",
    "common.not_filled": "Niet ingevuld",
    "common.not_specified": "Niet opgegeven",
    "common.saving": "Bezig met opslaan…",
    "common.dash": "—",

    // Footer banner
    "banner.signature":
      "Na ondertekening wordt de aangifte automatisch overgemaakt aan je verzekeraar.",
    "banner.vehicle_contact":
      "Indien er contact geweest is tussen de voertuigen dan zal elke partij het raakpunt op zijn voertuig moeten aanduiden.",
    "banner.circumstances_manual":
      "Optioneel — laat leeg als je niets wil toevoegen aan sectie 14 van het formulier.",

    // party_b_form
    "party_b_form.intro":
      "Vul enkel de gegevens in die je zeker weet. Je kunt dit later nog aanvullen in het overzicht.",
    "party_b_form.section.policyholder": "Verzekeringsnemer / verzekerde (partij B)",
    "party_b_form.section.insurance": "Verzekering (partij B)",
    "party_b_form.section.vehicle": "Voertuig (partij B)",
    "party_b_form.section.driver": "Bestuurder (partij B)",
    "field.firstname": "Voornaam",
    "field.lastname": "Naam",
    "field.street": "Straat",
    "field.housenumber": "Huisnr.",
    "field.box": "Bus",
    "field.postcode": "Postcode",
    "field.city": "Stad",
    "field.country": "Land",
    "field.insurance_company": "Verzekeringsmaatschappij",
    "field.policy_number": "Polisnummer",
    "field.make_model": "Merk & model",
    "field.plate": "Nummerplaat",
    "field.registration_country": "Land van inschrijving",
    "field.birthdate": "Geboortedatum",
    "field.license_number": "Rijbewijsnummer",
    "field.license_category": "Categorie",
    "field.license_valid_to": "Geldig tot",
    "field.date": "Datum",
    "field.time": "Uur",

    "insurance.extra_toggle": "Extra verzekeringsdetails",
    "insurance.green_card": "Nr. groene kaart",
    "insurance.valid_from": "Geldig vanaf",
    "insurance.valid_to": "Geldig tot",
    "insurance.agency": "Agentschap / makelaar",

    "vehicle.trailer_toggle": "Aanhangwagen aangekoppeld?",
    "vehicle.trailer_help":
      "Vul enkel in als er een aanhanger aan het voertuig hing op het moment van het ongeval.",
    "vehicle.trailer_plate": "Nummerplaat aanhanger",
    "vehicle.trailer_country": "Land inschrijving",

    "visible_damage.intro_a":
      "Beschrijf kort de zichtbare schade aan voertuig A (sectie 11 van het formulier).",
    "visible_damage.intro_b":
      "Beschrijf kort de zichtbare schade aan voertuig B (sectie 11 van het formulier).",
    "visible_damage.label_a": "Zichtbare schade voertuig A",
    "visible_damage.label_b": "Zichtbare schade voertuig B",
    "visible_damage.placeholder":
      "Bv. deuk voorportier rechts, gebroken koplamp, …",
    "visible_damage.optional_hint":
      "Optioneel — laat leeg als er niets te melden is. Het raakpunt staat al op de tekening hiervoor.",

    "sketch.intro":
      "Maak hier een schets van het ongeval (positie van de voertuigen, rijrichting, verkeersborden, …). Komt op het sjabloon én bij de samenvatting.",
    "sketch.optional_hint":
      "Optioneel — sla over als je geen tekening wenst toe te voegen.",

    // location_time
    "location.picker.use_current": "Gebruik huidige locatie",
    "location.picker.locating": "Locatie bepalen…",
    "location.picker.search_placeholder": "Zoek adres (straat, stad, …)",
    "location.picker.searching": "Zoeken…",
    "location.picker.permission_denied": "Toegang tot locatie geweigerd.",
    "location.picker.unavailable": "Geolocatie niet beschikbaar in deze browser.",
    "location.picker.insecure": "Locatie werkt enkel via https (of localhost).",
    "location.picker.rate_limited": "Te veel verzoeken. Probeer zo meteen opnieuw.",
    "location.picker.no_address": "Kon geen adres vinden voor deze locatie. Vul handmatig in.",
    "location.picker.geocode_failed": "Adres ophalen mislukt. Vul handmatig in.",
    "location.picker.locate_failed": "Locatie bepalen mislukt.",

    // location_time approval
    "location.approval.a.intro":
      "Vul plaats en tijd van het ongeval in. Partij B moet deze gegevens daarna goedkeuren voor je verder kunt.",
    "location.approval.a.send": "Sturen ter goedkeuring aan partij B",
    "location.approval.a.send_disabled": "Vul eerst alle velden in.",
    "location.approval.a.pending_title": "Wachten op goedkeuring partij B",
    "location.approval.a.pending_body":
      "Partij B kijkt nu plaats en tijd na. Zodra B akkoord gaat, kun je verder.",
    "location.approval.a.approved_title": "Goedgekeurd door partij B",
    "location.approval.a.approved_body":
      "Plaats en tijd zijn bevestigd. Je kunt verder met de volgende stap.",
    "location.approval.a.rejected_title": "Partij B is niet akkoord",
    "location.approval.a.rejected_body": "Pas de gegevens aan en stuur opnieuw.",
    "location.approval.a.rejected_note": "Opmerking van partij B:",
    "location.approval.a.retract": "Aanpassen",
    "location.approval.a.retract_confirm":
      "Plaats en tijd opnieuw kunnen aanpassen? De goedkeuring vervalt en partij B moet opnieuw bevestigen.",
    "location.approval.b.title": "Bevestig plaats en tijd",
    "location.approval.b.intro":
      "Partij A heeft plaats en tijd ingevuld. Bekijk de gegevens en geef aan of ze kloppen.",
    "location.approval.b.waiting":
      "Partij A vult plaats en tijd nog in. Je krijgt hier een bericht zodra A klaar is.",
    "location.approval.b.approve": "Akkoord",
    "location.approval.b.reject": "Niet akkoord",
    "location.approval.b.note_label": "Opmerking voor partij A (optioneel)",
    "location.approval.b.note_placeholder": "Bijv. 'datum klopt niet, was 16 april'",
    "location.approval.b.send_rejection": "Stuur weigering",
    "location.approval.b.cancel": "Annuleren",
    "location.approval.b.approved_title": "Bedankt, je akkoord is genoteerd",
    "location.approval.b.approved_body":
      "Partij A kan nu verder met de aangifte.",
    "location.approval.b.rejected_title": "Je weigering is verstuurd",
    "location.approval.b.rejected_body":
      "Partij A past de gegevens aan en zal opnieuw vragen om bevestiging.",

    // injuries_material
    "injuries.question": "Waren er gewonden bij het ongeval?",
    "material.question": "Was er andere materiële schade dan aan de voertuigen?",

    // witnesses
    "witnesses.placeholder":
      "Naam, adres en telefoonnummer van getuigen (indien van toepassing).",
    "witnesses.help":
      "Indien er geen getuigen zijn kun je dit veld leeg laten.",
    "witnesses.question": "Waren er getuigen ter plaatse?",
    "witnesses.entry_label": "Getuige",
    "witnesses.add": "Nog een getuige toevoegen",
    "witnesses.remove": "Getuige verwijderen",
    "witnesses.field_phone": "Telefoonnummer (optioneel)",
    "witnesses.none_note":
      "Geen getuigen — je kan verdergaan naar de volgende stap.",

    "situation.multi_hint":
      "Meerdere antwoorden mogelijk — vink alles aan wat van toepassing is.",

    // situation_main
    "situation.help_choose": "Kies de situatie die best past.",

    // proposal
    "proposal.question": "Ga je akkoord met dit voorstel?",
    "proposal.accept": "Ja, akkoord",
    "proposal.reject": "Nee, ik wil aanpassen",
    "proposal.section_title": "Voorstel op basis van jouw antwoorden",
    "circumstances.label": "Toedracht (aanvulling)",
    "circumstances.placeholder":
      "Beschrijf wat er precies gebeurd is. Dit komt in vak 14 van de aangifte.",

    // vehicle_contact
    "vehicle_contact.question":
      "Was er contact tussen de voertuigen?",

    // impact
    "impact.a.label": "Duid het raakpunt op voertuig A aan.",
    "impact.b.label": "Duid het raakpunt op voertuig B aan.",
    "impact.hint":
      "Tik of sleep om het raakpunt aan te duiden. De rode pijl wijst naar de eerste contactzone.",

    // overview
    "overview.intro":
      "Dit is de laatste stap bij het opmaken van de ongevalsaangifte. Gelieve alle ingevoerde gegevens na te kijken. Je kunt dit ook overslaan.",
    "overview.skip": "Sla het overzicht over",
    "overview.tab.location": "Locatie",
    "overview.tab.questions": "Vragen",
    "overview.tab.impact": "Raakpunt",
    "overview.tab.witnesses": "Getuigen",
    "overview.tab.data": "Gegevens",
    "overview.section.place": "Plaats van het ongeval",
    "overview.section.time": "Tijdstip",
    "overview.section.damage": "Schade & letsels",
    "overview.section.accident_type": "Type ongeval",
    "overview.section.proposal": "Minnelijk voorstel",
    "overview.section.vehicle_contact": "Contact tussen voertuigen",
    "overview.section.impact_a": "Raakpunt voertuig A",
    "overview.section.impact_b": "Raakpunt voertuig B",
    "overview.section.witnesses": "Getuigen",
    "overview.section.driver_a": "Bestuurder A",
    "overview.section.driver_b": "Bestuurder B",
    "overview.section.vehicle_a": "Voertuig A",
    "overview.section.vehicle_b": "Voertuig B",
    "overview.section.insurance_a": "Verzekering A",
    "overview.section.insurance_b": "Verzekering B",
    "overview.section.holder_a": "Verzekeringsnemer A",
    "overview.section.holder_b": "Verzekeringsnemer B",
    "overview.empty.witnesses": "Geen getuigen opgegeven.",
    "overview.witnesses.none": "Geen getuigen ter plaatse.",
    "overview.empty.impact": "Geen raakpunt aangeduid.",
    "overview.empty.category": "Nog niet gekozen",
    "overview.empty.detail": "Geen detail",
    "overview.empty.maneuver_a": "Geen manoeuvre A",
    "overview.empty.maneuver_b": "Geen manoeuvre B",
    "overview.empty.proposal": "Niet beslist",
    "overview.empty.proposal_notes": "Geen toelichting",
    "overview.row.category": "Categorie",
    "overview.row.detail": "Detail",
    "overview.row.maneuver_a": "Manoeuvre A",
    "overview.row.maneuver_b": "Manoeuvre B",
    "overview.row.proposal_accepted": "Voorstel aanvaard",
    "overview.row.circumstances": "Omstandigheden",
    "overview.row.contact": "Was er contact",
    "overview.row.injuries": "Gewonden",
    "overview.row.other_damage": "Andere materiële schade",
    "overview.row.address": "Adres",
    "overview.row.phone": "Telefoon",
    "overview.row.email": "E-mail",
    "overview.row.enterprise": "Ondernemingsnr.",
    "overview.row.license": "Rijbewijs",
    "overview.row.company": "Maatschappij",
    "overview.row.policy": "Polisnummer",

    // signature
    "signature.b.prompt":
      "Teken hieronder de handtekening van bestuurder B. Gebruik vinger of stylus.",
    "signature.clear_aria": "Wissen",

    // complete
    "complete.title": "Aangifte voltooid",
    "complete.subtitle":
      "Controleer het ingevulde Europees aanrijdingsformulier hieronder.",
    "complete.loading": "PDF laden…",
    "complete.error_title": "PDF laden mislukt",
    "complete.retry": "Opnieuw proberen",
    "complete.download": "Download PDF",
    "complete.close": "Sluiten",

    "send.title": "Verzenden naar fleetmanager",
    "send.intro":
      "Verstuur de aangifte als PDF-bijlage naar het centrale e-mailadres van het bedrijf. Je krijgt zelf een kopie via CC.",
    "send.button": "Verstuur naar fleetmanager",
    "send.button_retry": "Opnieuw versturen",
    "send.sending": "Aangifte wordt verzonden naar de fleetmanager…",
    "send.success_title": "Verstuurd naar de fleetmanager",
    "send.success_to": "Verzonden naar:",
    "send.success_cc": "Kopie (CC):",
    "send.success_simulated":
      "Test-modus: e-mail werd niet daadwerkelijk verstuurd (RESEND_API_KEY ontbreekt).",
    "send.failure_title": "Automatisch verzenden mislukt",
    "send.error.no_recipient":
      "Er is nog geen centraal e-mailadres ingesteld voor jouw bedrijf. Vraag de beheerder om dit toe te voegen in de bedrijfsinstellingen.",
    "send.error.incomplete":
      "De aangifte mist nog een handtekening. Vul eerst alle stappen in.",
    "send.error.forbidden": "Enkel partij A kan de aangifte verzenden.",
    "send.error.generic": "Er ging iets mis. Probeer opnieuw.",
    "send.retry_hint":
      "Je kan dit later ook opnieuw proberen vanuit ‘Mijn incidenten’.",
    "send.b.waiting":
      "Partij A verstuurt de aangifte naar de fleetmanager. Je krijgt geen kopie via dit toestel.",

    "submission_mode.intro":
      "Je kan de aangifte stap-voor-stap invullen via de wizard, óf het papieren Europees aanrijdingsformulier scannen en doorsturen.",
    "submission_mode.wizard_title": "Volg de wizard",
    "submission_mode.wizard_desc":
      "Stap voor stap invullen. Handig als je geen papieren formulier hebt.",
    "submission_mode.scan_title": "Papieren formulier scannen",
    "submission_mode.scan_desc":
      "Fotografeer het formulier en verstuur de PDF naar je fleetmanager.",

    "scan.pages_title": "Pagina's van het formulier",
    "scan.pages_help":
      "Maak een duidelijke foto van élke pagina (recto + verso indien ingevuld). Vermijd schaduw en zorg dat de tekst leesbaar is.",
    "scan.button_camera": "Foto maken",
    "scan.button_gallery": "Uit galerij",
    "scan.empty":
      "Nog geen pagina's. Voeg minstens één foto toe om verder te kunnen.",
    "scan.page_label": "Pagina",
    "scan.remove_page": "Pagina verwijderen",
    "scan.metadata_title": "Basisgegevens",
    "scan.metadata_help":
      "Deze info gebruiken we voor het onderwerp van de mail naar je fleetmanager.",
    "scan.field_datum": "Datum van het ongeval",
    "scan.field_stad": "Plaats (stad)",
    "scan.field_nummerplaat": "Jouw nummerplaat",
    "scan.field_notitie": "Notitie voor de fleetmanager (optioneel)",
    "scan.field_notitie_placeholder": "Bv. politie ter plaatse, getuigen, …",
    "scan.upload": "Upload en ga door",
    "scan.reupload": "Pagina's vervangen en opnieuw uploaden",
    "scan.uploading": "Uploaden…",
    "scan.upload_success": "Scan opgeslagen.",
    "scan.already_uploaded":
      "De scan is opgeslagen. Voeg pagina's toe om opnieuw te uploaden.",
    "scan.complete_title": "Klaar om te verzenden",
    "scan.complete_subtitle":
      "Hieronder zie je de gegenereerde PDF. Verzend naar je fleetmanager.",
    "scan.preview_error":
      "Voorbeeld kon niet geladen worden. Probeer opnieuw.",
    "scan.error.no_pages": "Voeg eerst minstens één pagina toe.",
    "scan.error.too_many":
      "Maximum bereikt. Verwijder eerst een pagina om er nog toe te voegen.",
    "scan.error.bad_type": "Enkel JPG of PNG zijn toegestaan.",
    "scan.error.too_large":
      "Foto te groot (max 12 MB). Maak een kleinere foto.",
    "scan.error.upload_failed":
      "Upload mislukt. Controleer je internetverbinding en probeer opnieuw.",
    "common.retry": "Opnieuw",
  },
  fr: {
    "common.next": "Suivant",
    "common.back": "Retour",
    "common.ok": "OK",
    "common.confirm": "Confirmer",
    "common.yes": "Oui",
    "common.no": "Non",
    "common.not_filled": "Non renseigné",
    "common.not_specified": "Non précisé",
    "common.saving": "Enregistrement…",
    "common.dash": "—",

    "banner.signature":
      "Après signature, la déclaration est transmise automatiquement à votre assureur.",
    "banner.vehicle_contact":
      "En cas de contact entre les véhicules, chaque partie devra indiquer le point de choc sur son véhicule.",
    "banner.circumstances_manual":
      "Optionnel — laissez vide si vous ne souhaitez rien ajouter à la rubrique 14 du formulaire.",

    "party_b_form.intro":
      "Remplissez uniquement les données que vous connaissez avec certitude. Vous pourrez compléter le reste depuis l'aperçu.",
    "party_b_form.section.policyholder": "Preneur d'assurance / assuré (partie B)",
    "party_b_form.section.insurance": "Assurance (partie B)",
    "party_b_form.section.vehicle": "Véhicule (partie B)",
    "party_b_form.section.driver": "Conducteur (partie B)",
    "field.firstname": "Prénom",
    "field.lastname": "Nom",
    "field.street": "Rue",
    "field.housenumber": "N°",
    "field.box": "Bte",
    "field.postcode": "Code postal",
    "field.city": "Ville",
    "field.country": "Pays",
    "field.insurance_company": "Compagnie d'assurance",
    "field.policy_number": "N° de police",
    "field.make_model": "Marque & modèle",
    "field.plate": "Plaque d'immatriculation",
    "field.registration_country": "Pays d'immatriculation",
    "field.birthdate": "Date de naissance",
    "field.license_number": "N° de permis",
    "field.license_category": "Catégorie",
    "field.license_valid_to": "Valable jusqu'au",
    "field.date": "Date",
    "field.time": "Heure",

    "insurance.extra_toggle": "Détails d'assurance supplémentaires",
    "insurance.green_card": "N° de carte verte",
    "insurance.valid_from": "Valable à partir du",
    "insurance.valid_to": "Valable jusqu'au",
    "insurance.agency": "Agence / courtier",

    "vehicle.trailer_toggle": "Remorque attelée ?",
    "vehicle.trailer_help":
      "À ne remplir que si une remorque était attelée au véhicule au moment de l'accident.",
    "vehicle.trailer_plate": "Plaque de la remorque",
    "vehicle.trailer_country": "Pays d'immatriculation",

    "visible_damage.intro_a":
      "Décrivez brièvement les dégâts apparents au véhicule A (rubrique 11 du formulaire).",
    "visible_damage.intro_b":
      "Décrivez brièvement les dégâts apparents au véhicule B (rubrique 11 du formulaire).",
    "visible_damage.label_a": "Dégâts apparents véhicule A",
    "visible_damage.label_b": "Dégâts apparents véhicule B",
    "visible_damage.placeholder":
      "Ex. enfoncement portière avant droite, phare cassé, …",
    "visible_damage.optional_hint":
      "Optionnel — laissez vide si rien à signaler. Le point de choc figure déjà sur le schéma.",

    "sketch.intro":
      "Dessinez ici un croquis de l'accident (position des véhicules, sens de marche, panneaux, …). Reprise sur le formulaire et dans le récapitulatif.",
    "sketch.optional_hint":
      "Optionnel — passez l'étape si vous ne souhaitez pas ajouter de croquis.",

    "location.picker.use_current": "Utiliser ma position",
    "location.picker.locating": "Localisation…",
    "location.picker.search_placeholder": "Rechercher une adresse (rue, ville, …)",
    "location.picker.searching": "Recherche…",
    "location.picker.permission_denied": "Accès à la position refusé.",
    "location.picker.unavailable": "Géolocalisation indisponible dans ce navigateur.",
    "location.picker.insecure": "La position ne fonctionne qu’en https (ou localhost).",
    "location.picker.rate_limited": "Trop de requêtes. Réessaie dans un instant.",
    "location.picker.no_address":
      "Adresse introuvable pour cette position. Complète manuellement.",
    "location.picker.geocode_failed":
      "Impossible de récupérer l'adresse. Veuillez la saisir manuellement.",
    "location.picker.locate_failed": "Impossible de déterminer la position.",

    "location.approval.a.intro":
      "Saisissez le lieu et l'heure de l'accident. La partie B devra les confirmer avant que vous puissiez continuer.",
    "location.approval.a.send": "Envoyer pour validation à la partie B",
    "location.approval.a.send_disabled": "Remplissez d'abord tous les champs.",
    "location.approval.a.pending_title": "En attente de la confirmation de la partie B",
    "location.approval.a.pending_body":
      "La partie B vérifie le lieu et l'heure. Dès qu'elle valide, vous pourrez continuer.",
    "location.approval.a.approved_title": "Validé par la partie B",
    "location.approval.a.approved_body":
      "Le lieu et l'heure sont confirmés. Vous pouvez passer à l'étape suivante.",
    "location.approval.a.rejected_title": "La partie B n'est pas d'accord",
    "location.approval.a.rejected_body": "Modifiez les données et renvoyez.",
    "location.approval.a.rejected_note": "Remarque de la partie B :",
    "location.approval.a.retract": "Modifier",
    "location.approval.a.retract_confirm":
      "Modifier à nouveau le lieu et l'heure ? La validation sera annulée et la partie B devra reconfirmer.",
    "location.approval.b.title": "Confirmez le lieu et l'heure",
    "location.approval.b.intro":
      "La partie A a saisi le lieu et l'heure. Vérifiez les informations et indiquez si elles sont correctes.",
    "location.approval.b.waiting":
      "La partie A est en train de saisir le lieu et l'heure. Vous serez prévenu dès qu'elle aura terminé.",
    "location.approval.b.approve": "D'accord",
    "location.approval.b.reject": "Pas d'accord",
    "location.approval.b.note_label": "Remarque pour la partie A (facultatif)",
    "location.approval.b.note_placeholder": "Ex. « la date n'est pas correcte, c'était le 16 avril »",
    "location.approval.b.send_rejection": "Envoyer le refus",
    "location.approval.b.cancel": "Annuler",
    "location.approval.b.approved_title": "Merci, votre accord est enregistré",
    "location.approval.b.approved_body":
      "La partie A peut continuer la déclaration.",
    "location.approval.b.rejected_title": "Votre refus a été envoyé",
    "location.approval.b.rejected_body":
      "La partie A va modifier les données et demandera à nouveau confirmation.",

    "injuries.question": "Y a-t-il eu des blessés dans l'accident ?",
    "material.question":
      "Y a-t-il eu d'autres dégâts matériels qu'aux véhicules ?",

    "witnesses.placeholder":
      "Nom, adresse et téléphone des témoins (le cas échéant).",
    "witnesses.help":
      "En l'absence de témoin, vous pouvez laisser ce champ vide.",
    "witnesses.question": "Y avait-il des témoins sur place ?",
    "witnesses.entry_label": "Témoin",
    "witnesses.add": "Ajouter un témoin",
    "witnesses.remove": "Supprimer le témoin",
    "witnesses.field_phone": "Téléphone (optionnel)",
    "witnesses.none_note":
      "Aucun témoin — vous pouvez passer à l'étape suivante.",

    "situation.multi_hint":
      "Plusieurs réponses possibles — cochez tout ce qui s'applique.",
    "situation.help_choose": "Choisissez la situation qui correspond le mieux.",

    "proposal.question": "Êtes-vous d'accord avec cette proposition ?",
    "proposal.accept": "Oui, d'accord",
    "proposal.reject": "Non, je veux modifier",
    "proposal.section_title": "Proposition selon vos réponses",
    "circumstances.label": "Circonstances (ajout)",
    "circumstances.placeholder":
      "Décrivez ce qui s'est exactement passé. Ce texte sera repris dans la rubrique 14 du constat.",

    "vehicle_contact.question":
      "Y a-t-il eu contact entre les véhicules ?",

    "impact.a.label": "Indiquez le point de choc sur le véhicule A.",
    "impact.b.label": "Indiquez le point de choc sur le véhicule B.",
    "impact.hint":
      "Touchez ou glissez pour indiquer le point de choc. La flèche rouge pointe vers la première zone de contact.",

    "overview.intro":
      "Voici la dernière étape de la déclaration. Vérifiez toutes les données saisies. Vous pouvez aussi passer cette étape.",
    "overview.skip": "Passer l'aperçu",
    "overview.tab.location": "Lieu",
    "overview.tab.questions": "Questions",
    "overview.tab.impact": "Point de choc",
    "overview.tab.witnesses": "Témoins",
    "overview.tab.data": "Données",
    "overview.section.place": "Lieu de l'accident",
    "overview.section.time": "Date et heure",
    "overview.section.damage": "Dégâts & blessés",
    "overview.section.accident_type": "Type d'accident",
    "overview.section.proposal": "Proposition amiable",
    "overview.section.vehicle_contact": "Contact entre véhicules",
    "overview.section.impact_a": "Point de choc véhicule A",
    "overview.section.impact_b": "Point de choc véhicule B",
    "overview.section.witnesses": "Témoins",
    "overview.section.driver_a": "Conducteur A",
    "overview.section.driver_b": "Conducteur B",
    "overview.section.vehicle_a": "Véhicule A",
    "overview.section.vehicle_b": "Véhicule B",
    "overview.section.insurance_a": "Assurance A",
    "overview.section.insurance_b": "Assurance B",
    "overview.section.holder_a": "Preneur d'assurance A",
    "overview.section.holder_b": "Preneur d'assurance B",
    "overview.empty.witnesses": "Aucun témoin renseigné.",
    "overview.witnesses.none": "Aucun témoin sur place.",
    "overview.empty.impact": "Aucun point de choc indiqué.",
    "overview.empty.category": "Non choisi",
    "overview.empty.detail": "Aucun détail",
    "overview.empty.maneuver_a": "Aucune manœuvre A",
    "overview.empty.maneuver_b": "Aucune manœuvre B",
    "overview.empty.proposal": "Non décidé",
    "overview.empty.proposal_notes": "Aucune explication",
    "overview.row.category": "Catégorie",
    "overview.row.detail": "Détail",
    "overview.row.maneuver_a": "Manœuvre A",
    "overview.row.maneuver_b": "Manœuvre B",
    "overview.row.proposal_accepted": "Proposition acceptée",
    "overview.row.circumstances": "Circonstances",
    "overview.row.contact": "Contact",
    "overview.row.injuries": "Blessés",
    "overview.row.other_damage": "Autres dégâts matériels",
    "overview.row.address": "Adresse",
    "overview.row.phone": "Téléphone",
    "overview.row.email": "E-mail",
    "overview.row.enterprise": "N° d'entreprise",
    "overview.row.license": "Permis",
    "overview.row.company": "Compagnie",
    "overview.row.policy": "N° de police",

    "signature.b.prompt":
      "Signez ci-dessous au nom du conducteur B. Utilisez votre doigt ou un stylet.",
    "signature.clear_aria": "Effacer",

    "complete.title": "Déclaration terminée",
    "complete.subtitle":
      "Vérifiez le constat européen d'accident rempli ci-dessous.",
    "complete.loading": "Chargement du PDF…",
    "complete.error_title": "Échec du chargement du PDF",
    "complete.retry": "Réessayer",
    "complete.download": "Télécharger le PDF",
    "complete.close": "Fermer",

    "send.title": "Envoyer au fleet manager",
    "send.intro":
      "Envoyez la déclaration en PIèce jointe PDF à l'adresse centrale de gestion des sinistres. Vous recevrez vous-même une copie en CC.",
    "send.button": "Envoyer au fleet manager",
    "send.button_retry": "Renvoyer",
    "send.sending": "La déclaration est en cours d'envoi au fleet manager…",
    "send.success_title": "Envoyée au fleet manager",
    "send.success_to": "Envoyé à :",
    "send.success_cc": "Copie (CC) :",
    "send.success_simulated":
      "Mode test : l'e-mail n'a pas été réellement envoyé (RESEND_API_KEY manquant).",
    "send.failure_title": "Échec de l'envoi automatique",
    "send.error.no_recipient":
      "Aucune adresse centrale de gestion des sinistres n'est configurée pour votre entreprise. Demandez à l'administrateur de l'ajouter dans les paramètres.",
    "send.error.incomplete":
      "La déclaration n'a pas encore été signée. Complétez d'abord toutes les étapes.",
    "send.error.forbidden": "Seule la partie A peut envoyer la déclaration.",
    "send.error.generic": "Une erreur s'est produite. Réessayez.",
    "send.retry_hint":
      "Vous pourrez aussi réessayer plus tard depuis « Mes incidents ».",
    "send.b.waiting":
      "La partie A envoie la déclaration au fleet manager. Vous ne recevrez pas de copie sur cet appareil.",

    "submission_mode.intro":
      "Vous pouvez remplir la déclaration étape par étape via le wizard, ou scanner le constat amiable papier et l'envoyer directement.",
    "submission_mode.wizard_title": "Suivre le wizard",
    "submission_mode.wizard_desc":
      "Nous vous guidons étape par étape. Recommandé si vous n'avez rien sur papier.",
    "submission_mode.scan_title": "Scanner le formulaire papier",
    "submission_mode.scan_desc":
      "Photographiez le constat papier rempli et envoyez le PDF directement à votre fleet manager.",

    "scan.pages_title": "Pages du formulaire",
    "scan.pages_help":
      "Prenez une photo nette de chaque page (recto + verso si rempli). Évitez les ombres et veillez à la lisibilité.",
    "scan.button_camera": "Prendre une photo",
    "scan.button_gallery": "Depuis la galerie",
    "scan.empty":
      "Aucune page pour l'instant. Ajoutez au moins une photo pour continuer.",
    "scan.page_label": "Page",
    "scan.remove_page": "Supprimer la page",
    "scan.metadata_title": "Informations de base",
    "scan.metadata_help":
      "Ces infos servent pour l'objet de l'e-mail au fleet manager.",
    "scan.field_datum": "Date de l'accident",
    "scan.field_stad": "Lieu (ville)",
    "scan.field_nummerplaat": "Votre plaque d'immatriculation",
    "scan.field_notitie": "Note pour le fleet manager (optionnel)",
    "scan.field_notitie_placeholder": "Ex. police sur place, témoins, …",
    "scan.upload": "Téléverser et continuer",
    "scan.reupload": "Remplacer les pages et téléverser à nouveau",
    "scan.uploading": "Téléversement…",
    "scan.upload_success": "Scan enregistré.",
    "scan.already_uploaded":
      "Le scan est enregistré. Ajoutez des pages pour téléverser à nouveau.",
    "scan.complete_title": "Prêt à envoyer",
    "scan.complete_subtitle":
      "Voici le PDF généré. Envoyez-le à votre fleet manager.",
    "scan.preview_error":
      "L'aperçu n'a pas pu être chargé. Réessayez.",
    "scan.error.no_pages": "Ajoutez d'abord au moins une page.",
    "scan.error.too_many":
      "Maximum atteint. Supprimez d'abord une page pour en ajouter.",
    "scan.error.bad_type": "Seuls les formats JPG et PNG sont acceptés.",
    "scan.error.too_large":
      "Photo trop grande (max 12 Mo). Prenez une photo plus petite.",
    "scan.error.upload_failed":
      "Téléversement échoué. Vérifiez votre connexion et réessayez.",
    "common.retry": "Réessayer",
  },
  en: {
    "common.next": "Next",
    "common.back": "Back",
    "common.ok": "OK",
    "common.confirm": "Confirm",
    "common.yes": "Yes",
    "common.no": "No",
    "common.not_filled": "Not provided",
    "common.not_specified": "Not specified",
    "common.saving": "Saving…",
    "common.dash": "—",

    "banner.signature":
      "Once signed, the report is automatically forwarded to your insurer.",
    "banner.vehicle_contact":
      "If the vehicles made contact, each party needs to mark the impact point on their vehicle.",
    "banner.circumstances_manual":
      "Optional — leave empty if you don't want to add anything to box 14 of the form.",

    "party_b_form.intro":
      "Only fill in what you know for sure. You can complete the rest from the overview.",
    "party_b_form.section.policyholder": "Policyholder / insured (party B)",
    "party_b_form.section.insurance": "Insurance (party B)",
    "party_b_form.section.vehicle": "Vehicle (party B)",
    "party_b_form.section.driver": "Driver (party B)",
    "field.firstname": "First name",
    "field.lastname": "Last name",
    "field.street": "Street",
    "field.housenumber": "No.",
    "field.box": "Box",
    "field.postcode": "Postcode",
    "field.city": "City",
    "field.country": "Country",
    "field.insurance_company": "Insurance company",
    "field.policy_number": "Policy number",
    "field.make_model": "Make & model",
    "field.plate": "Licence plate",
    "field.registration_country": "Country of registration",
    "field.birthdate": "Date of birth",
    "field.license_number": "Driver's licence number",
    "field.license_category": "Category",
    "field.license_valid_to": "Valid until",
    "field.date": "Date",
    "field.time": "Time",

    "insurance.extra_toggle": "Extra insurance details",
    "insurance.green_card": "Green card no.",
    "insurance.valid_from": "Valid from",
    "insurance.valid_to": "Valid until",
    "insurance.agency": "Agency / broker",

    "vehicle.trailer_toggle": "Trailer attached?",
    "vehicle.trailer_help":
      "Only fill in if a trailer was attached to the vehicle at the time of the accident.",
    "vehicle.trailer_plate": "Trailer plate",
    "vehicle.trailer_country": "Country of registration",

    "visible_damage.intro_a":
      "Briefly describe the visible damage to vehicle A (section 11 of the form).",
    "visible_damage.intro_b":
      "Briefly describe the visible damage to vehicle B (section 11 of the form).",
    "visible_damage.label_a": "Visible damage vehicle A",
    "visible_damage.label_b": "Visible damage vehicle B",
    "visible_damage.placeholder":
      "e.g. dent on right front door, broken headlight, …",
    "visible_damage.optional_hint":
      "Optional — leave empty if nothing to report. The impact point is already on the diagram above.",

    "sketch.intro":
      "Draw a sketch of the accident here (position of vehicles, direction of travel, road signs, …). Will appear on the form and in the summary.",
    "sketch.optional_hint":
      "Optional — skip if you don't want to add a sketch.",

    "location.picker.use_current": "Use my current location",
    "location.picker.locating": "Locating…",
    "location.picker.search_placeholder": "Search address (street, city, …)",
    "location.picker.searching": "Searching…",
    "location.picker.permission_denied": "Location access denied.",
    "location.picker.unavailable": "Geolocation is not available in this browser.",
    "location.picker.insecure": "Location only works over https (or localhost).",
    "location.picker.rate_limited": "Too many requests. Try again shortly.",
    "location.picker.no_address": "Could not find an address for this location. Fill it in manually.",
    "location.picker.geocode_failed":
      "Could not fetch address. Please enter it manually.",
    "location.picker.locate_failed": "Could not determine location.",

    "location.approval.a.intro":
      "Enter the place and time of the accident. Party B has to confirm these before you can continue.",
    "location.approval.a.send": "Send to party B for confirmation",
    "location.approval.a.send_disabled": "Fill in all fields first.",
    "location.approval.a.pending_title": "Waiting for party B's confirmation",
    "location.approval.a.pending_body":
      "Party B is reviewing the place and time. You can continue as soon as B confirms.",
    "location.approval.a.approved_title": "Confirmed by party B",
    "location.approval.a.approved_body":
      "Place and time are confirmed. You can move on to the next step.",
    "location.approval.a.rejected_title": "Party B disagrees",
    "location.approval.a.rejected_body": "Adjust the details and send again.",
    "location.approval.a.rejected_note": "Note from party B:",
    "location.approval.a.retract": "Edit",
    "location.approval.a.retract_confirm":
      "Edit place and time again? The confirmation will be revoked and party B will need to confirm again.",
    "location.approval.b.title": "Confirm place and time",
    "location.approval.b.intro":
      "Party A entered the place and time. Review the information and indicate whether it is correct.",
    "location.approval.b.waiting":
      "Party A is still entering the place and time. You'll get a notice once A is done.",
    "location.approval.b.approve": "Confirm",
    "location.approval.b.reject": "Disagree",
    "location.approval.b.note_label": "Note for party A (optional)",
    "location.approval.b.note_placeholder": "E.g. 'date is wrong, it was April 16'",
    "location.approval.b.send_rejection": "Send disagreement",
    "location.approval.b.cancel": "Cancel",
    "location.approval.b.approved_title": "Thanks, your confirmation is recorded",
    "location.approval.b.approved_body":
      "Party A can continue the report.",
    "location.approval.b.rejected_title": "Your disagreement has been sent",
    "location.approval.b.rejected_body":
      "Party A will adjust the details and ask again for confirmation.",

    "injuries.question": "Were there any injuries in the accident?",
    "material.question":
      "Was there other material damage besides the vehicles?",

    "witnesses.placeholder":
      "Name, address and phone number of witnesses (if any).",
    "witnesses.help": "If there are no witnesses, you can leave this field empty.",
    "witnesses.question": "Were there any witnesses on the scene?",
    "witnesses.entry_label": "Witness",
    "witnesses.add": "Add another witness",
    "witnesses.remove": "Remove witness",
    "witnesses.field_phone": "Phone number (optional)",
    "witnesses.none_note":
      "No witnesses — you can continue to the next step.",

    "situation.multi_hint":
      "Multiple answers allowed — tick everything that applies.",
    "situation.help_choose": "Choose the situation that fits best.",

    "proposal.question": "Do you agree with this proposal?",
    "proposal.accept": "Yes, agree",
    "proposal.reject": "No, I want to adjust",
    "proposal.section_title": "Proposal based on your answers",
    "circumstances.label": "Circumstances (additional)",
    "circumstances.placeholder":
      "Describe what exactly happened. This goes into box 14 of the report.",

    "vehicle_contact.question": "Was there contact between the vehicles?",

    "impact.a.label": "Mark the impact point on vehicle A.",
    "impact.b.label": "Mark the impact point on vehicle B.",
    "impact.hint":
      "Tap or drag to mark the impact point. The red arrow points to the initial contact area.",

    "overview.intro":
      "This is the final step of the report. Please review all the information you entered. You can also skip this step.",
    "overview.skip": "Skip overview",
    "overview.tab.location": "Location",
    "overview.tab.questions": "Questions",
    "overview.tab.impact": "Impact",
    "overview.tab.witnesses": "Witnesses",
    "overview.tab.data": "Details",
    "overview.section.place": "Location of the accident",
    "overview.section.time": "Date & time",
    "overview.section.damage": "Damage & injuries",
    "overview.section.accident_type": "Accident type",
    "overview.section.proposal": "Amicable proposal",
    "overview.section.vehicle_contact": "Contact between vehicles",
    "overview.section.impact_a": "Impact point vehicle A",
    "overview.section.impact_b": "Impact point vehicle B",
    "overview.section.witnesses": "Witnesses",
    "overview.section.driver_a": "Driver A",
    "overview.section.driver_b": "Driver B",
    "overview.section.vehicle_a": "Vehicle A",
    "overview.section.vehicle_b": "Vehicle B",
    "overview.section.insurance_a": "Insurance A",
    "overview.section.insurance_b": "Insurance B",
    "overview.section.holder_a": "Policyholder A",
    "overview.section.holder_b": "Policyholder B",
    "overview.empty.witnesses": "No witnesses provided.",
    "overview.witnesses.none": "No witnesses on the scene.",
    "overview.empty.impact": "No impact point marked.",
    "overview.empty.category": "Not chosen yet",
    "overview.empty.detail": "No detail",
    "overview.empty.maneuver_a": "No manoeuvre A",
    "overview.empty.maneuver_b": "No manoeuvre B",
    "overview.empty.proposal": "Not decided",
    "overview.empty.proposal_notes": "No explanation",
    "overview.row.category": "Category",
    "overview.row.detail": "Detail",
    "overview.row.maneuver_a": "Manoeuvre A",
    "overview.row.maneuver_b": "Manoeuvre B",
    "overview.row.proposal_accepted": "Proposal accepted",
    "overview.row.circumstances": "Circumstances",
    "overview.row.contact": "Contact?",
    "overview.row.injuries": "Injuries",
    "overview.row.other_damage": "Other material damage",
    "overview.row.address": "Address",
    "overview.row.phone": "Phone",
    "overview.row.email": "Email",
    "overview.row.enterprise": "Enterprise no.",
    "overview.row.license": "Licence",
    "overview.row.company": "Company",
    "overview.row.policy": "Policy no.",

    "signature.b.prompt":
      "Sign below on behalf of driver B. Use finger or stylus.",
    "signature.clear_aria": "Clear",

    "complete.title": "Report completed",
    "complete.subtitle":
      "Review the completed European accident report below.",
    "complete.loading": "Loading PDF…",
    "complete.error_title": "PDF failed to load",
    "complete.retry": "Try again",
    "complete.download": "Download PDF",
    "complete.close": "Close",

    "send.title": "Send to fleet manager",
    "send.intro":
      "Send the report as PDF attachment to the company's central claims address. You'll get a copy via CC.",
    "send.button": "Send to fleet manager",
    "send.button_retry": "Send again",
    "send.sending": "Report is being sent to the fleet manager…",
    "send.success_title": "Sent to the fleet manager",
    "send.success_to": "Sent to:",
    "send.success_cc": "Copy (CC):",
    "send.success_simulated":
      "Test mode: e-mail wasn't actually sent (RESEND_API_KEY missing).",
    "send.failure_title": "Automatic sending failed",
    "send.error.no_recipient":
      "No central claims address is configured for your company yet. Ask the admin to add one in the company settings.",
    "send.error.incomplete":
      "The report is not signed yet. Please complete all steps first.",
    "send.error.forbidden": "Only party A can send the report.",
    "send.error.generic": "Something went wrong. Try again.",
    "send.retry_hint":
      "You can also retry later from ‘My incidents’.",
    "send.b.waiting":
      "Party A is sending the report to the fleet manager. You won't get a copy on this device.",

    "submission_mode.intro":
      "You can complete the report step by step using the wizard, or scan the paper European accident statement and forward it.",
    "submission_mode.wizard_title": "Use the wizard",
    "submission_mode.wizard_desc":
      "We'll guide you through every step. Recommended when you have nothing on paper.",
    "submission_mode.scan_title": "Scan paper form",
    "submission_mode.scan_desc":
      "Photograph the filled-in paper form and send the PDF straight to your fleet manager.",

    "scan.pages_title": "Form pages",
    "scan.pages_help":
      "Take a clear photo of every page (front + back if filled). Avoid shadows and keep the text readable.",
    "scan.button_camera": "Take a photo",
    "scan.button_gallery": "From gallery",
    "scan.empty": "No pages yet. Add at least one photo to continue.",
    "scan.page_label": "Page",
    "scan.remove_page": "Remove page",
    "scan.metadata_title": "Basic info",
    "scan.metadata_help":
      "We use this info for the subject of the e-mail to your fleet manager.",
    "scan.field_datum": "Accident date",
    "scan.field_stad": "Place (city)",
    "scan.field_nummerplaat": "Your number plate",
    "scan.field_notitie": "Note for the fleet manager (optional)",
    "scan.field_notitie_placeholder": "E.g. police on site, witnesses, …",
    "scan.upload": "Upload and continue",
    "scan.reupload": "Replace pages and upload again",
    "scan.uploading": "Uploading…",
    "scan.upload_success": "Scan saved.",
    "scan.already_uploaded":
      "The scan is saved. Add pages to upload again.",
    "scan.complete_title": "Ready to send",
    "scan.complete_subtitle":
      "Below is the generated PDF. Send it to your fleet manager.",
    "scan.preview_error": "Preview could not be loaded. Try again.",
    "scan.error.no_pages": "Add at least one page first.",
    "scan.error.too_many":
      "Maximum reached. Remove a page first to add another.",
    "scan.error.bad_type": "Only JPG or PNG are allowed.",
    "scan.error.too_large":
      "Photo too large (max 12 MB). Take a smaller photo.",
    "scan.error.upload_failed":
      "Upload failed. Check your connection and try again.",
    "common.retry": "Retry",
  },
};

export function t(lang: OngevalLang, key: string): string {
  return UI_STRINGS[lang][key] ?? UI_STRINGS.nl[key] ?? key;
}

export function getStepTitleLocalized(
  stepId: OngevalStepId,
  lang: OngevalLang,
): string {
  return STEP_TITLES[lang][stepId] ?? STEP_TITLES.nl[stepId] ?? stepId;
}

export function getCategoryLabel(
  id: SituationCategoryId | null,
  lang: OngevalLang,
): string {
  if (!id) return "";
  return CATEGORY_LABELS[lang][id] ?? CATEGORY_LABELS.nl[id] ?? id;
}

export function getCategoryDescription(
  id: SituationCategoryId | null,
  lang: OngevalLang,
): string {
  if (!id) return "";
  return CATEGORY_DESCRIPTIONS[lang][id] ?? CATEGORY_DESCRIPTIONS.nl[id] ?? "";
}

export function getDetailLabel(detailKey: string | null, lang: OngevalLang): string {
  if (!detailKey) return "";
  return DETAIL_LABELS[lang][detailKey] ?? DETAIL_LABELS.nl[detailKey] ?? detailKey;
}
