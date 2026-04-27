import type { ChatIntent, ChatResponse } from "@/types/chat";
import {
  getMyVehicleContextByEmail,
  getMyContractByEmail,
  getMyDocumentsByEmail,
} from "@/lib/queries/fleet";
import {
  getAllowedVehicleOptionsByEmail,
  getBestRangeOptionByEmail,
} from "@/lib/queries/options";
import {
  getChargingSummaryByEmail,
  getChargingHomeVsPublicByEmail,
  getReimbursementStatusByEmail,
} from "@/lib/queries/charging";
import {
  formatVehicleResponse,
  formatContractResponse,
  formatDocumentsResponse,
  formatInsuranceCertificateResponse,
} from "@/lib/formatters/fleet";
import {
  formatAllowedOptionsResponse,
  formatBestRangeResponse,
} from "@/lib/formatters/options";
import {
  formatChargingSummaryResponse,
  formatChargingComparisonResponse,
  formatReimbursementResponse,
} from "@/lib/formatters/charging";

const DEFAULT_SUGGESTIONS = [
  "Mijn wagen",
  "Mijn documenten",
  "Mijn laadkosten",
  "Beschikbare wagens",
  "Contractinfo",
];

function isCancelMessage(input: string): boolean {
  const t = input.toLowerCase().trim();
  return (
    t === "stop" ||
    t === "annuleer" ||
    t === "cancel" ||
    t === "afbreken" ||
    t === "reset" ||
    t === "begin opnieuw"
  );
}

function isNextMessage(input: string): boolean {
  const t = input.toLowerCase().trim();
  return (
    t === "volgende" ||
    t === "volgende stap" ||
    t === "ga verder" ||
    t === "verder" ||
    t === "ok" ||
    t === "oke" ||
    t === "oké" ||
    t === "ja"
  );
}

function isPrevMessage(input: string): boolean {
  const t = input.toLowerCase().trim();
  return (
    t === "vorige" ||
    t === "vorige stap" ||
    t === "terug" ||
    t === "ga terug" ||
    t === "back"
  );
}

/**
 * TODO: Vervang de href-waarden door de echte URLs van elke leasingpartner
 * als de definitieve links bevestigd zijn.
 */
const LEASING_LINKS =
  `\n\n**Afspraak maken via jouw leasingpartner:**\n` +
  `- [Arval – My Garage Locator](https://mygaragelocator.be)\n` +
  `- [Athlon – Onderhoud en banden](https://www.athlon.com/nl-be/particulier/onderhoud-en-banden)\n` +
  `- [KBC Autolease](https://www.kbc.be/particulieren/nl/producten/verzekeringen/autoverzekering/kbc-autolease.html)\n` +
  `- [J\\&T Autolease – Onderhoud en banden](https://www.jtautolease.be/onderhoud-en-banden)\n` +
  `- [Belfius Auto Lease](https://www.belfius.be/autolease)`;

