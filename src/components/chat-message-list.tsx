"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bot as LuBot, Paperclip } from "lucide-react";
import type { ChatAttachment, ChatMessage } from "@/types/chat";
import { AssistantResponseCard } from "./assistant-response-card";

/** Altijd hetzelfde bot-icoon (22px); alleen de badge-container wijzigen bij stijltests. */
const ASSISTANT_AVATAR_ICON = "h-[22px] w-[22px] text-[#1E7AB0]" as const;

/**
 * Eerdere voorkeur — gradient squircle (alleen container; icoon blijft ASSISTANT_AVATAR_ICON):
 * container: rounded-xl bg-gradient-to-br from-[#2799D7] to-[#135d8a] shadow-[0_2px_8px_rgba(19,93,138,0.28)]
 * (icoon op donker vlak: zou dan text-white + drop-shadow vereisen — alleen gebruiken als container donker is)
 */

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  /** Opent de ongeval-wizard (full-page) vanaf de chat */
  onOpenAccidentWizard?: () => void;
}

export function ChatMessageList({
  messages,
  isLoading,
  onOpenAccidentWizard,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) return null;

  return (
    <div className="w-full space-y-2 px-safe pb-3 pt-2">
      {messages.map((msg) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {msg.role === "user" ? (
            <UserBubble
              content={msg.content}
              attachments={msg.attachments}
              timestamp={msg.timestamp}
            />
          ) : (
            <AssistantBubble
              message={msg}
              onOpenAccidentWizard={onOpenAccidentWizard}
            />
          )}
        </motion.div>
      ))}

      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex w-full min-w-0 justify-start"
        >
          <div className="flex min-w-0 w-full items-start justify-start gap-2">
            <AssistantAvatarBadge />
            <div className="min-w-0 max-w-[min(100%,42rem)]">
              <AssistantSpeechBubble>
                <div className="flex min-w-[72px] items-center justify-center gap-1 px-1 py-0.5">
                  <div className="h-2 w-2 animate-[pulse_1s_ease-in-out_infinite] rounded-full bg-[#8696A0]" />
                  <div className="h-2 w-2 animate-[pulse_1s_ease-in-out_0.2s_infinite] rounded-full bg-[#8696A0]" />
                  <div className="h-2 w-2 animate-[pulse_1s_ease-in-out_0.4s_infinite] rounded-full bg-[#8696A0]" />
                </div>
              </AssistantSpeechBubble>
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function AssistantAvatarBadge() {
  return (
    <div
      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#2799D7]/25 bg-gradient-to-br from-white to-[#E8F4FB] shadow-[0_2px_8px_rgba(39,153,215,0.14)]"
      aria-hidden
    >
      <LuBot className={ASSISTANT_AVATAR_ICON} strokeWidth={1.85} aria-hidden />
    </div>
  );
}

function formatMessageTime(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function UserAttachmentRow({ a }: { a: ChatAttachment }) {
  return (
    <li className="space-y-1.5 text-[13px] leading-snug text-[#5F7382]">
      <div className="flex items-center gap-1.5">
        <Paperclip
          className="h-3.5 w-3.5 shrink-0 text-[#2799D7]"
          strokeWidth={2}
          aria-hidden
        />
        {a.url ? (
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="min-w-0 truncate text-[#2799D7] underline decoration-[#2799D7]/35 underline-offset-2 [overflow-wrap:anywhere] hover:decoration-[#2799D7]"
          >
            {a.name}
          </a>
        ) : (
          <span className="min-w-0 truncate [overflow-wrap:anywhere]">{a.name}</span>
        )}
      </div>
      {a.url && a.mime?.startsWith("image/") && (
        <img
          src={a.url}
          alt=""
          className="max-h-40 w-auto max-w-full rounded-lg border border-[#0000000d] object-contain"
        />
      )}
    </li>
  );
}

function UserBubble({
  content,
  attachments,
  timestamp,
}: {
  content: string;
  attachments?: ChatAttachment[];
  timestamp: Date;
}) {
  const hasText = content.trim().length > 0;
  const hasFiles = (attachments?.length ?? 0) > 0;
  if (!hasText && !hasFiles) return null;

  return (
    <div className="flex w-full min-w-0 justify-end">
      <div className="flex w-fit max-w-[min(92%,42rem)] shrink-0 flex-col items-end sm:max-w-[min(85%,42rem)]">
        <UserSpeechBubble>
          {hasText && (
            <div className="flex min-w-0 items-end gap-x-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-left text-[15px] leading-[1.45] text-[#163247] [overflow-wrap:anywhere]">
                {content}
              </p>
              <time
                dateTime={timestamp.toISOString()}
                className="shrink-0 pb-px text-[11px] leading-none tabular-nums text-[#5F7382]/90"
              >
                {formatMessageTime(timestamp)}
              </time>
            </div>
          )}
          {hasFiles &&
            (hasText ? (
              <ul className="mt-2 space-y-1 border-t border-[#163247]/10 pt-2">
                {attachments!.map((a, i) => (
                  <UserAttachmentRow key={`${a.name}-${i}`} a={a} />
                ))}
              </ul>
            ) : (
              <div className="flex min-w-0 items-end gap-x-2">
                <ul className="min-w-0 flex-1 space-y-1">
                  {attachments!.map((a, i) => (
                    <UserAttachmentRow key={`${a.name}-${i}`} a={a} />
                  ))}
                </ul>
                <time
                  dateTime={timestamp.toISOString()}
                  className="shrink-0 pb-px text-[11px] leading-none tabular-nums text-[#5F7382]/90"
                >
                  {formatMessageTime(timestamp)}
                </time>
              </div>
            ))}
        </UserSpeechBubble>
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  onOpenAccidentWizard,
}: {
  message: ChatMessage;
  onOpenAccidentWizard?: () => void;
}) {
  const hasCards = (message.cards?.length ?? 0) > 0;
  const cta = message.cta;
  const openWizardFromChat = Boolean(onOpenAccidentWizard && cta?.href === "/ongeval");

  return (
    <div className="flex w-full min-w-0 flex-col justify-start gap-2">
      {/* Avatar alleen naast de tekstballon — niet meeschalen met infokaarten */}
      <div className="flex w-full min-w-0 items-start justify-start gap-2">
        <AssistantAvatarBadge />
        <div className="min-w-0 max-w-[min(100%,42rem)]">
          <AssistantSpeechBubble>
            <div
              className="break-words text-[15px] leading-[1.45] text-[#163247] [overflow-wrap:anywhere] [&_strong]:font-semibold [&_strong]:text-[#163247]"
              dangerouslySetInnerHTML={{
                __html: formatMarkdown(message.content),
              }}
            />
            {cta ? (
              <div className="mt-3">
                {openWizardFromChat ? (
                  <button
                    type="button"
                    onClick={onOpenAccidentWizard}
                    className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-[#2799D7] px-4 py-2.5 text-center text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#1e7bb0] active:bg-[#1a6a9a]"
                  >
                    {cta.label}
                  </button>
                ) : (
                  <Link
                    href={cta.href}
                    className="inline-flex min-h-11 w-full touch-manipulation items-center justify-center rounded-xl bg-[#2799D7] px-4 py-2.5 text-center text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-[#1e7bb0] active:bg-[#1a6a9a]"
                  >
                    {cta.label}
                  </Link>
                )}
              </div>
            ) : null}
            <time
              dateTime={message.timestamp.toISOString()}
              className="mt-2 block text-right text-[11px] leading-none tabular-nums text-[#5F7382]/90"
            >
              {formatMessageTime(message.timestamp)}
            </time>
          </AssistantSpeechBubble>
        </div>
      </div>

      {hasCards && (
        <div className="min-w-0 w-full pl-12">
          <div className="w-[min(100%,36rem)] space-y-2">
            {message.cards!.map((card, i) => (
              <AssistantResponseCard key={i} card={card} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Tail points left toward the assistant avatar (bovenaan, in lijn met het icoon) */
function AssistantSpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        "relative isolate w-full rounded-2xl rounded-tl-md bg-white px-3 py-2",
        "shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
        "before:pointer-events-none before:absolute before:top-3 before:right-full before:z-0 before:-mr-px",
        "before:h-0 before:w-0 before:border-solid",
        "before:border-y-[7px] before:border-r-[7px] before:border-y-transparent before:border-r-white",
        "before:content-['']",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Tail points right toward the user (medewerker) */
function UserSpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        "relative isolate w-fit max-w-full rounded-2xl rounded-br-md bg-[#D4E9F9] px-3 py-2",
        "shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]",
        "before:pointer-events-none before:absolute before:bottom-[7px] before:left-full before:z-0 before:-ml-px",
        "before:h-0 before:w-0 before:border-solid",
        "before:border-y-[7px] before:border-l-[7px] before:border-y-transparent before:border-l-[#D4E9F9]",
        "before:content-['']",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}
