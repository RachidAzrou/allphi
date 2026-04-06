export type Intent =
  | "my_vehicle"
  | "my_documents"
  | "my_contract"
  | "allowed_options"
  | "charging_summary"
  | "charging_home_vs_public"
  | "best_range_option"
  | "greeting"
  | "unknown";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  intent?: Intent;
  data?: Record<string, unknown>;
  cards?: ResponseCard[];
}

export type ResponseCardType =
  | "vehicle_info"
  | "contract_info"
  | "document_list"
  | "allowed_vehicles"
  | "charging_summary"
  | "charging_comparison"
  | "text";

export interface ResponseCard {
  type: ResponseCardType;
  data: Record<string, unknown>;
}

export interface IntentResult {
  intent: Intent;
  message: string;
  cards?: ResponseCard[];
}

export interface QuickAction {
  label: string;
  message: string;
  icon: string;
}
