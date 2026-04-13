/** Shared limits for chat annex uploads (client + server). */
export const CHAT_ATTACHMENTS_BUCKET =
  process.env.NEXT_PUBLIC_CHAT_ATTACHMENTS_BUCKET ??
  process.env.CHAT_ATTACHMENTS_BUCKET ??
  "chat-attachments";

export const MAX_CHAT_ATTACHMENTS = 5;
export const MAX_CHAT_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export const CHAT_ATTACHMENT_INPUT_ACCEPT =
  "image/jpeg,image/png,image/webp,application/pdf,.pdf,.doc,.docx,.xls,.xlsx";
