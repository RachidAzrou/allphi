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
  // ── Traffic accident / European accident statement (before generic "schade" etc.) ──
  {
    intent: "accident_report",
    patterns: [
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
  {
    intent: "allowed_options",
    patterns: [
      /welke\s+(wagens?|auto'?s?|voertuigen?|modellen)\s+(mag|kan|zijn|heb)/i,
      /beschikbare\s+(wagens?|auto'?s?|opties|voertuigen?|modellen)/i,
      /wat\s+(mag|kan)\s+ik\s+kiezen/i,
      /kiesbare\s+wagens/i,
      /welke\s+modellen/i,
    ],
    keywords: [
      "beschikbare wagens", "beschikbare opties", "mag ik kiezen",
      "kiesbare", "opties", "beschikbaar",
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
    keywords: ["documenten", "document", "offerte"],
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
      /wanneer\s+loopt/i,
    ],
    keywords: [
      "contract", "contractnummer", "contractstatus",
      "goedkeuringsstatus", "einddatum contract", "looptijd",
    ],
  },

  // ── My vehicle ──
  {
    intent: "my_vehicle",
    patterns: [
      /welke\s+(wagen|auto|voertuig)/i,
      /mijn\s+(wagen|auto|voertuig)/i,
      /wat\s+rijd\s+ik/i,
      /wat\s+is\s+mijn\s+(wagen|auto|nummerplaat|range|actieradius)/i,
      /met\s+welke\s+(wagen|auto)/i,
    ],
    keywords: [
      "mijn wagen", "welke wagen", "nummerplaat", "range",
      "actieradius", "aandrijving", "mijn auto",
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
  {
    intent: "greeting",
    patterns: [/^(hallo|hey|hoi|hi|hello|goedemorgen|goedemiddag|goedenavond|dag)\b/i],
    keywords: ["hallo", "hey", "hoi", "hi", "hello", "goedemorgen", "goedemiddag", "goedenavond"],
  },
];

/** "Geen ongeval" / "niet … ongeval" mag niet als melding worden gezien. */
function shouldRejectAccidentIntent(normalized: string): boolean {
  if (/\bgeen ongeval\b/.test(normalized)) return true;
  if (/\b(niet|nooit)\s+(een\s+)?(aanrijding|botsing|ongeval)\b/.test(normalized))
    return true;
  return false;
}

export function detectIntent(message: string): ChatIntent {
  const normalized = message.toLowerCase().trim();

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
        return rule.intent;
      }
    }
  }

  // Phase 2: keyword fallback
  for (const rule of rules) {
    for (const kw of rule.keywords) {
      if (normalized.includes(kw)) {
        if (
          rule.intent === "accident_report" &&
          shouldRejectAccidentIntent(normalized)
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
