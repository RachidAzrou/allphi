export interface Medewerker {
  id: string;
  email: string;
  voornaam: string;
  achternaam: string;
  categorie?: string;
  afdeling?: string;
  created_at?: string;
}

export interface FleetAssistantContext {
  medewerker_id: string;
  medewerker_email: string;
  medewerker_voornaam: string;
  medewerker_achternaam: string;
  medewerker_categorie?: string;
  medewerker_afdeling?: string;
  voertuig_id?: string;
  merk?: string;
  model?: string;
  nummerplaat?: string;
  brandstoftype?: string;
  aandrijving?: string;
  range_km?: number;
  kleur?: string;
  bouwjaar?: number;
  contract_id?: string;
  contract_type?: string;
  contract_status?: string;
  contract_startdatum?: string;
  contract_einddatum?: string;
  goedkeuringsstatus?: string;
  maandelijks_budget?: number;
  documenten?: DocumentInfo[];
}

export interface DocumentInfo {
  document_id: string;
  document_type: string;
  bestandsnaam: string;
  upload_datum?: string;
  url?: string;
}

export interface AllowedVehicleOption {
  voertuig_id: string;
  merk: string;
  model: string;
  variant?: string;
  brandstoftype?: string;
  aandrijving?: string;
  range_km?: number;
  catalogusprijs?: number;
  maandelijks_budget?: number;
  optiebudget?: number;
  beschikbaar: boolean;
  categorie?: string;
}

export interface ChargingSession {
  sessie_id: string;
  medewerker_id: string;
  datum: string;
  locatie_type: "thuis" | "publiek" | "werk" | string;
  kwh: number;
  kosten: number;
  duur_minuten?: number;
  laadpunt?: string;
}

export interface ChargingSummary {
  totaal_sessies: number;
  totaal_kwh: number;
  totale_kosten: number;
  gemiddelde_kosten_per_sessie: number;
  gemiddelde_kwh_per_sessie: number;
}

export interface ChargingHomeVsPublic {
  thuis_sessies: number;
  thuis_kwh: number;
  thuis_kosten: number;
  publiek_sessies: number;
  publiek_kwh: number;
  publiek_kosten: number;
}
