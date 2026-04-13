"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Bot, Paperclip } from "lucide-react";
import type { ChatAttachment, ChatMessage } from "@/types/chat";
import { AssistantResponseCard } from "./assistant-response-card";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export function ChatMessageList({
  messages,
  isLoading,
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
            <UserBubble content={msg.content} attachments={msg.attachments} />
          ) : (
            <AssistantBubble message={msg} />
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
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2799D7] shadow-sm">
              <Bot className="h-5 w-5 text-white" strokeWidth={1.75} />
            </div>
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

function UserBubble({
  content,
  attachments,
}: {
  content: string;
  attachments?: ChatAttachment[];
}) {
  const hasText = content.trim().length > 0;
  const hasFiles = (attachments?.length ?? 0) > 0;
  if (!hasText && !hasFiles) return null;

  return (
    <div className="flex w-full min-w-0 justify-end">
      <div className="flex w-fit max-w-[min(92%,42rem)] shrink-0 flex-col items-end sm:max-w-[min(85%,42rem)]">
        <UserSpeechBubble>
          {hasText && (
            <p className="whitespace-pre-wrap break-words text-[15px] leading-[1.45] text-[#163247] [overflow-wrap:anywhere]">
              {content}
            </p>
          )}
          {hasFiles && (
            <ul
              className={
                hasText
                  ? "mt-2 space-y-1 border-t border-[#163247]/10 pt-2"
                  : "space-y-1"
              }
            >
              {attachments!.map((a, i) => (
                <li
                  key={`${a.name}-${i}`}
                  className="space-y-1.5 text-[13px] leading-snug text-[#5F7382]"
                >
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
                      <span className="min-w-0 truncate [overflow-wrap:anywhere]">
                        {a.name}
                      </span>
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
              ))}
            </ul>
          )}
        </UserSpeechBubble>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  const hasCards = (message.cards?.length ?? 0) > 0;

  return (
    <div className="flex w-full min-w-0 flex-col justify-start gap-2">
      {/* Avatar alleen naast de tekstballon — niet meeschalen met infokaarten */}
      <div className="flex w-full min-w-0 items-start justify-start gap-2">
        <div
          className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2799D7] shadow-sm"
          aria-hidden
        >
          <Bot className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 max-w-[min(100%,42rem)]">
          <AssistantSpeechBubble>
            <div
              className="break-words text-[15px] leading-[1.45] text-[#163247] [overflow-wrap:anywhere] [&_strong]:font-semibold [&_strong]:text-[#163247]"
              dangerouslySetInnerHTML={{
                __html: formatMarkdown(message.content),
              }}
            />
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
