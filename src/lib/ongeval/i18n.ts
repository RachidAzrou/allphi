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
  },
  fr: {
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
    proposal_intro: "Proposition de déclaration",
    proposal_decision: "Proposition de déclaration",
    circumstances_manual: "Circonstances (ajout)",
    vehicle_contact: "Point de choc",
    impact_party_a: "Point de choc véhicule A",
    impact_party_b: "Point de choc véhicule B",
    overview_intro: "Aperçu de la déclaration",
    overview_detail: "Aperçu",
    signature_a: "Signature A",
    signature_b: "Signature B",
    complete: "Terminé",
  },
  en: {
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
    proposal_intro: "Proposed report",
    proposal_decision: "Proposed report",
    circumstances_manual: "Circumstances (extra)",
    vehicle_contact: "Vehicle contact",
    impact_party_a: "Impact point vehicle A",
    impact_party_b: "Impact point vehicle B",
    overview_intro: "Report overview",
    overview_detail: "Overview",
    signature_a: "Signature A",
    signature_b: "Signature B",
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
    "banner.proposal_intro":
      "Hieronder vind je een voorstel voor de aangifte met vooraf aangevinkte omstandigheden in sectie 12 en opmerkingen in sectie 14.",

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
    "field.date": "Datum",
    "field.time": "Uur",

    // location_time
    "location.picker.use_current": "Gebruik huidige locatie",
    "location.picker.locating": "Locatie bepalen…",
    "location.picker.search_placeholder": "Zoek adres (straat, stad, …)",
    "location.picker.searching": "Zoeken…",
    "location.picker.permission_denied": "Toegang tot locatie geweigerd.",
    "location.picker.unavailable": "Geolocatie niet beschikbaar in deze browser.",
    "location.picker.geocode_failed": "Adres ophalen mislukt. Vul handmatig in.",
    "location.picker.locate_failed": "Locatie bepalen mislukt.",

    // injuries_material
    "injuries.question": "Waren er gewonden bij het ongeval?",
    "material.question": "Was er andere materiële schade dan aan de voertuigen?",

    // witnesses
    "witnesses.placeholder":
      "Naam, adres en telefoonnummer van getuigen (indien van toepassing).",
    "witnesses.help":
      "Indien er geen getuigen zijn kun je dit veld leeg laten.",

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
    "banner.proposal_intro":
      "Vous trouverez ci-dessous une proposition de déclaration avec circonstances pré-cochées en rubrique 12 et remarques en rubrique 14.",

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
    "field.date": "Date",
    "field.time": "Heure",

    "location.picker.use_current": "Utiliser ma position",
    "location.picker.locating": "Localisation…",
    "location.picker.search_placeholder": "Rechercher une adresse (rue, ville, …)",
    "location.picker.searching": "Recherche…",
    "location.picker.permission_denied": "Accès à la position refusé.",
    "location.picker.unavailable": "Géolocalisation indisponible dans ce navigateur.",
    "location.picker.geocode_failed":
      "Impossible de récupérer l'adresse. Veuillez la saisir manuellement.",
    "location.picker.locate_failed": "Impossible de déterminer la position.",

    "injuries.question": "Y a-t-il eu des blessés dans l'accident ?",
    "material.question":
      "Y a-t-il eu d'autres dégâts matériels qu'aux véhicules ?",

    "witnesses.placeholder":
      "Nom, adresse et téléphone des témoins (le cas échéant).",
    "witnesses.help":
      "En l'absence de témoin, vous pouvez laisser ce champ vide.",

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
    "banner.proposal_intro":
      "Below is a proposed report with pre-selected circumstances in box 12 and notes in box 14.",

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
    "field.date": "Date",
    "field.time": "Time",

    "location.picker.use_current": "Use my current location",
    "location.picker.locating": "Locating…",
    "location.picker.search_placeholder": "Search address (street, city, …)",
    "location.picker.searching": "Searching…",
    "location.picker.permission_denied": "Location access denied.",
    "location.picker.unavailable": "Geolocation is not available in this browser.",
    "location.picker.geocode_failed":
      "Could not fetch address. Please enter it manually.",
    "location.picker.locate_failed": "Could not determine location.",

    "injuries.question": "Were there any injuries in the accident?",
    "material.question":
      "Was there other material damage besides the vehicles?",

    "witnesses.placeholder":
      "Name, address and phone number of witnesses (if any).",
    "witnesses.help": "If there are no witnesses, you can leave this field empty.",

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
