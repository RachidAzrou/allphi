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
  | "insurance_certificate"
  | "new_car_order"
  | "accident_report"
  | "tire_change"
  | "lease_return_inspection"
  | "greeting"
  | "acknowledgment"
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
// Guided flows (multi-turn)
// ──────────────────────────────────────────────
export type ChatFlowId =
  | "tire_change"
  | "lease_return_inspection"
  | "accident_report";

export interface ChatFlowState {
  id: ChatFlowId;
  step: number;
  answers?: Record<string, string>;
}

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

/**
 * When the AI is uncertain, it flags a pending escalation instead of
 * escalating automatically. The user must confirm via the CTA button.
 */
export interface PendingEscalation {
  /** The original user question (for the escalation email body). */
  question: string;
  /** Human-readable reason shown to the medewerker. */
  reason?: string;
}

export interface ChatResponse {
  intent: ChatIntent;
  title: string;
  message: string;
  cards?: ResponseCard[];
  suggestions?: string[];
  cta?: ChatResponseCta;
  /** Optional multi-turn flow state (persisted in assistant metadata). */
  flow?: ChatFlowState;
  /**
   * When set, the response requires explicit user consent before escalating.
   * The UI must show an "Escaleren naar Fleetmanager" button.
   */
  pendingEscalation?: PendingEscalation;
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
  role: "user" | "assistant" | "fleet_manager";
  content: string;
  timestamp: Date;
  intent?: ChatIntent;
  title?: string;
  cards?: ResponseCard[];
  suggestions?: string[];
  cta?: ChatResponseCta;
  /** User-uploaded files (names shown in the bubble; upload happens on send) */
  attachments?: ChatAttachment[];
  /** When set, the message has a pending escalation awaiting user confirmation. */
  pendingEscalation?: PendingEscalation;
}
