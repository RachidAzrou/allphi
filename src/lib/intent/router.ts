import type { ChatIntent } from "@/types/chat";

interface IntentRule {
  intent: ChatIntent;
  patterns: RegExp[];
  keywords: string[];
}

/**
 * Priority-ordered intent rules. Patterns are checked first (more specific),
 * then keyword fallback. Order matters: more specific intents come first.
 */
const rules: IntentRule[] = [
  // ── New car order (must come before allowed_options: both talk about "kiezen") ──
  {
    intent: "new_car_order",
    patterns: [
      /\bnieuwe\s+(wagen|auto)\b.{0,60}\b(bestel|bestellen|bestelling|offerte)\b/i,
      /\b(bestel|bestellen|bestelling)\b.{0,40}\b(nieuwe\s+(wagen|auto))\b/i,
      /\b(offerte)\b.{0,60}\b(upload|uploaden|control(eer|eren)|check)\b/i,
      /\b(wagen|auto)\s+(bestellen|bestelling)\b/i,
    ],
    keywords: [
      "nieuwe wagen bestellen",
      "nieuwe auto bestellen",
      "wagen bestellen",
      "auto bestellen",
      "bestelling nieuwe wagen",
      "offerte uploaden",
      "offerte controleren",
    ],
  },

  // ── Traffic accident / European accident statement (before generic "schade" etc.) ──
  {
    intent: "accident_report",
    patterns: [
      // Schade / glasbreuk / vandalisme / diefstal (expliciet, zodat dit niet naar unknown/LLM valt)
      /\b(gebroken|stuk|barst|ster).{0,30}\b(ruit|voorruit|zijruit|achterruit)\b/i,
      /\b(ruit|voorruit|zijruit|achterruit).{0,30}\b(gebroken|stuk|barst|ster)\b/i,
      /\bglasbr(euk|eken)\b/i,
      /\bcarglass\b/i,
      /\b(eenzijdig|eénzijdig).{0,20}\bschade\b/i,
      /\bschade\b.{0,30}\b(paalt|spiegel|bumper|parkeer|muur|paal)\b/i,
      /\b(paaltje|spiegel|bumper)\b.{0,30}\b(geraakt|aangereden|gescheurd)\b/i,
      /parkeerschade/i,
      /\b(vandalisme|vandalism)\b/i,
      /\b(diefstal|gestolen|stelen)\b.{0,30}\b(wagen|auto|voertuig|band|onderdeel)\b/i,
      /\b(inbraak|ingebroken)\b/i,
      /\bschade.{0,30}\b(melden|rapporteren|aangifte)\b/i,
      /\b(meld|rapporteer).{0,30}\bschade\b/i,
      /\b(heb|had|ben|was|kreeg|krijg).{0,60}\b(ongeval|aanrijding|botsing)\b/i,
      /\b(ongeval|aanrijding|botsing).{0,40}\b(gehad|gekregen|meegemaakt|melden)\b/i,
      /\b(meld|invul|invullen).{0,40}(aanrijdingsformulier|ongeval)/i,
      /aanrijding/i,
      /aangereden/i,
      /aangebotst/i,
      /botsing/i,
      /verkeersongeval/i,
      /europees\s+aanrijdingsformulier/i,
      /aanrijdingsformulier/i,
      /(ik\s+)?(heb|had|ben|was).*(ongeval|aanrijding|botsing)/i,
      /(na|door)\s+(een\s+)?(botsing|aanrijding|ongeval)/i,
    ],
    keywords: [
      "ongeval gehad",
      "aanrijding gehad",
      "botsing gehad",
      "ik had een ongeval",
      "schade na ongeval",
      "europees aanrijdingsformulier",
      "schade melden",
      "glasbreuk",
      "gebroken ruit",
      "parkeerschade",
      "eenzijdige schade",
      "vandalisme",
      "inbraak wagen",
      "auto ingebroken",
      "diefstal wagen",
      "gestolen wagen",
      "carglass",
    ],
  },

  // ── Tire change (bandenwissel) ──
  {
    intent: "tire_change",
    patterns: [
      /banden\s*wissel/i,
      /banden\s*wisselen/i,
      /\bbandenwissel\b/i,
      /\bwinterbanden\b/i,
      /\bzomerbanden\b/i,
      /(winter|zomer)\s*banden/i,
      /(winter|zomer)\s*set/i,
      /wissel.*banden/i,
    ],
    keywords: [
      "bandenwissel",
      "banden wissel",
      "bandenwisselen",
      "banden wisselen",
      "winterbanden",
      "zomerbanden",
      "winter set",
      "zomer set",
    ],
  },

  // ── Lease return / inspection (inlevering leasewagen) ──
  {
    intent: "lease_return_inspection",
    patterns: [
      /leasewagen.{0,20}\b(inlever|inleveren|inlevering)\b/i,
      /\b(inlever|inleveren|inlevering)\b.{0,20}\bleasewagen\b/i,
      /\b(wagen|auto)\b.{0,20}\b(inlever|inleveren|inlevering)\b/i,
      /\b(inlever|inleveren|inlevering)\b.{0,20}\b(wagen|auto)\b/i,
      /\binspectie\b.{0,20}\b(leasewagen|wagen|auto)\b/i,
      /\b(uitdiensttreding|contracteinde|einde\s+contract)\b.{0,40}\b(wagen|auto|leasewagen)\b/i,
    ],
    keywords: [
      "leasewagen inleveren",
      "leasewagen inlevering",
      "inlevering leasewagen",
      "wagen inleveren",
      "auto inleveren",
      "inspectie leasewagen",
      "inspectie inlevering",
      "uitdiensttreding wagen",
      "contracteinde wagen",
      "einde contract wagen",
      "voorkooprecht",
    ],
  },

  // ── Insurance certificate / green card (keep specific to avoid collisions) ──
  {
    intent: "insurance_certificate",
    patterns: [
      /verzekeringsattest/i,
      /attestation\s+d['’]assurance/i,
      /insurance\s+certificate/i,
      // Only when explicitly asking for the green card document/number in an attest context.
      /(groene\s+kaart|carte\s+verte).{0,40}\b(attest|attestation|certificate|certificaat)\b/i,
    ],
    keywords: [
      "verzekeringsattest",
      "attestation d'assurance",
      "attestation d’ass",
      "insurance certificate",
      "attest groene kaart",
      "attestation carte verte",
    ],
  },

  // ── Charging: home vs public (must come before charging_summary) ──
  {
    intent: "charging_home_vs_public",
    patterns: [
      /thuis\s+(of|vs|versus)\s+(publiek|openbaar)/i,
      /(publiek|openbaar)\s+(of|vs|versus)\s+thuis/i,
      /laad\s+ik\s+meer/i,
      /waar\s+laad\s+ik/i,
      /hoeveel\s+(laad\s+ik\s+)?thuis/i,
      /hoeveel\s+(laad\s+ik\s+)?publiek/i,
    ],
    keywords: ["thuis laden", "publiek laden", "thuis of publiek", "publiek of thuis"],
  },

  // ── Reimbursement ──
  {
    intent: "reimbursement_status",
    patterns: [
      /terugbetal/i,
      /nog\s+(niet\s+)?terugbetaald/i,
      /open\s+laadkosten/i,
      /voorgeschoten/i,
      /open\s+bedrag/i,
      /openstaand/i,
    ],
    keywords: ["terugbetaald", "terugbetaling", "voorgeschoten", "openstaand"],
  },

  // ── Best range option (must come before allowed_options) ──
  {
    intent: "best_range_option",
    patterns: [
      /grootste\s+range/i,
      /meeste\s+range/i,
      /beste\s+range/i,
      /langste\s+(range|afstand|actieradius)/i,
      /rijdt\s+het\s+verst/i,
      /welke.*optie.*range/i,
      /interessant.*lange\s+afstand/i,
      /meeste\s+kilometers/i,
    ],
    keywords: ["grootste range", "beste range", "lange afstand", "rijdt het verst"],
  },

  // ── Allowed vehicle options ──
  // Enkel triggeren als de gebruiker EXPLICIET vraagt welke wagens/modellen
  // hij MAG KIEZEN — niet bij beleids- of procedurele vragen met "opties".
  {
    intent: "allowed_options",
    patterns: [
      /welke\s+(wagens?|auto'?s?|voertuigen?|modellen)\s+(mag|kan)\s+ik/i,
      /beschikbare\s+(wagens?|auto'?s?|voertuigen?|modellen)/i,
      /wat\s+(mag|kan)\s+ik\s+kiezen/i,
      /kiesbare\s+wagens/i,
    ],
    keywords: [
      "beschikbare wagens",
      "beschikbare modellen",
      "mag ik kiezen",
      "kiesbare wagens",
      "welke wagens mag",
      "welke auto mag",
    ],
  },

  // ── My documents ──
  {
    intent: "my_documents",
    patterns: [
      /mijn\s+document/i,
      /welke\s+document/i,
      /toon.*offerte/i,
      /mijn\s+offerte/i,
      /heb\s+ik\s+document/i,
    ],
    keywords: ["mijn documenten", "mijn offerte"],
  },

  // ── My contract ──
  {
    intent: "my_contract",
    patterns: [
      /mijn\s+contract/i,
      /contractnummer/i,
      /contract\s*info/i,
      /goedkeuringsstatus/i,
      /contract\s+loopt\s+af/i,
      /einddatum\s+contract/i,
      /wanneer\s+loopt\s+(mijn\s+)?contract/i,
    ],
    keywords: [
      "mijn contract", "contractnummer", "contractstatus",
      "goedkeuringsstatus", "einddatum contract",
    ],
  },

  // ── My vehicle ──
  {
    intent: "my_vehicle",
    patterns: [
      /mijn\s+(wagen|auto|voertuig)\b(?!\s+(inleveren|inlevering|bestellen|bestelling))/i,
      /wat\s+rijd\s+ik/i,
      /wat\s+is\s+mijn\s+(wagen|auto|nummerplaat|range|actieradius)/i,
      /met\s+welke\s+(wagen|auto)\s+(rijd|werk|ga)/i,
    ],
    keywords: [
      "mijn wagen", "mijn auto", "mijn nummerplaat",
      "mijn actieradius", "mijn aandrijving",
    ],
  },

  // ── Charging summary ──
  {
    intent: "charging_summary",
    patterns: [
      /hoeveel\s+(heb\s+ik\s+)?geladen/i,
      /(mijn\s+)?laadkosten/i,
      /wat\s+kost.*laden/i,
      /laad\s*sessies?/i,
      /hoeveel\s+sessies/i,
      /gemiddeld.*laden/i,
      /kost\s+laden/i,
      /hoeveel\s+kwh/i,
    ],
    keywords: [
      "laadkosten", "geladen", "kwh", "sessies",
      "kost laden", "hoeveel geladen",
    ],
  },

  // ── Greeting ──
  // Geen losse korte keywords zoals "hi" / "hey" / "hoi" — die matchen als
  // substring op woorden als "AllPhi", "hey" in "aangehecht", etc.
  // De pattern dekt alle echte begroetingen al (start-of-message).
  {
    intent: "greeting",
    patterns: [/^(hallo|hey|hoi|hi|hello|goedemorgen|goedemiddag|goedenavond|dag)\b/i],
    keywords: ["goedemorgen", "goedemiddag", "goedenavond"],
  },
];

/** "Geen ongeval" / "niet … ongeval" mag niet als melding worden gezien. */
function shouldRejectAccidentIntent(normalized: string): boolean {
  if (/\bgeen ongeval\b/.test(normalized)) return true;
  if (/\b(niet|nooit)\s+(een\s+)?(aanrijding|botsing|ongeval)\b/.test(normalized))
    return true;
  return false;
}

/**
 * Beleidsvragen over de wagen ("mag ik iemand anders laten rijden?", "wat als ik
 * langdurig ziek ben?") mogen NIET als `my_vehicle` worden herkend — die moeten
 * via OpenAI RAG afgehandeld worden zodat de kennisbank geraadpleegd wordt.
 */
function shouldRejectMyVehicleIntent(normalized: string): boolean {
  const policyMarkers: RegExp[] = [
    /\bmag\s+ik\b/,                              // "Mag ik iemand anders..."
    /\bkan\s+ik\b/,                              // "Kan ik roken in mijn wagen?"
    /\broken\b/,                                 // alles met roken → KB
    /\bwat\s+gebeurt\b/,                          // "Wat gebeurt er met..."
    /\bwat\s+als\b/,                              // "Wat als ik deeltijds..."
    /\bwat\s+verandert\b/,                        // "Wat verandert er voor mijn wagen..."
    /\bals\s+ik\s+(langdurig|ziek|deeltijds|stop|vertrek|verhuis|tijdskrediet)\b/i,
    /\btijdskrediet\b/,                           // tijdskrediet = loopbaanonderbreking
    /\bloopbaanonderbreking\b/,
    /\bmoederschapsverlof\b/,
    /\bvaderschapsverlof\b/,
    /\bziekteverlof\b/,
    /\boutdienst(treding)?\b/,
    /\bontslag\b/,
    /\bverlies\s+ik\b/,                           // "verlies ik dan mijn wagen"
    /\bkwijt\b/,                                  // "ben ik mijn wagen kwijt"
    /\blangdurig\b/,                              // langdurig ziek / afwezig
    /\bdeeltijds\b/,                              // deeltijds gaan werken
    /\biemand\s+anders\b/,                        // iemand anders laten rijden
    /\blaten\s+rijden\b/,                         // laten rijden door...
    /\bregels?\s+(voor|bij|van|rond)\b/,          // regels voor mijn wagen
    /\bwat\s+zijn\s+de\s+regels\b/,
    /\bpriv[eé]\s*(gebruik|gereden|rijden)?\b/,   // privégebruik
    /\bpersoonlijk\s+gebruik\b/,
    /\bverzeker(d|ing)\b/,                        // verzekering-gerelateerd (eigen apart intent)
    /\bonder\s+welke\s+voorwaarden\b/,
    /\bhoe\s+zit\s+het\s+met\b/,                 // "hoe zit het met mijn wagen"
    /\bwat\s+zijn\s+de\s+gevolgen\b/,
    /\bimpact\b.{0,20}\b(wagen|auto|contract|laadpaal)\b/i,
    /\b(laadpaal|laadpunt)\b/,                    // laadpaal-vragen → KB
  ];
  return policyMarkers.some((p) => p.test(normalized));
}

/**
 * Korte bevestigingen / afsluitende berichtjes ("niks", "ok", "bedankt", …)
 * mogen nooit naar OpenAI/KB gaan — dat levert verwarrende antwoorden op.
 */
function isAcknowledgment(normalized: string): boolean {
  return /^(niks|niets|ok|oke|oké|prima|goed|super|top|begrepen|helder|duidelijk|geen\s+vragen?|alles\s+goed|geen\s+probleem|merci|bedankt|dank\s+je|dank\s+u|dank|alvast\s+bedankt|no|nee|ja\s+ok|ja\s+oke)$/.test(
    normalized
  );
}

export function detectIntent(message: string): ChatIntent {
  const normalized = message.toLowerCase().trim();

  // Triviale bevestigingen / afsluitende berichten → nooit naar OpenAI
  if (isAcknowledgment(normalized)) return "acknowledgment";

  // Phase 1: regex patterns (high confidence)
  for (const rule of rules) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalized)) {
        if (
          rule.intent === "accident_report" &&
          shouldRejectAccidentIntent(normalized)
        ) {
          continue;
        }
        if (
          rule.intent === "my_vehicle" &&
          shouldRejectMyVehicleIntent(normalized)
        ) {
          continue;
        }
        return rule.intent;
      }
    }
  }

  // Phase 2: keyword fallback (woordgrens-match om substring-valsmeldingen te vermijden)
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      const kwPattern = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (kwPattern.test(normalized)) {
        if (
          rule.intent === "accident_report" &&
          shouldRejectAccidentIntent(normalized)
        ) {
          continue;
        }
        if (
          rule.intent === "my_vehicle" &&
          shouldRejectMyVehicleIntent(normalized)
        ) {
          continue;
        }
        return rule.intent;
      }
    }
  }

  return "unknown";
}

/**
 * Fallback wanneer geen regel matcht maar de tekst duidelijk over een
 * verkeersongeval gaat (brede match vóór OpenAI).
 */
export function detectAccidentFallback(message: string): boolean {
  const t = message.toLowerCase().trim();
  if (shouldRejectAccidentIntent(t)) return false;
  if (/(no\s+accident)/i.test(message)) return false;
  return /(ongeval|aanrijding|botsing|aanrijd|aangereden|aangebotst|verkeersongeval|crash|collision|aanrijdingsformulier)/i.test(
    t,
  );
}
