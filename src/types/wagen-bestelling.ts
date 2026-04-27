export type WagenBestellingStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "ordered"
  | "delivered";

export type WagenBestelStapId =
  | "preorder_context"
  | "model_choice"
  | "offer_upload"
  | "auto_checks"
  | "contribution_sign"
  | "submit_for_approval"
  | "waiting"
  | "delivery";

export type WagenBestelState = {
  step: WagenBestelStapId;
  model: {
    catalogId?: string | null;
    merkModel?: string | null;
    dealer?: string | null;
    offerTotalEur?: number | null;
    notes?: string | null;
  };
  offer: {
    storagePath?: string | null;
    filename?: string | null;
    uploadedAt?: string | null;
  };
  checks: {
    validatedAt?: string | null;
    ok?: boolean | null;
    issues?: Array<{ code: string; message: string }> | null;
    overspendAmountEur?: number | null;
    contributionAmountEur?: number | null;
  };
  contribution: {
    required?: boolean | null;
    docPath?: string | null;
    generatedAt?: string | null;
    signedAt?: string | null;
    signature?: string | null;
  };
  approvals: {
    fleetApprovedAt?: string | null;
    managementApprovedAt?: string | null;
    note?: string | null;
  };
  waiting: {
    chargerReminderDone?: boolean;
    chargerOrderDone?: boolean;
  };
  delivery: {
    readyForPickup?: boolean;
    handoverDone?: boolean;
  };
};

export function createInitialWagenBestelState(): WagenBestelState {
  return {
    step: "preorder_context",
    model: {},
    offer: {},
    checks: {},
    contribution: {},
    approvals: {},
    waiting: {},
    delivery: {},
  };
}

