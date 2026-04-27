"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { IoMdMegaphone } from "react-icons/io";
import { TbInbox } from "react-icons/tb";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { EscalationStatusBadge } from "@/components/escalation-status-badge";
import {
  FLEET_INBOX_POLL_EVENT,
  fleetEscalationDotClass,
  isEscalationUnreadLike,
  normalizeFleetEscalationStatus,
} from "@/lib/fleet/escalation-status";

type Escalation = {
  id: string;
  conversation_id: string | null;
  user_message_id: string | null;
  status: string;
  subject: string | null;
  created_at: string;
  resolved_at: string | null;
};

function normalizeEscalationSubject(subject: string | null, fallbackEmail?: string | null): string {
  const raw = (subject ?? "").trim();
  if (!raw) return fallbackEmail ? `Escalatie — ${fallbackEmail} — Vraag` : "Escalatie — Vraag";
  if (/^Fleet vraag \(escalatie\)\s+—\s+/i.test(raw)) {
    return raw.replace(/^Fleet vraag \(escalatie\)\s+—\s+/i, "Escalatie — ");
  }
  if (/^Escalatie\s+—\s+/i.test(raw)) return raw;
  return `Escalatie — ${raw}`;
}

type ThreadMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  timestamp: string;
  metadata: unknown | null;
};

type ThreadPayload = {
  escalation: {
    id: string;
    conversation_id: string | null;
    status: string;
    subject: string | null;
    body: string | null;
    created_at: string;
    resolved_at: string | null;
  };
  messages: ThreadMessage[];
};