export function handleTireChangeFlowMessage(params: {
  userMessage: string;
  flow: { id: "tire_change"; step: number; answers?: Record<string, string> };
}): ChatResponse {
  const raw = params.userMessage ?? "";
  const user = raw.trim();
  const normalized = user.toLowerCase().trim();

  // Annuleer altijd mogelijk
  if (isCancelMessage(normalized)) {
    return {
      intent: "tire_change",
      title: "Bandenwissel",
      message:
        "Oké — ik heb de bandenwissel-flow stopgezet.\n\nWaar kan ik je nog mee helpen?",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const step = Number(params.flow.step ?? 1);
  const answers = params.flow.answers ?? {};

  // ── Stap 1: Scenario detectie ─────────────────────────────────────────────
  if (step <= 1) {
    const scenario =
      normalized.includes("huurwagen") || normalized.includes("vervang")
        ? "huurwagen"
        : normalized.includes("nieuwe wagen") ||
            normalized.includes("nieuwe auto") ||
            normalized.includes("nieuwe") ||
            normalized.includes("geleverd")
          ? "nieuwe_wagen"
          : normalized.includes("eerste") ||
              normalized.includes("eerste keer") ||
              normalized.includes("verplaats") ||
              normalized.includes("niet op") ||
              normalized.includes("andere locatie")
            ? "eerste_wissel"
            : normalized.includes("normaal") || normalized.includes("gewoon")
              ? "normaal"
              : null;

    // Geen duidelijk scenario → opnieuw vragen
    if (!scenario || user.length === 0) {
      return {
        intent: "tire_change",
        title: "Bandenwissel",
        message:
          "Ik help je met de **bandenwissel-procedure**. Wat is je situatie?\n\n" +
          "- **Normale bandenwissel** (banden liggen al op de juiste locatie)\n" +
          "- **Eerste bandenwissel / bandenverplaatsing** (banden liggen nog niet waar je wil)\n" +
          "- **Nieuwe wagen**\n" +
          "- **Huurwagen**\n\n" +
          "Typ `stop` om te annuleren.",
        suggestions: [
          "Normale bandenwissel",
          "Eerste bandenwissel / bandenverplaatsing",
          "Nieuwe wagen",
          "Huurwagen",
        ],
        flow: { id: "tire_change", step: 1, answers },
      };
    }

    // ── Normale bandenwissel → stap 2: seizoen
    if (scenario === "normaal") {
      return {
        intent: "tire_change",
        title: "Bandenwissel",
        message:
          "Gaat het om **zomer → winter** of **winter → zomer**?\n\n" +
          "- **Zomer → winter:** wissel tussen **1 oktober en 15 november**\n" +
          "- **Winter → zomer:** wissel tussen **31 maart en 15 mei**",
        suggestions: ["Zomer → winter", "Winter → zomer"],
        flow: { id: "tire_change", step: 2, answers: { ...answers, scenario } },
      };
    }

    // ── Eerste bandenwissel / bandenverplaatsing
    if (scenario === "eerste_wissel") {
      return {
        intent: "tire_change",
        title: "Bandenwissel",
        message:
          "Bij de **eerste bandenwissel** (of als je banden nog niet op de gewenste locatie staan), " +
          "stuur dan een e-mail naar Fleet via **fleet@allphi.eu** met:\n\n" +
          "- het gewenste bandencentrum\n" +
          "- je nummerplaat\n" +
          "- je leasingmaatschappij\n\n" +
          "Zodra de banden op de juiste locatie staan, kan je een afspraak inplannen.\n\n" +
          "**Kosten:**\n" +
          "- De **eerste** bandenverplaatsing is volledig ten laste van **AllPhi**.\n" +
          "- Een **bijkomende** bandenverplaatsing later is ten laste van de **medewerker**.\n\n" +
          "⚠️ Bij een laattijdige wissel wordt een forfait van **€ 150,00** aangerekend." +
          LEASING_LINKS,
        suggestions: ["Oké, ik mail Fleet", "Stop"],
        flow: { id: "tire_change", step: 3, answers: { ...answers, scenario } },
      };
    }

    // ── Nieuwe wagen
    if (scenario === "nieuwe_wagen") {
      return {
        intent: "tire_change",
        title: "Bandenwissel",
        message:
          "Een **nieuwe wagen** wordt standaard geleverd met **zomerbanden**.\n\n" +
          "Valt de levering in de **winterperiode** (1 oktober – 15 november)? " +
          "Maak dan **onmiddellijk** een afspraak voor de plaatsing van winterbanden.\n\n" +
          "Heb je nog geen winterbanden? Kies een erkend bandencentrum uit de lijst van je leasingmaatschappij. " +
          "Vermeld bij het maken van de afspraak **expliciet dat het om een nieuwe wagen gaat**.\n\n" +
          "**Kosten:** volledig ten laste van **AllPhi**.\n\n" +
          "⚠️ Bij een laattijdige wissel wordt een forfait van **€ 150,00** aangerekend." +
          LEASING_LINKS,
        suggestions: ["Oké", "Stop"],
        flow: { id: "tire_change", step: 3, answers: { ...answers, scenario } },
      };
    }

    // ── Huurwagen → stap 2: Mercedes of niet?
    return {
      intent: "tire_change",
      title: "Bandenwissel",
      message: "Rij je met een **Mercedes** als huurwagen?",
      suggestions: ["Ja, Mercedes", "Nee, ander merk", "Stop"],
      flow: { id: "tire_change", step: 2, answers: { ...answers, scenario } },
    };
  }

  // ── Stap 2: Seizoen (normale bandenwissel) of Mercedes-vraag (huurwagen) ──
  if (step === 2) {
    const scenario = answers.scenario ?? "normaal";

    // Normale bandenwissel: seizoensrichting
    if (scenario === "normaal") {
      const season =
        normalized.includes("zomer") && normalized.includes("winter")
          ? "zomer_naar_winter"
          : normalized.includes("winter") && normalized.includes("zomer")
            ? "winter_naar_zomer"
            : normalized.includes("zomer")
              ? "zomer_naar_winter"
              : normalized.includes("winter")
                ? "winter_naar_zomer"
                : null;

      if (!season) {
        return {
          intent: "tire_change",
          title: "Bandenwissel",
          message: "Gaat het om **zomer → winter** of **winter → zomer**?",
          suggestions: ["Zomer → winter", "Winter → zomer"],
          flow: { id: "tire_change", step: 2, answers },
        };
      }

      const seizoenlijn =
        season === "zomer_naar_winter"
          ? "Je wisselt naar **winterbanden** (periode: 1 oktober – 15 november)."
          : "Je wisselt naar **zomerbanden** (periode: 31 maart – 15 mei).";

      return {
        intent: "tire_change",
        title: "Bandenwissel",
        message:
          `${seizoenlijn}\n\n` +
          "Plan je afspraak via jouw leasingpartner.\n\n" +
          "**Kosten:** volledig ten laste van **AllPhi**.\n\n" +
          "⚠️ Bij een laattijdige wissel wordt een forfait van **€ 150,00** aangerekend." +
          LEASING_LINKS,
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }

    // Huurwagen: Mercedes of niet?
    if (scenario === "huurwagen") {
      const isMercedes =
        normalized.includes("mercedes") ||
        normalized.includes("ja") ||
        normalized.includes("zeker");
      const isNietMercedes =
        normalized.includes("nee") ||
        normalized.includes("ander") ||
        normalized.includes("geen mercedes");

      if (!isMercedes && !isNietMercedes) {
        return {
          intent: "tire_change",
          title: "Bandenwissel",
          message: "Is het een **Mercedes** (ja/nee)?",
          suggestions: ["Ja, Mercedes", "Nee, ander merk", "Stop"],
          flow: { id: "tire_change", step: 2, answers },
        };
      }

      // ── Huurwagen Mercedes
      if (isMercedes && !isNietMercedes) {
        return {
          intent: "tire_change",
          title: "Bandenwissel",
          message:
            "Stuur een e-mail naar Fleet via **fleet@allphi.eu** met:\n\n" +
            "- het gewenste **Hedin-garage**\n" +
            "- de **bandenmaat** (te vinden op de band of in het portier)\n" +
            "- het **bandenmerk** (te vinden op de band zelf)\n\n" +
            "Via [deze link](https://www.hedin.eu/nl-be/garage) vind je een overzicht van de mogelijke Hedin-garages.\n\n" +
            "**Kosten:** volledig ten laste van **AllPhi**.\n\n" +
            "⚠️ Bij een laattijdige wissel wordt een forfait van **€ 150,00** aangerekend.\n\n" +
            "Waar kan ik je nog mee helpen?",
          suggestions: DEFAULT_SUGGESTIONS,
        };
      }

      // ── Huurwagen ander merk dan Mercedes
      return {
        intent: "tire_change",
        title: "Bandenwissel",
        message:
          "Bij een huurwagen van een **ander merk dan Mercedes** bezorgt **Fleet** je de nodige informatie.\n\n" +
          "Stuur een e-mail naar **fleet@allphi.eu** met je nummerplaat en het gewenste bandencentrum.\n\n" +
          "**Kosten:** volledig ten laste van **AllPhi**.\n\n" +
          "⚠️ Bij een laattijdige wissel wordt een forfait van **€ 150,00** aangerekend.\n\n" +
          "Waar kan ik je nog mee helpen?",
        suggestions: DEFAULT_SUGGESTIONS,
      };
    }
  }

  // ── Stap 3: Afsluitende berichten (eerste wissel / nieuwe wagen) ──────────
  if (step >= 3) {
    return {
      intent: "tire_change",
      title: "Bandenwissel",
      message: "Oké. Waar kan ik je nog mee helpen?",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  // Fallback
  return {
    intent: "tire_change",
    title: "Bandenwissel",
    message:
      "Ik ben even de draad kwijt in de bandenwissel-flow. Zullen we opnieuw beginnen?",
    suggestions: ["Ik wil een bandenwissel doen", ...DEFAULT_SUGGESTIONS],
  };
}

function leaseReturnStepMessage(step: number): string {
  switch (step) {
    // ── Stap 1: Inlevering & afspraak (ongewijzigd) ───────────────────────
    case 1:
      return (
        "Op verzoek van je werkgever ben je verplicht om de wagen **in goede staat** " +
        "(met alle accessoires, aanpassingen en voorzieningen) terug te bezorgen op " +
        "een door de werkgever aangeduide locatie.\n\n" +
        "De datum, het tijdstip en de locatie worden afgesproken met het **expertisebureau**, " +
        "bij voorkeur in aanwezigheid van jou als medewerker."
      );

    // ── Stap 2: Verplichtingen medewerker (ongewijzigd) ───────────────────
    case 2:
      return (
        "### Verplichtingen van de medewerker\n\n" +
        "- Bezorg alle **boorddocumenten** terug.\n" +
        "- Lever alle **originele sleutels** in.\n" +
        "- Bij **uitdiensttreding**: geef ook de **tankkaart** terug.\n\n" +
        "### Banden\n\n" +
        "De wagen moet bij inlevering altijd voorzien zijn van het **correcte type banden**."
      );

    // ── Stap 3: Ontbrekende documenten/sleutels (ongewijzigd) ─────────────
    case 3:
      return (
        "### Ontbrekende documenten of sleutels\n\n" +
        "Voor ontbrekende documenten of sleutels wordt een kost aangerekend " +
        "volgens de **Renta-normen**."
      );

    // ── Stap 4: Expertise en schadecontrole (ongewijzigd) ────────────────
    case 4:
      return (
        "### Expertise en schadecontrole\n\n" +
        "Het expertisebureau beoordeelt alle schade volgens de **Renta-normen** en bezorgt daarna een **rapport** aan AllPhi."
      );

    // ── Stap 5: Procedure AllPhi – Fleet (AANGEPAST) ─────────────────────
    // Correctie 1: facturatie toegevoegd als expliciete stap
    case 5:
      return (
        "### Procedure door AllPhi – Fleet\n\n" +
        "- Schade die reeds aanwezig was bij ontvangst van de wagen wordt **niet** aangerekend.\n" +
        "- Alle vastgestelde schade wordt aangerekend zoals beschreven in **Eigen Risico**.\n" +
        "- Andere onaanvaardbare schade wordt voor **100%** doorgerekend aan de bestuurder.\n\n" +
        "Na verwerking van het rapport volgt de **facturatie** naar de medewerker " +
        "voor de aangerekende schade."
      );

    // ── Stap 6: Eindigt de lease? (AANGEPAST) ────────────────────────────
    // Correctie 2: voorkooprecht is conditioneel (enkel als lease eindigt)
    // Correctie 3: "AllPhi en/of leasemaatschappij behandelt aanvraag" toegevoegd
    case 6:
      return (
        "### Eindigt je leasecontract?\n\n" +
        "**Als je contract eindigt**, heb je na goedkeuring door de werkgever de " +
        "mogelijkheid om de wagen aan te kopen. In dat geval geldt het **voorkooprecht**.\n\n" +
        "### Aanvraag aankoop wagen\n\n" +
        "Wil je van het voorkooprecht gebruik maken? Dien dan **uiterlijk op de dag van " +
        "inlevering** een schriftelijke aanvraag in bij:\n\n" +
        "- de werkgever\n" +
        "en/of\n" +
        "- de leasingmaatschappij\n\n" +
        "**AllPhi en/of de leasingmaatschappij** behandelt vervolgens je aanvraag.\n\n" +
        "**Als je contract nog loopt**, is de procedure hiermee afgesloten."
      );
    default:
      return (
        "### Samenvatting\n\n" +
        "- Afspraak met expertisebureau (datum/tijd/locatie)\n" +
        "- Inleveren: boorddocumenten + originele sleutels (+ tankkaart bij uitdiensttreding)\n" +
        "- Correcte banden\n" +
        "- Expertise volgens Renta-normen → rapport naar AllPhi\n" +
        "- Verwerking door Fleet: bestaande schade niet aangerekend, eigen risico of 100% bij onaanvaardbare schade\n" +
        "- Facturatie naar medewerker voor aangerekende schade\n" +
        "- Optioneel: aankoop via voorkooprecht (schriftelijk uiterlijk op dag van inlevering)\n\n" +
        "Waar kan ik je nog mee helpen?"
      );
  }
}

export function handleLeaseReturnInspectionFlowStart(): ChatResponse {
  return {
    intent: "lease_return_inspection",
    title: "Leasewagen inleveren",
    message:
      "Ik begeleid je stap voor stap door de procedure **inleveren / inspectie van de leasewagen**.\n\n" +
      "Typ `stop` om te annuleren.",
    suggestions: ["Start", "Stop"],
    flow: { id: "lease_return_inspection", step: 1 },
  };
}

export function handleLeaseReturnInspectionFlowMessage(params: {
  userMessage: string;
  flow: {
    id: "lease_return_inspection";
    step: number;
    answers?: Record<string, string>;
  };
}): ChatResponse {
  const raw = params.userMessage ?? "";
  const user = raw.trim();
  const normalized = user.toLowerCase().trim();

  if (isCancelMessage(normalized)) {
    return {
      intent: "lease_return_inspection",
      title: "Leasewagen inleveren",
      message:
        "Oké — ik heb de inlever/inspectie-flow stopgezet.\n\nWaar kan ik je nog mee helpen?",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const step = Math.max(1, Number(params.flow.step ?? 1));
  const wantsPrev = isPrevMessage(normalized);
  const wantsNext = isNextMessage(normalized) || normalized === "start";

  // If the user typed something else, keep them on the current step with clear guidance.
  if (user.length > 0 && !wantsPrev && !wantsNext) {
    return {
      intent: "lease_return_inspection",
      title: "Leasewagen inleveren",
      message:
        `${leaseReturnStepMessage(step)}\n\n` +
        "Typ **Volgende** om verder te gaan, of **Stop** om te annuleren.",
      suggestions: ["Volgende", step > 1 ? "Vorige" : "Stop", "Stop"].filter(
        (v, i, a) => a.indexOf(v) === i
      ),
      flow: { id: "lease_return_inspection", step },
    };
  }

  const nextStep = wantsPrev ? Math.max(1, step - 1) : step + 1;

  // Steps 1..6, after that we show the summary and end the flow.
  if (nextStep <= 6) {
    return {
      intent: "lease_return_inspection",
      title: "Leasewagen inleveren",
      message:
        `${leaseReturnStepMessage(nextStep)}\n\n` +
        "Typ **Volgende** om verder te gaan, of **Stop** om te annuleren.",
      suggestions: ["Volgende", nextStep > 1 ? "Vorige" : "Stop", "Stop"].filter(
        (v, i, a) => a.indexOf(v) === i
      ),
      flow: { id: "lease_return_inspection", step: nextStep },
    };
  }

  return {
    intent: "lease_return_inspection",
    title: "Leasewagen inleveren",
    message: leaseReturnStepMessage(99),
    suggestions: ["Leasewagen inleveren", ...DEFAULT_SUGGESTIONS],
  };
}

export function handleTireChangeFlowStart(): ChatResponse {
  return {
    intent: "tire_change",
    title: "Bandenwissel",
    message:
      "Bij AllPhi staat jouw veiligheid centraal. Daarom is elke wagen uitgerust met **winterbanden**: " +
      "bij minder gunstige weersomstandigheden (< 7°C) zorgen winterbanden voor een kortere remafstand en betere grip.\n\n" +
      "**Wanneer wisselen?**\n" +
      "- Zomerbanden → Winterbanden: tussen **1 oktober en 15 november**\n" +
      "- Winterbanden → Zomerbanden: tussen **31 maart en 15 mei**\n\n" +
      "⚠️ Bij een **laattijdige** bandenwissel wordt een forfait van **€ 150,00** aangerekend.\n\n" +
      "Wat is je situatie?",
    suggestions: [
      "Normale bandenwissel",
      "Eerste bandenwissel / bandenverplaatsing",
      "Nieuwe wagen",
      "Huurwagen",
    ],
    flow: { id: "tire_change", step: 1 },
  };
}

const EIGEN_RISICO_INFO =
  "\n\n**Eigen risico (franchise):**\n" +
  "- **Niveau 1:** 20% van €600 = **€120**\n" +
  "- **Niveau 2:** 50% van €600 = **€300**\n" +
  "- **Niveau 3:** 100% van €600 = **€600**\n\n" +
  "Iedereen start op Niveau 1 per kalenderjaar en stijgt per schadegeval. " +
  "Op 1 januari zakt men automatisch één niveau.\n\n" +
  "⚠️ **Altijd 100% ten laste van de medewerker bij:**\n" +
  "- Schade die pas bij inname wordt vastgesteld en vooraf niet gemeld is\n" +
  "- Grove nalatigheid (rijden onder invloed, versleten banden, negeren oliepeil)";

const MELDING_INFO =
  "⏱️ **48-uurs regel:** elk incident moet binnen 48 uur gemeld worden om volledige dekking te garanderen.\n\n" +
  "🚗 **Vervangwagen:** enkel als de herstelling langer duurt dan 24 uur (in België) of 48 uur (in het buitenland).";

export function handleAccidentReportFlowStart(): ChatResponse {
  return {
    intent: "accident_report",
    title: "Incident melden",
    message:
      "Hopelijk is iedereen veilig. Ik help je stap voor stap.\n\n" +
      "**Wat is er gebeurd?**\n\n" +
      "- 🚗 **Aanrijding** met een andere partij\n" +
      "- 🔨 **Eenzijdige schade** (paaltje, parkeerschade, …)\n" +
      "- 🪟 **Glasbreuk** (ruit kapot)\n" +
      "- 🔓 **Vandalisme, inbraak of diefstal**\n\n" +
      "Typ `stop` om te annuleren.",
    suggestions: [
      "Aanrijding",
      "Eenzijdige schade",
      "Glasbreuk",
      "Vandalisme / Inbraak / Diefstal",
    ],
    flow: { id: "accident_report", step: 1 },
  };
}

export function handleAccidentReportFlowMessage(params: {
  userMessage: string;
  flow: { id: "accident_report"; step: number; answers?: Record<string, string> };
}): ChatResponse {
  const raw = params.userMessage ?? "";
  const user = raw.trim();
  const normalized = user.toLowerCase().trim();

  if (isCancelMessage(normalized)) {
    return {
      intent: "accident_report",
      title: "Incident melden",
      message:
        "Oké — ik heb de meldingsflow stopgezet.\n\nWaar kan ik je nog mee helpen?",
      suggestions: DEFAULT_SUGGESTIONS,
    };
  }

  const step = Number(params.flow.step ?? 1);
  const answers = params.flow.answers ?? {};

  // ── Stap 1: Type incident ───────────────────────────────────────────────
  if (step <= 1) {
    const type =
      normalized.includes("aanrijding") ||
      normalized.includes("tegenpartij") ||
      normalized.includes("botsing") ||
      normalized.includes("andere partij")
        ? "aanrijding"
        : normalized.includes("eenzijdig") ||
            normalized.includes("paaltje") ||
            normalized.includes("parkeer") ||
            normalized.includes("muur") ||
            normalized.includes("spiegel") ||
            normalized.includes("bumper")
          ? "eenzijdig"
          : normalized.includes("glas") ||
              normalized.includes("ruit") ||
              normalized.includes("carglass")
            ? "glasbreuk"
            : normalized.includes("vandal") ||
                normalized.includes("inbraak") ||
                normalized.includes("diefstal") ||
                normalized.includes("gestolen") ||
                normalized.includes("ingebroken")
              ? "vandalisme"
              : null;

    if (!type) {
      return {
        intent: "accident_report",
        title: "Incident melden",
        message:
          "Wat is er precies gebeurd?\n\n" +
          "- 🚗 **Aanrijding** met een andere partij\n" +
          "- 🔨 **Eenzijdige schade** (paaltje, parkeerschade, …)\n" +
          "- 🪟 **Glasbreuk** (ruit kapot)\n" +
          "- 🔓 **Vandalisme, inbraak of diefstal**",
        suggestions: [
          "Aanrijding",
          "Eenzijdige schade",
          "Glasbreuk",
          "Vandalisme / Inbraak / Diefstal",
        ],
        flow: { id: "accident_report", step: 1, answers },
      };
    }

    if (type === "glasbreuk") {
      return {
        intent: "accident_report",
        title: "Glasbreuk",
        message:
          "Bij **glasbreuk** contacteer je een erkende hersteller, zoals **Carglass**.\n\n" +
          "✅ **Geen eigen risico (franchise)** van toepassing bij glasbreuk.\n\n" +
          MELDING_INFO,
        suggestions: ["Meld ook via Fleet App", ...DEFAULT_SUGGESTIONS],
      };
    }

    if (type === "vandalisme") {
      return {
        intent: "accident_report",
        title: "Vandalisme / Inbraak / Diefstal",
        message:
          "Bij **vandalisme, inbraak of diefstal:**\n\n" +
          "1. Doe **direct aangifte bij de politie** en noteer het **PV-nummer**.\n" +
          "2. Maak **foto's** van de schade.\n" +
          "3. Meld het incident met het PV-nummer via de **Fleet App** (binnen 48 uur).\n\n" +
          MELDING_INFO +
          EIGEN_RISICO_INFO,
        suggestions: ["Meld incident via Fleet App", ...DEFAULT_SUGGESTIONS],
        cta: { label: "Meld incident via Fleet App", href: "/ongeval" },
      };
    }

    if (type === "eenzijdig") {
      return {
        intent: "accident_report",
        title: "Eenzijdige schade",
        message:
          "Bij **eenzijdige schade** (paaltje, parkeerschade, …):\n\n" +
          "1. Maak **duidelijke foto's** van de schade.\n" +
          "2. Vul alsnog een **aanrijdingsformulier** in als bewijsmateriaal (ook zonder tegenpartij).\n" +
          "3. Meld de schade binnen **48 uur** via de Fleet App.\n\n" +
          MELDING_INFO +
          EIGEN_RISICO_INFO,
        suggestions: ["Open aanrijdingsformulier", ...DEFAULT_SUGGESTIONS],
        cta: { label: "Open aanrijdingsformulier", href: "/ongeval" },
      };
    }

    return {
      intent: "accident_report",
      title: "Aanrijding",
      message: "**Zijn er gewonden?**",
      suggestions: ["Ja, er zijn gewonden", "Nee, geen gewonden"],
      flow: { id: "accident_report", step: 2, answers: { ...answers, type } },
    };
  }

  // ── Stap 2: Gewonden? ────────────────────────────────────────────────────
  if (step === 2) {
    const gewonden =
      normalized.includes("ja") ||
      normalized.includes("gewond") ||
      normalized.includes("letsel") ||
      normalized.includes("ziekenhuis")
        ? true
        : normalized.includes("nee") || normalized.includes("geen")
          ? false
          : null;

    if (gewonden === null) {
      return {
        intent: "accident_report",
        title: "Aanrijding",
        message: "Zijn er **gewonden** bij het incident?",
        suggestions: ["Ja, er zijn gewonden", "Nee, geen gewonden"],
        flow: { id: "accident_report", step: 2, answers },
      };
    }

    if (gewonden) {
      return {
        intent: "accident_report",
        title: "Aanrijding — Gewonden",
        message:
          "🚨 **Bel onmiddellijk 112** (hulpdiensten + politie).\n\n" +
          "Vraag de politie om een **officieel verslag (PV)** op te maken.\n\n" +
          "Daarna:\n" +
          "1. Maak **foto's** van schade aan alle voertuigen en de omgeving.\n" +
          "2. Vul het **Europees Aanrijdingsformulier** in via de app.\n" +
          "3. Meld het voorval binnen **48 uur** via de Fleet App.\n\n" +
          "⚠️ Dit incident wordt **automatisch geëscaleerd** naar je fleet manager (gewonden = verplichte escalatie).\n\n" +
          MELDING_INFO +
          EIGEN_RISICO_INFO,
        suggestions: ["Open aanrijdingsformulier", ...DEFAULT_SUGGESTIONS],
        cta: { label: "Open aanrijdingsformulier", href: "/ongeval" },
      };
    }

    return {
      intent: "accident_report",
      title: "Aanrijding",
      message:
        "Goed, parkeer de wagen eerst **veilig**.\n\n" +
        "**Is de tegenpartij aanwezig/gekend?**",
      suggestions: ["Ja, tegenpartij is aanwezig", "Nee, vluchtmisdrijf"],
      flow: {
        id: "accident_report",
        step: 3,
        answers: { ...answers, gewonden: "nee" },
      },
    };
  }

  // ── Stap 3: Tegenpartij aanwezig? ────────────────────────────────────────
  if (step === 3) {
    const tegenpartij =
      normalized.includes("ja") ||
      normalized.includes("aanwezig") ||
      normalized.includes("gekend")
        ? true
        : normalized.includes("nee") ||
            normalized.includes("vlucht") ||
            normalized.includes("weggereden")
          ? false
          : null;

    if (tegenpartij === null) {
      return {
        intent: "accident_report",
        title: "Aanrijding",
        message: "Is de **tegenpartij aanwezig of gekend**?",
        suggestions: ["Ja, tegenpartij is aanwezig", "Nee, vluchtmisdrijf"],
        flow: { id: "accident_report", step: 3, answers },
      };
    }

    if (!tegenpartij) {
      return {
        intent: "accident_report",
        title: "Vluchtmisdrijf",
        message:
          "Bij een **vluchtmisdrijf**:\n\n" +
          "1. Doe **onmiddellijk aangifte bij de politie** en vraag een officieel PV.\n" +
          "2. Bezorg het **PV-nummer** aan AllPhi.\n" +
          "3. Maak **foto's** van de schade en de omgeving.\n" +
          "4. Meld het voorval binnen **48 uur** via de Fleet App.\n\n" +
          MELDING_INFO +
          EIGEN_RISICO_INFO,
        suggestions: ["Open aanrijdingsformulier", ...DEFAULT_SUGGESTIONS],
        cta: { label: "Open aanrijdingsformulier", href: "/ongeval" },
      };
    }

    return {
      intent: "accident_report",
      title: "Aanrijding",
      message:
        "**Moet de politie gebeld worden?**\n\n" +
        "Bel de politie als de tegenpartij:\n" +
        "- weigert te tekenen\n" +
        "- een vluchtmisdrijf pleegt\n" +
        "- onder invloed lijkt",
      suggestions: ["Ja, politie bellen", "Nee, politie niet nodig"],
      flow: { id: "accident_report", step: 4, answers: { ...answers, tegenpartij: "ja" } },
    };
  }

  // ── Stap 4: Crashform + takeldienst ───────────────────────────────────────
  if (step >= 4) {
    const politie =
      normalized.includes("ja") ||
      normalized.includes("politie") ||
      normalized.includes("weigert") ||
      normalized.includes("onder invloed");

    const politieInstructie = politie
      ? "📞 **Bel 112** (hulpdiensten + politie) en vraag een officieel **PV**.\n\n"
      : "";

    return {
      intent: "accident_report",
      title: "Aanrijding — Crashform",
      message:
        politieInstructie +
        "**Vul het Europees Aanrijdingsformulier in:**\n\n" +
        "**Crashform flow:**\n" +
        "1. Scan de **QR-code** op het verzekeringsbewijs\n" +
        "2. Selecteer de **ongevalssituatie** (manoeuvre, voorrang, …)\n" +
        "3. Voeg **foto's** toe van alle voertuigen en de omgeving\n" +
        "4. **Beide partijen digitaal ondertekenen**\n\n" +
        "**Is de wagen nog rijvaardig?**\n" +
        "- **Nee:** Bel de geautoriseerde **takeldienst** (gegevens in boorddocumenten).\n" +
        "- **Ja:** Wacht op instructies van AllPhi of de leasemaatschappij.\n\n" +
        MELDING_INFO +
        EIGEN_RISICO_INFO,
      suggestions: ["Open aanrijdingsformulier", ...DEFAULT_SUGGESTIONS],
      cta: { label: "Open aanrijdingsformulier", href: "/ongeval" },
    };
  }

  return {
    intent: "accident_report",
    title: "Incident melden",
    message: "Laten we opnieuw beginnen. Wat is er gebeurd?",
    suggestions: [
      "Aanrijding",
      "Eenzijdige schade",
      "Glasbreuk",
      "Vandalisme / Inbraak / Diefstal",
    ],
    flow: { id: "accident_report", step: 1 },
  };
}

export async function handleIntent(
  intent: ChatIntent,
  email: string,
  voornaam?: string
): Promise<ChatResponse> {
  switch (intent) {
    case "new_car_order": {
      return {
        intent: "new_car_order",
        title: "Nieuwe wagen bestellen",
        message:
          "Ik help je met de **bestelprocedure voor een nieuwe wagen**: van modelkeuze en offerte, tot controle, eventuele persoonlijke bijdrage en goedkeuring.\n\n" +
          "Tik op de knop hieronder om te starten.",
        suggestions: DEFAULT_SUGGESTIONS,
        cta: { label: "Start bestelling nieuwe wagen", href: "/wagen-bestellen" },
      };
    }
    case "my_vehicle": {
      const ctx = await getMyVehicleContextByEmail(email);
      return formatVehicleResponse(ctx);
    }
    case "my_contract": {
      const ctx = await getMyContractByEmail(email);
      return formatContractResponse(ctx);
    }
    case "my_documents": {
      const docs = await getMyDocumentsByEmail(email);
      if (docs.length > 0) return formatDocumentsResponse(docs);

      const ctx = await getMyVehicleContextByEmail(email);
      const hasVehicle = Boolean(
        (ctx?.vin && String(ctx.vin).trim()) ||
          (ctx?.merk_model && String(ctx.merk_model).trim()) ||
          (ctx?.nummerplaat && String(ctx.nummerplaat).trim()),
      );

      if (!hasVehicle) {
        return {
          intent: "my_documents",
          title: "Documenten",
          message:
            "Ik kon geen **actief leasevoertuig** vinden dat aan jouw profiel gekoppeld is.\n\n" +
            "Daardoor kan ik je voertuigdokumenten (zoals groene kaart/offerte) niet ophalen. Neem even contact op met je **fleet manager** om je wagen te koppelen.",
          suggestions: ["Mijn wagen", "Mijn contract"],
        };
      }

      return {
        intent: "my_documents",
        title: "Documenten",
        message:
          "Ik zie momenteel **geen voertuigspecifieke documenten** (zoals een offerte) in het systeem voor jouw wagen.\n\n" +
          "Je kan wel deze documenten proberen te openen (als ze beschikbaar zijn):",
        cards: [
          {
            type: "document",
            title: "Groene kaart",
            fields: [
              { label: "Type", value: "GROENE_KAART" },
              { label: "Link", value: "/api/insurance/green-card" },
            ],
          },
          {
            type: "document",
            title: "Verzekeringsattest",
            fields: [
              { label: "Type", value: "VERZEKERINGSATTEST" },
              { label: "Link", value: "/api/insurance/attest" },
            ],
          },
          {
            type: "document",
            title: "Mijn documenten",
            fields: [{ label: "Open", value: "/documenten" }],
          },
        ],
        cta: { label: "Open mijn documenten", href: "/documenten" },
        suggestions: ["Mijn wagen", "Mijn contract"],
      };
    }
    case "allowed_options": {
      const options = await getAllowedVehicleOptionsByEmail(email);
      return formatAllowedOptionsResponse(options);
    }
    case "best_range_option": {
      const best = await getBestRangeOptionByEmail(email);
      return formatBestRangeResponse(best);
    }
    case "charging_summary": {
      const summary = await getChargingSummaryByEmail(email);
      return formatChargingSummaryResponse(summary);
    }
    case "charging_home_vs_public": {
      const breakdowns = await getChargingHomeVsPublicByEmail(email);
      return formatChargingComparisonResponse(breakdowns);
    }
    case "reimbursement_status": {
      const status = await getReimbursementStatusByEmail(email);
      return formatReimbursementResponse(status);
    }
    case "insurance_certificate": {
      const ctx = await getMyVehicleContextByEmail(email);
      return formatInsuranceCertificateResponse(ctx);
    }
    case "accident_report":
      return handleAccidentReportFlowStart();
    case "tire_change":
      return handleTireChangeFlowStart();
    case "lease_return_inspection":
      return handleLeaseReturnInspectionFlowStart();
    case "greeting":
      return formatGreeting(voornaam);
    case "acknowledgment":
      return {
        intent: "acknowledgment",
        title: "Begrepen",
        message: "Geen probleem! Laat het me weten als ik je ergens mee kan helpen.",
        suggestions: DEFAULT_SUGGESTIONS,
      };

    // ── Manager intents (stubs) ──
    case "fleet_overview":
    case "expiring_contracts":
    case "charging_cost_overview":
    case "top_cost_drivers":
    case "home_vs_public_fleet":
    case "open_reimbursements_fleet":
    case "non_compliant_assignments":
      return formatManagerStub(intent);

    case "unknown":
    default:
      return formatUnknown();
  }
}

function formatGreeting(voornaam?: string): ChatResponse {
  const name = voornaam ? `, ${voornaam}` : "";
  return {
    intent: "greeting",
    title: "Welkom",
    message: `Hallo${name}! Ik ben je Fleet Companion. Hoe kan ik je helpen?\n\nJe kunt me vragen stellen over je wagen, contract, documenten, laadkosten of beschikbare voertuigopties.`,
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

function formatUnknown(): ChatResponse {
  return {
    intent: "unknown",
    title: "Niet herkend",
    message:
      "Ik kan je daar nog niet goed mee helpen. Je kan me bijvoorbeeld vragen naar je wagen, documenten, contract, laadkosten of beschikbare wagens.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

function formatManagerStub(intent: ChatIntent): ChatResponse {
  return {
    intent,
    title: "Fleet Manager",
    message:
      "Deze functie is momenteel nog in ontwikkeling voor fleet managers. Neem contact op met je fleet manager voor dit type informatie.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}
