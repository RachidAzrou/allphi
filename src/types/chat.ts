// ──────────────────────────────────────────────
// Intents
// ──────────────────────────────────────────────
export type ChatIntent =
  | "my_vehicle"
  | "my_contract"
  | "my_documents"
  | "allowed_options"
  | "best_range_option"
  | "charging_summary"
  | "charging_home_vs_public"
  | "reimbursement_status"
  | "accident_report"
  | "greeting"
  // Manager intents (stubs)
  | "fleet_overview"
  | "expiring_contracts"
  | "charging_cost_overview"
  | "top_cost_drivers"
  | "home_vs_public_fleet"
  | "open_reimbursements_fleet"
  | "non_compliant_assignments"
  | "unknown";

export type UserRole = "medewerker" | "fleet_manager";

// ──────────────────────────────────────────────
// Card system
// ──────────────────────────────────────────────
export type CardType =
  | "vehicle"
  | "contract"
  | "document"
  | "option"
  | "charging"
  | "insight";

export interface CardField {
  label: string;
  value: string;
}

export interface ResponseCard {
  type: CardType;
  title: string;
  fields: CardField[];
}

// ──────────────────────────────────────────────
// Chat response (API shape)
// ──────────────────────────────────────────────
/** Optionele knop naar een interne app-route (bijv. ongeval-wizard). */
export interface ChatResponseCta {
  label: string;
  href: string;
}

export interface ChatResponse {
  intent: ChatIntent;
  title: string;
  message: string;
  cards?: ResponseCard[];
  suggestions?: string[];
  cta?: ChatResponseCta;
}

// ──────────────────────────────────────────────
// Chat message (client-side)
// ──────────────────────────────────────────────
export interface ChatAttachment {
  name: string;
  bucket?: string;
  path?: string;
  mime?: string;
  /** Signed URL (24h) when loaded from history */
  url?: string;
}

/** POST /api/chat success payload (assistant + persisted user row + signed bijlagen). */
export interface ChatPostPersisted {
  userMessageId: string;
  attachments?: ChatAttachment[];
}

export type ChatPostResponse = ChatResponse & {
  persisted: ChatPostPersisted;
};

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  intent?: ChatIntent;
  title?: string;
  cards?: ResponseCard[];
  suggestions?: string[];
  cta?: ChatResponseCta;
  /** User-uploaded files (names shown in the bubble; upload happens on send) */
  attachments?: ChatAttachment[];
}