function formatTimestamp(ts: string) {
  try {
    return new Intl.DateTimeFormat("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

export function FleetManagerInboxClient(props: {
  userEmail: string;
  userDisplayName: string;
}) {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [threadLoading, setThreadLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastBusy, setBroadcastBusy] = useState(false);

  const selected = useMemo(
    () => escalations.find((e) => e.id === selectedId) ?? null,
    [escalations, selectedId],
  );

  const loadEscalations = useCallback(async () => {
    const res = await fetch("/api/fleet-manager/escalations", {
      credentials: "same-origin",
    });
    const json = (await res.json()) as { escalations?: Escalation[]; error?: string };
    if (!res.ok) throw new Error(json.error ?? "load_failed");
    setEscalations(Array.isArray(json.escalations) ? json.escalations : []);
  }, []);

  const loadThread = useCallback(async (id: string) => {
    setThreadLoading(true);
    setThread(null);
    const res = await fetch(`/api/fleet-manager/escalations/${encodeURIComponent(id)}/thread`, {
      credentials: "same-origin",
    });
    const json = (await res.json()) as ThreadPayload & { error?: string };
    if (!res.ok) throw new Error(json.error ?? "thread_failed");
    setThread(json);
    if (isEscalationUnreadLike(json.escalation?.status)) {
      const r = await fetch(
        `/api/fleet-manager/escalations/${encodeURIComponent(id)}/read`,
        { method: "POST", credentials: "same-origin" },
      );
      if (r.ok) {
        const j = (await r.json().catch(() => ({}))) as { status?: string };
        const nextSt = (j.status?.trim() || "open");
        setThread((prev) =>
          prev?.escalation
            ? { ...prev, escalation: { ...prev.escalation, status: nextSt } }
            : prev,
        );
        setEscalations((prev) => prev.map((e) => (e.id === id ? { ...e, status: nextSt } : e)));
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(FLEET_INBOX_POLL_EVENT));
        }
      } else {
        const t = await r.text();
        console.error("escalation read failed:", t);
      }
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadEscalations();
      } catch (e) {
        console.error(e);
        toast.error("Kon escalaties niet laden.");
      }
    })();
  }, [loadEscalations]);

  useEffect(() => {
    if (!selectedId) {
      setThread(null);
      setThreadLoading(false);
      return;
    }
    void (async () => {
      try {
        await loadThread(selectedId);
      } catch (e) {
        console.error(e);
        toast.error("Kon conversatie niet laden.");
        setThread(null);
      }
      setThreadLoading(false);
    })();
  }, [selectedId, loadThread]);

  const sendReply = useCallback(async () => {
    const trimmed = reply.trim();
    if (!selectedId || !trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/fleet-manager/escalations/${encodeURIComponent(selectedId)}/reply`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ answer: trimmed, markResolved: true }),
        },
      );
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) {
        throw new Error(json.error ?? "reply_failed");
      }
      setReply("");
      await loadThread(selectedId);
      await loadEscalations();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(FLEET_INBOX_POLL_EVENT));
      }
      toast.success("Antwoord verstuurd.");
    } catch (e) {
      console.error(e);
      toast.error("Kon antwoord niet versturen.");
    } finally {
      setBusy(false);
    }
  }, [reply, selectedId, busy, loadThread, loadEscalations]);

  const sendBroadcast = useCallback(async () => {
    const title = broadcastTitle.trim();
    const message = broadcastMessage.trim();
    if (!title || !message || broadcastBusy) return;
    setBroadcastBusy(true);
    try {
      const res = await fetch("/api/fleet-manager/broadcast", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ title, message }),
      });
      const json = (await res.json()) as
        | { ok: true; delivered: number; skipped: number }
        | { ok?: false; error?: string };
      if (!res.ok || !("ok" in json) || json.ok !== true) {
        throw new Error(("error" in json && json.error) || "broadcast_failed");
      }
      toast.success(`Broadcast verstuurd (${json.delivered} ontvangers).`);
      if (json.skipped > 0) toast.message(`${json.skipped} ontvangers overgeslagen.`);
      setBroadcastOpen(false);
      setBroadcastTitle("");
      setBroadcastMessage("");
    } catch (e) {
      console.error(e);
      toast.error("Kon broadcast niet versturen.");
    } finally {
      setBroadcastBusy(false);
    }
  }, [broadcastTitle, broadcastMessage, broadcastBusy]);

  return (
    <div className="chat-app-shell flex h-dvh min-h-0 max-h-dvh flex-col overflow-hidden">
      <AppHeader
        userEmail={props.userEmail}
        userDisplayName={props.userDisplayName}
        showFleetManagerNav
      />

      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-border bg-card/40 px-safe py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm"
                  aria-hidden="true"
                >
                  <TbInbox className="h-6 w-6" aria-hidden="true" />
                </span>
                <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                  Inbox
                </h1>
              </div>
              <p className="mt-1 text-sm leading-snug text-muted-foreground">
                Doorgestuurde vragen uit de medewerker-chat.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
                <DialogTrigger
                  render={
                    <Button
                      variant="default"
                      size="lg"
                      className="h-11 px-5 text-[15px] border border-[#00A3A3]/60 bg-[#00A3A3] text-white shadow-sm hover:bg-[#008F8F] active:bg-[#007D7D]"
                    >
                      <IoMdMegaphone className="mr-2 h-5 w-5" aria-hidden="true" />
                      Broadcast
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Broadcast naar alle medewerkers</DialogTitle>
                    <DialogDescription>
                      Dit bericht verschijnt in de chat van elke medewerker als bericht van de fleet manager.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-3">
                    <label className="grid gap-1">
                      <span className="text-[12px] font-semibold text-muted-foreground">Titel</span>
                      <input
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                        placeholder="Bijv. Onderhoudsupdate"
                        className="h-10 rounded-xl border border-input bg-background px-3 text-[14px] text-foreground shadow-sm"
                      />
                    </label>

                    <label className="grid gap-1">
                      <span className="text-[12px] font-semibold text-muted-foreground">Bericht</span>
                      <textarea
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        placeholder="Schrijf je bericht…"
                        rows={5}
                        className="min-h-[120px] resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-[14px] leading-snug text-foreground shadow-sm"
                      />
                    </label>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBroadcastOpen(false)} disabled={broadcastBusy}>
                      Annuleren
                    </Button>
                    <Button
                      onClick={() => void sendBroadcast()}
                      disabled={
                        broadcastBusy ||
                        broadcastTitle.trim().length === 0 ||
                        broadcastMessage.trim().length === 0
                      }
                    >
                      {broadcastBusy ? "Versturen…" : "Verstuur"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* Left: inbox list */}
          <aside className="w-[min(420px,46vw)] shrink-0 border-r border-border bg-card/40">
            <div className="border-b border-border px-4 py-3">
              <p className="text-[12px] text-muted-foreground">{escalations.length} items</p>
            </div>

            <div className="min-h-0 overflow-y-auto">
              {escalations.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">Geen escalaties.</div>
              ) : (
                <ul className="divide-y divide-border">
                  {escalations.map((e) => {
                    const active = e.id === selectedId;
                    const st = normalizeFleetEscalationStatus(e.status);
                    const isResolved = st === "resolved";
                    return (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (isEscalationUnreadLike(e.status)) {
                              setEscalations((prev) =>
                                prev.map((x) => (x.id === e.id ? { ...x, status: "open" } : x)),
                              );
                            }
                            setSelectedId(e.id);
                          }}
                          className={cn(
                            "w-full px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                            active ? "bg-muted/60" : "hover:bg-muted/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 sm:gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <span
                                  className={cn(
                                    "mt-[6px] inline-block h-2 w-2 shrink-0 rounded-full",
                                    fleetEscalationDotClass(e.status),
                                  )}
                                  aria-hidden="true"
                                />
                                <p
                                  className={cn(
                                    "truncate text-[14px] font-semibold",
                                    isResolved ? "text-muted-foreground" : "text-foreground",
                                  )}
                                >
                                  {normalizeEscalationSubject(e.subject)}
                                </p>
                              </div>
                              <p className="mt-1 text-[12px] tabular-nums text-muted-foreground">
                                {formatTimestamp(e.created_at)}
                              </p>
                            </div>

                            <EscalationStatusBadge
                              className="shrink-0 self-center"
                              status={e.status}
                              size="compact"
                            />
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>

          {/* Right: thread */}
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="border-b border-border bg-card/30 px-4 py-3">
              {!selectedId ? (
                <>
                  <h2 className="truncate text-[15px] font-semibold">Geen escalatie geselecteerd</h2>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    Kies links een item om de conversatie te openen.
                  </p>
                </>
              ) : (
                <>
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <h2 className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                      {selected?.subject ?? "Escalatie"}
                    </h2>
                    {thread?.escalation ? (
                      <EscalationStatusBadge
                        className="shrink-0"
                        status={thread.escalation.status}
                        size="compact"
                      />
                    ) : null}
                  </div>
                  {thread?.escalation?.conversation_id ? (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      Conversation: <code>{thread.escalation.conversation_id}</code>
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {threadLoading ? "Conversatie laden…" : "Geen conversatie beschikbaar."}
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {!selectedId ? (
                <div className="flex h-full min-h-[320px] flex-col items-center justify-center px-4 text-center">
                  <div className="app-card mb-3 flex h-12 w-12 items-center justify-center rounded-full">
                    <TbInbox className="h-6 w-6 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-sm font-heading font-semibold text-foreground">Selecteer een escalatie</p>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Je ziet hier de volledige thread en kan meteen antwoorden als fleet manager.
                  </p>
                </div>
              ) : threadLoading ? (
                <div className="text-sm text-muted-foreground">Conversatie laden…</div>
              ) : !thread ? (
                <div className="text-sm text-muted-foreground">Kon conversatie niet laden.</div>
              ) : thread.messages.length === 0 ? (
                <div className="text-sm text-muted-foreground">Geen berichten.</div>
              ) : (
                <div className="space-y-2">
                  {thread.messages.map((m) => (
                    <div
                      key={m.id}
                      className={cn(
                        "rounded-xl border px-3 py-2",
                        m.role === "user"
                          ? "border-primary/25 bg-primary/[0.06]"
                          : m.role === "fleet_manager"
                            ? "border-red-500/30 bg-red-500/10"
                            : "border-border bg-card",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-muted-foreground">
                          {m.role}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatTimestamp(m.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap break-words text-[14px] leading-[1.5] text-foreground">
                        {m.content}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedId ? (
              <div className="shrink-0 border-t border-border bg-card px-4 py-3">
                <div className="flex items-center gap-2">
                  <textarea
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Stuur een bericht…"
                    disabled={threadLoading || busy}
                    rows={2}
                    className="min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply()}
                    disabled={threadLoading || busy || reply.trim().length === 0}
                    className="stitch-btn-primary h-10 shrink-0 rounded-lg px-4 text-[14px] font-semibold text-white shadow-sm transition-[filter,transform] hover:brightness-110 disabled:opacity-40"
                  >
                    {busy ? "…" : "Verstuur"}
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </div>
  );
}

