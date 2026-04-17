import type { SituationCategoryId } from "@/types/ongeval";

export type SituationOption = {
  id: string;
  title: string;
  description: string;
};

export const SITUATION_CATEGORIES: Array<{
  id: SituationCategoryId;
  title: string;
  description: string;
}> = [
  {
    id: "parking",
    title: "Parkeerstand",
    description: "Botsing met een geparkeerd voertuig.",
  },
  {
    id: "rear_end",
    title: "Aanrijding achteraan",
    description: "Op een voertuig voor u.",
  },
  {
    id: "maneuver",
    title: "Manoeuvre",
    description: "Door een manoeuvre van één of beide partijen (achteruit, …).",
  },
  {
    id: "priority",
    title: "Weigering van voorrang",
    description: "Bij het niet verlenen van voorrang op kruispunt of rotonde.",
  },
  {
    id: "lane_change",
    title: "Verandering van file",
    description: "Door rijstrook- of filewissel, ook op rotonde.",
  },
  {
    id: "opposite",
    title: "Tegengestelde richtingen",
    description: "Tegenliggers waarbij één of beide de middenlijn overschrijden.",
  },
  {
    id: "door",
    title: "Openen portier",
    description: "Door open deur, achterklep of laadplatform.",
  },
  {
    id: "load",
    title: "Verlies van lading",
    description: "Door verlies van lading of deel van het voertuig.",
  },
];

export const REAR_END_OPTIONS: SituationOption[] = [
  {
    id: "a_rear",
    title: "Voertuig A is achteraan aangereden",
    description:
      "Beide voertuigen rijden op dezelfde rijstrook, dezelfde richting, de ene na de andere.",
  },
  {
    id: "b_rear",
    title: "Voertuig B is achteraan aangereden",
    description:
      "Beide voertuigen rijden op dezelfde rijstrook, dezelfde richting, de ene na de andere.",
  },
];

export const CENTER_LINE_OPTIONS: SituationOption[] = [
  {
    id: "a_crossed",
    title: "Voertuig A heeft de middenlijn overschreden",
    description: "… en is op de rijbaan gekomen voorbehouden voor voertuig B.",
  },
  {
    id: "b_crossed",
    title: "Voertuig B heeft de middenlijn overschreden",
    description: "… en is op de rijbaan gekomen voorbehouden voor voertuig A.",
  },
  {
    id: "both_crossed",
    title: "Beide voertuigen hebben de middenlijn overschreden",
    description: "… en zijn op de rijbaan gekomen voorbehouden voor het andere voertuig.",
  },
];

export const PRIORITY_OPTIONS: SituationOption[] = [
  {
    id: "a_yield_x",
    title: "Voertuig A: omgekeerde driehoek op kruispunt niet nageleefd",
    description: "",
  },
  {
    id: "b_yield_x",
    title: "Voertuig B: omgekeerde driehoek op kruispunt niet nageleefd",
    description: "",
  },
  {
    id: "a_stop_x",
    title: "Voertuig A: stopteken op kruispunt niet nageleefd",
    description: "",
  },
  {
    id: "b_stop_x",
    title: "Voertuig B: stopteken op kruispunt niet nageleefd",
    description: "",
  },
  {
    id: "a_yield_round",
    title: "Voertuig A: omgekeerde driehoek op rotonde niet nageleefd",
    description: "",
  },
  {
    id: "b_yield_round",
    title: "Voertuig B: omgekeerde driehoek op rotonde niet nageleefd",
    description: "",
  },
];

export const MANEUVER_A_OPTIONS: SituationOption[] = [
  { id: "a_rev", title: "Voertuig A rijdt achteruit", description: "" },
  {
    id: "a_leave_park",
    title: "Voertuig A verliet een parkeerplaats",
    description: "",
  },
  {
    id: "a_leave_private",
    title: "Voertuig A verliet een private weg",
    description: "",
  },
  { id: "a_turn_back", title: "Voertuig A draaide terug", description: "" },
];

export const MANEUVER_B_OPTIONS: SituationOption[] = [
  { id: "b_rev", title: "Voertuig B rijdt achteruit", description: "" },
  {
    id: "b_leave_park",
    title: "Voertuig B verliet een parkeerplaats",
    description: "",
  },
  {
    id: "b_leave_private",
    title: "Voertuig B verliet een private weg",
    description: "",
  },
  { id: "b_turn", title: "Voertuig B draaide om", description: "" },
];

export const LANE_CHANGE_OPTIONS: SituationOption[] = [
  {
    id: "a_lane",
    title: "Voertuig A wisselde van rijstrook of file",
    description: "",
  },
  {
    id: "b_lane",
    title: "Voertuig B wisselde van rijstrook of file",
    description: "",
  },
  {
    id: "both_lane",
    title: "Beide voertuigen wisselden gelijktijdig",
    description: "",
  },
];

export function getSituationCategoryLabel(
  id: SituationCategoryId | null,
): string {
  if (!id) return "";
  return SITUATION_CATEGORIES.find((c) => c.id === id)?.title ?? "";
}

export function getSituationDetailLabel(
  category: SituationCategoryId | null,
  detailKey: string | null,
): string {
  if (!category || !detailKey) return "";
  const pool: SituationOption[] = (() => {
    switch (category) {
      case "rear_end":
        return REAR_END_OPTIONS;
      case "opposite":
        return CENTER_LINE_OPTIONS;
      case "priority":
        return PRIORITY_OPTIONS;
      case "maneuver":
        return [...MANEUVER_A_OPTIONS, ...MANEUVER_B_OPTIONS];
      case "lane_change":
        return LANE_CHANGE_OPTIONS;
      case "parking":
      case "door":
      case "load":
        return GENERIC_SINGLE[category] ?? [];
      default:
        return [];
    }
  })();
  return pool.find((o) => o.id === detailKey)?.title ?? "";
}

export function getManeuverLabel(
  party: "A" | "B",
  key: string | null,
): string {
  if (!key) return "";
  const pool = party === "A" ? MANEUVER_A_OPTIONS : MANEUVER_B_OPTIONS;
  return pool.find((o) => o.id === key)?.title ?? "";
}

export const GENERIC_SINGLE: Record<
  SituationCategoryId,
  SituationOption[] | null
> = {
  parking: [
    {
      id: "park_moving",
      title: "Botsing met stilstaand voertuig",
      description: "",
    },
    {
      id: "park_opening",
      title: "Botsing bij het wegrijden van een parkeerplaats",
      description: "",
    },
  ],
  rear_end: null,
  maneuver: null,
  priority: null,
  lane_change: null,
  opposite: null,
  door: [
    {
      id: "door_a",
      title: "Portier van voertuig A werd geopend",
      description: "",
    },
    {
      id: "door_b",
      title: "Portier van voertuig B werd geopend",
      description: "",
    },
  ],
  load: [
    {
      id: "load_a",
      title: "Lading van voertuig A",
      description: "",
    },
    {
      id: "load_b",
      title: "Lading van voertuig B",
      description: "",
    },
  ],
};
