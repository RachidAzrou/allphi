import type { OngevalStepId } from "@/types/ongeval";

/** Optionele instructies per stap (kunnen worden weggeklikt). */
export const STEP_BANNERS: Partial<Record<OngevalStepId, string>> = {
  incident_kind:
    "Meld elk incident binnen 48 uur om de dekking te garanderen.",
  safety_police:
    "Bij gewonden: bel onmiddellijk 112. Bel de politie bij weigering te tekenen, vluchtmisdrijf of vermoeden van invloed.",
  vehicle_mobility:
    "Indien de wagen niet meer mobiel is: bel de geautoriseerde takeldienst (zie boorddocumenten) en volg de instructies van AllPhi/leasemaatschappij.",
  franchise:
    "Eigen risico wordt berekend op basis van medewerkersniveau. Bij lagere herstelkost dan €600 geldt het percentage op de werkelijke kost.",
  escalation:
    "Escalatie gebeurt bij gewonden, complexe schade, onzekere aansprakelijkheid of vermoeden grove nalatigheid.",
  circumstances_manual:
    "Optioneel — laat leeg als je niets wil toevoegen aan sectie 14 van het formulier.",
  vehicle_contact:
    "Indien er contact geweest is tussen de voertuigen dan zal elke partij het raakpunt op zijn voertuig moeten aanduiden.",
  signature_a:
    "Na ondertekening wordt de aangifte automatisch overgemaakt aan je verzekeraar.",
  signature_b:
    "Na ondertekening wordt de aangifte automatisch overgemaakt aan je verzekeraar.",
};
