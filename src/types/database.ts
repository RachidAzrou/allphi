// ──────────────────────────────────────────────
// v_fleet_assistant_context
// ──────────────────────────────────────────────
export interface FleetAssistantContext {
  medewerker_id: string;
  voornaam: string;
  naam: string;
  emailadres: string;
  vin?: string;
  nummerplaat?: string;
  afleverdatum?: string;
  contracteinddatum?: string;
  leasingmaatschappij?: string;
  wagen_categorie?: string;
  catalog_id?: string;
  brand?: string;
  edition?: string;
  merk_model?: string;
  aandrijving?: string;
  range_km?: number;
  cat_a?: number;
  cat_b?: number;
  cat_c?: number;
  optiebudget_a?: number;
  optiebudget_b?: number;
  optiebudget_c?: number;
  contract_id?: string;
  tco_plafond?: number;
  optiebudget?: number;
  goedkeuringsstatus?: string;
  document_type?: string;
  document_url?: string;
}

// ──────────────────────────────────────────────
// v_allowed_vehicle_options
// ──────────────────────────────────────────────
export interface AllowedVehicleOption {
  medewerker_id: string;
  voornaam: string;
  naam: string;
  emailadres: string;
  medewerker_categorie?: string;
  catalog_id?: string;
  brand?: string;
  edition?: string;
  merk_model: string;
  aandrijving?: string;
  range_km?: number;
  optiebudget_voor_medewerker?: number;
}

// ──────────────────────────────────────────────
// charging_sessions
// ──────────────────────────────────────────────
export interface ChargingSession {
  sessie_id: string;
  medewerker_id: string;
  voertuig_vin?: string;
  laadpas_id?: string;
  charging_point_id?: string;
  datumtijd_start: string;
  datumtijd_einde?: string;
  kwh: number;
  kost_eur: number;
  locatie_type: string;
  terugbetaald: boolean;
  created_at?: string;
}

// ──────────────────────────────────────────────
// v_charging_sessions_overview
// ──────────────────────────────────────────────
export interface ChargingSessionOverview {
  sessie_id: string;
  datumtijd_start: string;
  datumtijd_einde?: string;
  kwh: number;
  kost_eur: number;
  locatie_type: string;
  terugbetaald: boolean;
  laadpas_id?: string;
  charging_point_id?: string;
  medewerker_id: string;
  voornaam: string;
  naam: string;
  emailadres: string;
  vin?: string;
  nummerplaat?: string;
  merk_model?: string;
  aandrijving?: string;
}

// ──────────────────────────────────────────────
// Aggregated result types
// ──────────────────────────────────────────────
export interface ChargingSummary {
  aantal_sessies: number;
  totaal_kwh: number;
  totaal_kost: number;
  gemiddelde_kost_per_sessie: number;
}

export interface ChargingLocationBreakdown {
  locatie_type: string;
  aantal_sessies: number;
  totaal_kwh: number;
  totaal_kost: number;
}

export interface ReimbursementStatus {
  aantal_open: number;
  open_bedrag: number;
  aantal_betaald: number;
  betaald_bedrag: number;
}

// ──────────────────────────────────────────────
// chat (persistent history — see supabase/migrations)
// ──────────────────────────────────────────────
export interface ChatConversationRow {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  attachments: unknown;
  metadata: unknown;
  created_at: string;
}
