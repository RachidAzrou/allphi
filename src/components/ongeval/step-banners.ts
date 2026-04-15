import type { OngevalStepId } from "@/types/ongeval";

/** Optionele instructies per stap (kunnen worden weggeklikt). */
export const STEP_BANNERS: Partial<Record<OngevalStepId, string>> = {
  proposal_intro:
    "Hieronder vind je een voorstel voor de aangifte met vooraf aangevinkte omstandigheden in sectie 12 en opmerkingen in sectie 14.",
  vehicle_contact:
    "Indien er contact geweest is tussen de voertuigen dan zal elke partij het raakpunt op zijn voertuig moeten aanduiden.",
  signature_a_intro:
    "Na ondertekening wordt de aangifte automatisch overgemaakt aan je verzekeraar.",
  signature_b_intro:
    "Na ondertekening wordt de aangifte automatisch overgemaakt aan je verzekeraar.",
};
