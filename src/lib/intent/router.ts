import type { Intent } from "@/types/chat";

interface IntentPattern {
  intent: Intent;
  keywords: string[];
  patterns: RegExp[];
}

const intentPatterns: IntentPattern[] = [
  {
    intent: "my_vehicle",
    keywords: [
      "wagen", "auto", "voertuig", "nummerplaat", "range",
      "merk", "model", "aandrijving", "brandstof", "kleur",
      "rijd", "rijden", "kenteken",
    ],
    patterns: [
      /welke\s+(wagen|auto|voertuig)/i,
      /mijn\s+(wagen|auto|voertuig)/i,
      /wat\s+(rijd|is\s+mijn\s+(wagen|auto|nummerplaat|range))/i,
      /nummerplaat/i,
      /range\s+(van\s+mijn|wagen)/i,
      /aandrijving/i,
    ],
  },
  {
    intent: "my_documents",
    keywords: ["document", "documenten", "offerte", "bestand", "bestanden"],
    patterns: [
      /mijn\s+document/i,
      /welke\s+document/i,
      /toon.*offerte/i,
      /mijn\s+offerte/i,
    ],
  },
  {
    intent: "my_contract",
    keywords: ["contract", "goedkeuring", "goedkeuringsstatus", "looptijd"],
    patterns: [
      /mijn\s+contract/i,
      /contract\s*(info|status|gegevens)?/i,
      /goedkeuringsstatus/i,
      /wat\s+is\s+mijn\s+contract/i,
    ],
  },
  {
    intent: "allowed_options",
    keywords: ["kiezen", "keuze", "opties", "beschikbaar", "beschikbare", "budget", "categorie"],
    patterns: [
      /welke\s+(wagens?|auto'?s?|voertuigen?)\s+(mag|kan|zijn)/i,
      /beschikbare\s+(wagens?|auto'?s?|opties|voertuigen?)/i,
      /wat\s+(mag|kan)\s+ik\s+kiezen/i,
      /mijn\s+budget/i,
      /welke\s+modellen/i,
    ],
  },
  {
    intent: "charging_summary",
    keywords: ["laden", "laad", "laadkosten", "geladen", "kwh", "sessie", "sessies", "kosten"],
    patterns: [
      /hoeveel\s+(heb\s+ik\s+)?geladen/i,
      /(mijn\s+)?laadkosten/i,
      /wat\s+kost.*laden/i,
      /laad\s*sessies?/i,
      /hoeveel\s+sessies/i,
      /gemiddeld.*laden/i,
    ],
  },
  {
    intent: "charging_home_vs_public",
    keywords: ["thuis", "publiek", "openbaar"],
    patterns: [
      /thuis\s+(of|vs|versus)\s+(publiek|openbaar)/i,
      /laad\s+ik\s+meer/i,
      /waar\s+laad/i,
      /publiek.*thuis|thuis.*publiek/i,
    ],
  },
  {
    intent: "best_range_option",
    keywords: ["grootste range", "meeste range", "langste", "afstand"],
    patterns: [
      /grootste\s+range/i,
      /meeste\s+range/i,
      /beste\s+range/i,
      /lange\s+afstand/i,
      /welke\s+optie.*range/i,
      /interessant.*lange\s+afstand/i,
    ],
  },
  {
    intent: "greeting",
    keywords: ["hallo", "hey", "hoi", "goedemorgen", "goedemiddag", "goedenavond", "hi", "hello"],
    patterns: [/^(hallo|hey|hoi|hi|hello|goedemorgen|goedemiddag|goedenavond)\b/i],
  },
];

export function detectIntent(message: string): Intent {
  const normalized = message.toLowerCase().trim();

  for (const { intent, patterns } of intentPatterns) {
    for (const pattern of patterns) {
      if (pattern.test(normalized)) {
        return intent;
      }
    }
  }

  for (const { intent, keywords } of intentPatterns) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return intent;
      }
    }
  }

  return "unknown";
}
