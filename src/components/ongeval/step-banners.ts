import type { OngevalStepId } from "@/types/ongeval";

/** Optionele instructies per stap (kunnen worden weggeklikt). */
export const STEP_BANNERS: Partial<Record<OngevalStepId, string>> = {
  circumstances_manual:
    "Optioneel — laat leeg als je niets wil toevoegen aan sectie 14 van het formulier.",
  vehicle_contact:
    "Indien er contact geweest is tussen de voertuigen dan zal elke partij het raakpunt op zijn voertuig moeten aanduiden.",
  signature_a:
    "Na ondertekening wordt de aangifte automatisch overgemaakt aan je verzekeraar.",
  signature_b:
    "Na ondertekening wordt de aangifte automatisch overgemaakt aan je verzekeraar.",
};
