"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Bot as LuBot, Paperclip, Shield as LuShield, Send } from "lucide-react";
import { FaCarCrash } from "react-icons/fa";
import { GiCrackedGlass } from "react-icons/gi";
import {
  RiAlarmWarningFill,
  RiCarFill,
  RiCheckFill,
  RiPhoneFill,
  RiTimeFill,
  RiToolsFill,
} from "react-icons/ri";
import type { ChatAttachment, ChatMessage } from "@/types/chat";
import { cn } from "@/lib/utils";
import { AssistantResponseCard } from "./assistant-response-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** Bot-icoon op primary badge (22px). */
const ASSISTANT_AVATAR_ICON = "h-[22px] w-[22px] text-primary-foreground" as const;
const FLEET_AVATAR_ICON = "h-[22px] w-[22px] text-white" as const;

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  /** Opent de ongeval-wizard (full-page) vanaf de chat */
  onOpenAccidentWizard?: () => void;
  /** Opent de nieuwe-wagen-bestel wizard (full-page) vanaf de chat */
  onOpenNewCarOrderWizard?: () => void;
}

export function ChatMessageList({
  messages,
  isLoading,
  onOpenAccidentWizard,
  onOpenNewCarOrderWizard,
}: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) return null;

  const groups = groupMessagesByDay(messages);

  return (
    <div className="w-full px-safe pb-3 pt-2">
      {groups.map((group) => (
        <section key={group.key} className="relative">
          <div className="sticky top-0 z-10 flex w-full justify-center py-1.5">
            <span
              className="rounded-full bg-muted px-3 py-1 text-[11px] font-medium text-muted-foreground"
              role="separator"
              aria-label={formatDateSeparator(group.date)}
            >
              {formatDateSeparator(group.date)}
            </span>
          </div>

          <div className="space-y-3">
            {group.messages.map((msg, idx) => {
              const prev = idx > 0 ? group.messages[idx - 1] : null;
              const prevSession = prev ? sessionFor(prev) : null;
              const nextSession = sessionFor(msg);
              const showSessionSeparator = prevSession !== nextSession;
              let escalationAnchorUserId: string | undefined;
              if (msg.role === "assistant") {
                for (let j = idx - 1; j >= 0; j--) {
                  if (group.messages[j].role === "user") {
                    escalationAnchorUserId = group.messages[j].id;
                    break;
                  }
                }
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  {showSessionSeparator ? (
                    <SessionSeparator session={nextSession} />
                  ) : null}

                  {msg.role === "user" ? (
                    <UserBubble
                      content={msg.content}
                      attachments={msg.attachments}
                      timestamp={msg.timestamp}
                    />
                  ) : msg.role === "fleet_manager" ? (
                    <FleetManagerBubble message={msg} />
                  ) : (
                    <AssistantBubble
                      message={msg}
                      escalationAnchorUserId={escalationAnchorUserId}
                      onOpenAccidentWizard={onOpenAccidentWizard}
                      onOpenNewCarOrderWizard={onOpenNewCarOrderWizard}
                    />
                  )}
                </motion.div>
              );
            })}
          </div>
        </section>
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
                <div className="flex min-w-[72px] items-center justify-center gap-1.5 px-1 py-0.5">
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/50" />
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:150ms]" />
                  <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/50 [animation-delay:300ms]" />
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

type ChatSession = "chatbot" | "fleet_manager";

function sessionFor(msg: ChatMessage): ChatSession {
  if (msg.role === "fleet_manager") return "fleet_manager";
  return "chatbot";
}

function SessionSeparator({ session }: { session: ChatSession }) {
  const label = session === "fleet_manager" ? "Fleet manager sessie" : "Chatbot sessie";
  return (
    <div className="flex w-full justify-center py-1.5">
      <span
        className={cn(
          "rounded-full px-3 py-1 text-[11px] font-semibold",
          session === "fleet_manager"
            ? "bg-red-500/10 text-red-700 ring-1 ring-red-500/20 dark:text-red-300"
            : "bg-muted text-muted-foreground ring-1 ring-border/60",
        )}
        role="separator"
        aria-label={label}
      >
        {label}
      </span>
    </div>
  );
}

function AssistantAvatarBadge() {
  return (
    <div
      className="stitch-gradient-fill mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full shadow-sm ring-1 ring-white/25"
      aria-hidden
    >
      <LuBot className={ASSISTANT_AVATAR_ICON} strokeWidth={1.85} aria-hidden />
    </div>
  );
}

function FleetManagerAvatarBadge() {
  return (
    <div
      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-600 shadow-sm ring-1 ring-red-500/20"
      aria-hidden
    >
      <LuShield className={FLEET_AVATAR_ICON} strokeWidth={1.85} aria-hidden />
    </div>
  );
}

function formatMessageTime(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

interface DayGroup {
  key: string;
  date: Date;
  messages: ChatMessage[];
}

function groupMessagesByDay(messages: ChatMessage[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const msg of messages) {
    const key = dayKey(msg.timestamp);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.messages.push(msg);
    } else {
      groups.push({ key, date: msg.timestamp, messages: [msg] });
    }
  }
  return groups;
}

function daysBetween(from: Date, to: Date): number {
  const ms = startOfDay(to).getTime() - startOfDay(from).getTime();
  return Math.round(ms / 86_400_000);
}

function formatDateSeparator(date: Date): string {
  const now = new Date();
  const diff = daysBetween(date, now);

  if (diff <= 0) return "Vandaag";
  if (diff === 1) return "Gisteren";
  if (diff === 2) return "Eergisteren";

  const weekday = new Intl.DateTimeFormat("nl-NL", { weekday: "long" }).format(date);

  const dateParts: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { day: "2-digit", month: "short" }
      : { day: "2-digit", month: "short", year: "numeric" };

  const dateStr = new Intl.DateTimeFormat("nl-NL", dateParts)
    .format(date)
    .replace(/\.$/, "");

  return `${weekday} ${dateStr}`;
}


function UserAttachmentRow({ a, inverse }: { a: ChatAttachment; inverse?: boolean }) {
  return (
    <li
      className={cn(
        "space-y-1.5 text-[13px] leading-snug",
        inverse ? "text-primary-foreground/90" : "text-muted-foreground",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Paperclip
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            inverse ? "text-white/85" : "text-primary",
          )}
          strokeWidth={2}
          aria-hidden
        />
        {a.url ? (
          <a
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "min-w-0 truncate underline underline-offset-2 [overflow-wrap:anywhere]",
              inverse
                ? "text-white decoration-white/40 hover:decoration-white"
                : "text-primary decoration-primary/30 hover:decoration-primary",
            )}
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
          className={cn(
            "max-h-40 w-auto max-w-full rounded-xl object-contain shadow-md",
            inverse
              ? "border border-white/35 bg-black/10"
              : "border border-border/70 bg-card shadow-[0_12px_26px_rgba(24,28,32,0.06)]",
          )}
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
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-left text-[15px] leading-[1.5] text-primary-foreground [overflow-wrap:anywhere]">
                {content}
              </p>
              <time
                dateTime={timestamp.toISOString()}
                className="shrink-0 pb-px text-[11px] leading-none tabular-nums text-primary-foreground/75"
              >
                {formatMessageTime(timestamp)}
              </time>
            </div>
          )}
          {hasFiles &&
            (hasText ? (
              <ul className="mt-2 space-y-1 border-t border-white/25 pt-2">
                {attachments!.map((a, i) => (
                  <UserAttachmentRow key={`${a.name}-${i}`} a={a} inverse />
                ))}
              </ul>
            ) : (
              <div className="flex min-w-0 items-end gap-x-2">
                <ul className="min-w-0 flex-1 space-y-1">
                  {attachments!.map((a, i) => (
                    <UserAttachmentRow key={`${a.name}-${i}`} a={a} inverse />
                  ))}
                </ul>
                <time
                  dateTime={timestamp.toISOString()}
                  className="shrink-0 pb-px text-[11px] leading-none tabular-nums text-primary-foreground/75"
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

function EscalateButton({
  assistantMessageId,
  anchorUserMessageId,
  question,
  reason,
}: {
  /** Assistant bubble that contains the escalate CTA. */
  assistantMessageId: string;
  /** Last user message in the thread; inbox/thread anchor for fleet manager. */
  anchorUserMessageId?: string;
  question: string;
  reason?: string;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(question);
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(question);
      setDraftError(null);
      setSendError(null);
    }
  }, [open, question]);

  async function handleEscalate() {
    const q = draft.replace(/\s+/g, " ").trim();
    if (!q) {
      setDraftError("Formuleer even je vraag.");
      return;
    }
    setDraftError(null);
    setSendError(null);
    setState("loading");
    try {
      const res = await fetch("/api/chat/escalate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessageId: anchorUserMessageId ?? assistantMessageId,
          assistantMessageId,
          question: q,
          reason,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setState("done");
      setOpen(false);
    } catch {
      setState("idle");
      setSendError("Versturen mislukt. Probeer opnieuw.");
    }
  }

  if (state === "done") {
    return (
      <p className="mt-3 rounded-lg bg-green-500/10 px-3 py-2 text-[13px] font-medium text-green-700 ring-1 ring-green-500/20 dark:text-green-400">
        ✓ Je vraag is doorgestuurd naar je fleet manager.
      </p>
    );
  }

  if (state === "error") {
    return (
      <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] font-medium text-red-700 ring-1 ring-red-500/20 dark:text-red-400">
        Oops — escalatie mislukt. Probeer het opnieuw of mail naar{" "}
        <a href="mailto:fleet@allphi.eu" className="underline">
          fleet@allphi.eu
        </a>
        .
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={state === "loading"}
        className={cn(
          "mt-3 inline-flex min-h-10 w-full touch-manipulation items-center justify-center gap-2",
          "rounded-lg border border-primary/30 bg-primary/8 px-4 py-2.5",
          "text-[14px] font-medium text-primary transition-colors",
          "hover:bg-primary/15 disabled:opacity-60",
        )}
      >
        <Send className="h-4 w-4 shrink-0" strokeWidth={1.85} />
        {state === "loading" ? "Doorsturen…" : "Vraag doorsturen naar fleet manager"}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Vraag aan fleet manager</DialogTitle>
            <DialogDescription>
              Alleen wat je hier schrijft, komt binnen bij de fleet manager (niet je volledige
              chatgeschiedenis).
            </DialogDescription>
          </DialogHeader>
          {reason ? (
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground/90">Systeeminfo:</span> {reason}
            </p>
          ) : null}
          <div className="space-y-1.5">
            <label
              htmlFor="escalation-question"
              className="text-[13px] font-medium text-foreground"
            >
              Jouw vraag
            </label>
            <textarea
              id="escalation-question"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              disabled={state === "loading"}
              rows={4}
              className={cn(
                "w-full resize-y rounded-xl border border-border/80 bg-background px-3 py-2.5",
                "text-[14px] leading-relaxed text-foreground shadow-sm outline-none",
                "placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary/25",
                "disabled:opacity-60",
              )}
            />
            {draftError ? (
              <p className="text-[12px] font-medium text-destructive">{draftError}</p>
            ) : null}
            {sendError ? (
              <p className="text-[12px] font-medium text-destructive">{sendError}</p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={state === "loading"}
            >
              Annuleren
            </Button>
            <Button type="button" onClick={handleEscalate} disabled={state === "loading"}>
              {state === "loading" ? "Doorsturen…" : "Versturen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssistantBubble({
  message,
  escalationAnchorUserId,
  onOpenAccidentWizard,
  onOpenNewCarOrderWizard,
}: {
  message: ChatMessage;
  /** Medewerker-bericht direct vóór dit assistent-antwoord; voor escalatie-anker. */
  escalationAnchorUserId?: string;
  onOpenAccidentWizard?: () => void;
  onOpenNewCarOrderWizard?: () => void;
}) {
  const hasCards = (message.cards?.length ?? 0) > 0;
  const cta = message.cta;
  const openWizardFromChat = Boolean(onOpenAccidentWizard && cta?.href === "/ongeval");
  const openCarOrderFromChat = Boolean(
    onOpenNewCarOrderWizard && cta?.href === "/wagen-bestellen",
  );

  return (
    <div className="flex w-full min-w-0 flex-col justify-start gap-2">
      {/* Avatar alleen naast de tekstballon — niet meeschalen met infokaarten */}
      <div className="flex w-full min-w-0 items-start justify-start gap-2">
        <AssistantAvatarBadge />
        <div className="min-w-0 max-w-[min(100%,42rem)]">
          <AssistantSpeechBubble>
            <div className="break-words text-[15px] leading-[1.55] text-foreground [overflow-wrap:anywhere] [&_strong]:font-semibold [&_strong]:text-foreground [&_.chat-sources]:mt-3 [&_.chat-sources]:text-[12px] [&_.chat-sources]:leading-snug [&_.chat-sources]:text-muted-foreground [&_.chat-soft-note]:mt-3 [&_.chat-soft-note]:text-[13px] [&_.chat-soft-note]:italic [&_.chat-soft-note]:text-muted-foreground">
              <AssistantMessageContent content={message.content} />
            </div>
            {cta ? (
              <div className="mt-3">
                {openWizardFromChat ? (
                  <button
                    type="button"
                    onClick={onOpenAccidentWizard}
                    className="stitch-btn-primary inline-flex min-h-10 w-full touch-manipulation items-center justify-center rounded-lg px-4 py-2.5 text-center text-[15px] font-medium shadow-sm transition-[filter,transform] disabled:opacity-50"
                  >
                    {cta.label}
                  </button>
                ) : openCarOrderFromChat ? (
                  <button
                    type="button"
                    onClick={onOpenNewCarOrderWizard}
                    className="stitch-btn-primary inline-flex min-h-10 w-full touch-manipulation items-center justify-center rounded-lg px-4 py-2.5 text-center text-[15px] font-medium shadow-sm transition-[filter,transform] disabled:opacity-50"
                  >
                    {cta.label}
                  </button>
                ) : (
                  <Link
                    href={cta.href}
                    className="stitch-btn-primary inline-flex min-h-10 w-full touch-manipulation items-center justify-center rounded-lg px-4 py-2.5 text-center text-[15px] font-medium shadow-sm transition-[filter,transform]"
                  >
                    {cta.label}
                  </Link>
                )}
              </div>
            ) : null}
            {message.pendingEscalation ? (
              <EscalateButton
                assistantMessageId={message.id}
                anchorUserMessageId={escalationAnchorUserId}
                question={message.pendingEscalation.question}
                reason={message.pendingEscalation.reason}
              />
            ) : null}
            <time
              dateTime={message.timestamp.toISOString()}
              className="mt-2 block text-right text-[11px] leading-none tabular-nums text-muted-foreground/80"
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

function FleetManagerBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex w-full min-w-0 flex-col justify-start gap-2">
      <div className="flex w-full min-w-0 items-start justify-start gap-2">
        <FleetManagerAvatarBadge />
        <div className="min-w-0 max-w-[min(100%,42rem)]">
          <div
            className={[
              "relative isolate w-full rounded-2xl rounded-tl-md border px-4 py-3 shadow-sm",
              "border-red-500/25 bg-red-500/[0.08]",
              "before:pointer-events-none before:absolute before:top-3 before:right-full before:z-0 before:-mr-px",
              "before:h-0 before:w-0 before:border-solid",
              "before:border-y-[7px] before:border-r-[7px] before:border-y-transparent before:border-r-[color:rgba(239,68,68,0.24)]",
              "before:content-['']",
            ].join(" ")}
          >
            <div className="break-words text-[15px] leading-[1.55] text-foreground [overflow-wrap:anywhere]">
              {message.content}
            </div>
            <time
              dateTime={message.timestamp.toISOString()}
              className="mt-2 block text-right text-[11px] leading-none tabular-nums text-muted-foreground/80"
            >
              {formatMessageTime(message.timestamp)}
            </time>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tail points left toward the assistant avatar (bovenaan, in lijn met het icoon) */
function AssistantSpeechBubble({ children }: { children: ReactNode }) {
  return (
    <div
      className={[
        "relative isolate w-full rounded-2xl rounded-tl-md border border-border bg-card px-4 py-3 shadow-sm",
        "before:pointer-events-none before:absolute before:top-3 before:right-full before:z-0 before:-mr-px",
        "before:h-0 before:w-0 before:border-solid",
        "before:border-y-[7px] before:border-r-[7px] before:border-y-transparent before:border-r-[var(--card)]",
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
        "relative isolate w-fit max-w-full rounded-2xl rounded-br-md bg-primary px-4 py-3 text-primary-foreground shadow-sm",
        "before:pointer-events-none before:absolute before:bottom-[7px] before:left-full before:z-0 before:-ml-px",
        "before:h-0 before:w-0 before:border-solid",
        "before:border-y-[7px] before:border-l-[7px] before:border-y-transparent before:border-l-primary",
        "before:content-['']",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function AssistantMessageContent({ content }: { content: string }) {
  const normalized = String(content ?? "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");

  const nodes: ReactNode[] = [];
  let bulletRun: { emoji: string; text: string }[] = [];

  function MaskIcon({ src }: { src: string }) {
    return (
      <span
        aria-hidden
        className="inline-block h-[18px] w-[18px] bg-current"
        style={{
          WebkitMaskImage: `url(${src})`,
          maskImage: `url(${src})`,
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskPosition: "center",
          maskPosition: "center",
          WebkitMaskSize: "contain",
          maskSize: "contain",
        }}
      />
    );
  }

  function flushBullets() {
    if (bulletRun.length === 0) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-2 space-y-1.5">
        {bulletRun.map((b, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[2px] inline-flex h-5 w-5 shrink-0 items-center justify-center text-primary">
              {b.emoji === "🚗" ? (
                <FaCarCrash className="h-[18px] w-[18px]" aria-hidden />
              ) : b.emoji === "🔨" ? (
                <RiToolsFill className="h-[18px] w-[18px]" aria-hidden />
              ) : b.emoji === "🪟" ? (
                <GiCrackedGlass className="h-[18px] w-[18px]" aria-hidden />
              ) : b.emoji === "🔓" ? (
                <MaskIcon src="/icons/vandalisme.png" />
              ) : (
                <span aria-hidden>{b.emoji}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              {renderInlineMarkdown(b.text)}
            </span>
          </li>
        ))}
      </ul>,
    );
    bulletRun = [];
  }

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.trimEnd();

    const m = /^-\s*(🚗|🔨|🪟|🔓)\s+(.*)$/.exec(line);
    if (m) {
      bulletRun.push({ emoji: m[1], text: m[2] });
      continue;
    }

    flushBullets();

    if (line.trim().length === 0) {
      // Keep paragraph spacing (without rendering a bunch of <br/>).
      const prev = nodes[nodes.length - 1];
      if (prev !== <div />) {
        nodes.push(<div key={`sp-${nodes.length}`} className="h-3" />);
      }
      continue;
    }

    // Keep existing "### title" styling consistent with formatMarkdown().
    const titleMatch = /^#{3}\s+(.+)$/.exec(line.trim());
    if (titleMatch) {
      nodes.push(
        <span key={`t-${nodes.length}`} className="chat-bubble-title">
          {titleMatch[1]}
        </span>,
      );
      continue;
    }

    const isCancelHint =
      line.trim() === "Typ `stop` om te annuleren." ||
      line.trim() === "Typ `stop` om te annuleren";

    nodes.push(
      <p
        key={`p-${nodes.length}`}
        className={cn(
          "whitespace-pre-wrap break-words",
          isCancelHint && "text-[13px] text-muted-foreground",
        )}
      >
        {renderInlineMarkdown(line)}
      </p>,
    );
  }

  flushBullets();

  return <>{nodes}</>;
}

function renderInlineMarkdown(text: string): ReactNode {
  // Very small subset used in bubbles: **bold**
  // (Intentionally minimal; we only need bold emphasis for our assistant flows.)
  const s = String(text ?? "");
  if (!s.includes("**")) return renderInlinePlain(s);

  const out: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < s.length) {
    const start = s.indexOf("**", i);
    if (start === -1) {
      const tail = s.slice(i);
      if (tail) out.push(<span key={key++}>{renderInlinePlain(tail)}</span>);
      break;
    }

    if (start > i) {
      out.push(<span key={key++}>{renderInlinePlain(s.slice(i, start))}</span>);
    }

    const end = s.indexOf("**", start + 2);
    if (end === -1) {
      // Unbalanced token — render the rest as-is.
      out.push(<span key={key++}>{renderInlinePlain(s.slice(start))}</span>);
      break;
    }

    const boldText = s.slice(start + 2, end);
    out.push(<strong key={key++}>{renderInlinePlain(boldText)}</strong>);
    i = end + 2;
  }

  // If we didn't actually build anything, return original string.
  return out.length > 0 ? <>{out}</> : s;
}

function renderInlinePlain(text: string): ReactNode {
  const s = String(text ?? "");
  if (!s) return s;
  const norm = s.replace(/\uFE0F/g, "");
  const tokenRe = /(⏱|⚠|✅|📞|🚨|🚗)/g;
  const parts = norm.split(tokenRe);
  if (parts.length <= 1) return s;

  let key = 0;
  return (
    <>
      {parts.map((p) => {
        if (!p) return null;
        switch (p) {
          case "⏱":
            return (
              <RiTimeFill
                key={key++}
                className="inline-block h-[18px] w-[18px] align-[-2px] text-primary"
                aria-hidden
              />
            );
          case "⚠":
            return (
              <RiAlarmWarningFill
                key={key++}
                className="inline-block h-[18px] w-[18px] align-[-2px] text-amber-600 dark:text-amber-400"
                aria-hidden
              />
            );
          case "✅":
            return (
              <RiCheckFill
                key={key++}
                className="inline-block h-[18px] w-[18px] align-[-2px] text-emerald-600 dark:text-emerald-400"
                aria-hidden
              />
            );
          case "📞":
            return (
              <RiPhoneFill
                key={key++}
                className="inline-block h-[18px] w-[18px] align-[-2px] text-primary"
                aria-hidden
              />
            );
          case "🚨":
            return (
              <RiAlarmWarningFill
                key={key++}
                className="inline-block h-[18px] w-[18px] align-[-2px] text-amber-600 dark:text-amber-400"
                aria-hidden
              />
            );
          case "🚗":
            return (
              <RiCarFill
                key={key++}
                className="inline-block h-[18px] w-[18px] align-[-2px] text-primary"
                aria-hidden
              />
            );
          default:
            return <span key={key++}>{p}</span>;
        }
      })}
    </>
  );
}
