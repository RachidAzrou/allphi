"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { cn } from "@/lib/utils";
import { EscalationStatusBadge } from "@/components/escalation-status-badge";
import { FLEET_INBOX_POLL_EVENT, isEscalationUnreadLike } from "@/lib/fleet/escalation-status";

type ThreadMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
  timestamp: string;
  metadata: unknown | null;
};

function normalizeEscalationSubject(
  subject: string | null | undefined,
  fallbackEmail?: string | null
): string {
  const raw = (subject ?? "").trim();
  if (!raw) return fallbackEmail ? `Escalatie — ${fallbackEmail} — Vraag` : "Escalatie — Vraag";
  if (/^Fleet vraag \(escalatie\)\s+—\s+/i.test(raw)) {
    return raw.replace(/^Fleet vraag \(escalatie\)\s+—\s+/i, "Escalatie — ");
  }
  if (/^Escalatie\s+—\s+/i.test(raw)) return raw;
  return `Escalatie — ${raw}`;
}

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
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

export function FleetManagerEscalationDetailClient(props: {
  userEmail: string;
  userDisplayName: string;
}) {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = (params?.id ?? "").trim();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ThreadPayload | null>(null);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [markResolved, setMarkResolved] = useState(true);

  const loadThread = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
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
          const nextSt = j.status?.trim() || "open";
          setThread((prev) =>
            prev?.escalation
              ? { ...prev, escalation: { ...prev.escalation, status: nextSt } }
              : prev,
          );
          if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent(FLEET_INBOX_POLL_EVENT));
          }
        }
      }
    } catch (e) {
      console.error(e);
      setError("Kon conversatie niet laden.");
      setThread(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  const sendReply = useCallback(async () => {
    const trimmed = reply.trim();
    if (!id || !trimmed || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/fleet-manager/escalations/${encodeURIComponent(id)}/reply`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: trimmed, markResolved }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok) throw new Error(json.error ?? "reply_failed");
      setReply("");
      toast.success("Antwoord verstuurd.");
      await loadThread();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(FLEET_INBOX_POLL_EVENT));
      }
    } catch (e) {
      console.error(e);
      toast.error("Kon antwoord niet versturen.");
    } finally {
      setBusy(false);
    }
  }, [reply, id, busy, markResolved, loadThread]);

  const title = normalizeEscalationSubject(thread?.escalation?.subject);
  const status = thread?.escalation?.status ?? "";

  const headerSubtitle = useMemo(() => {
    if (!thread?.escalation) return null;
    const created = thread.escalation.created_at ? formatTimestamp(thread.escalation.created_at) : null;
    const convo = thread.escalation.conversation_id?.trim();
    return (
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
        {created ? <span>Gestart: {created}</span> : null}
        {convo ? (
          <span className="truncate">
            Conversation: <code>{convo}</code>
          </span>
        ) : null}
      </div>
    );
  }, [thread]);

  return (
    <div className="chat-app-shell flex h-dvh min-h-0 max-h-dvh flex-col overflow-hidden">
      <AppHeader
        userEmail={props.userEmail}
        userDisplayName={props.userDisplayName}
        showFleetManagerNav
      />

      {loading ? (
        <LoadingState subtitle="We halen de conversatie op…" />
      ) : error ? (
        <main className="app-page-shell app-page-shell-wide">
          <ErrorState message={error} onRetry={() => void loadThread()} />
        </main>
      ) : !thread ? (
        <main className="app-page-shell app-page-shell-wide">
          <ErrorState
            message="Doorgestuurde vraag niet gevonden."
            onRetry={() => router.push("/fleet-manager/escalations")}
          />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="border-b border-border bg-card/40 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-[15px] font-semibold">{title}</h1>
                {headerSubtitle}
              </div>
              {status ? (
                <EscalationStatusBadge className="shrink-0" status={status} size="compact" />
              ) : null}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.push("/fleet-manager/escalations")}
                className="h-9 rounded-lg border border-border bg-background px-3 text-[13px] font-semibold shadow-sm hover:bg-muted/40"
              >
                Terug naar lijst
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {thread.messages.length === 0 ? (
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

          <div className="shrink-0 border-t border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between gap-3 pb-2">
              <label className="flex cursor-pointer items-center gap-2 text-[12px] text-muted-foreground">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={markResolved}
                  onChange={(e) => setMarkResolved(e.target.checked)}
                  disabled={busy}
                />
                Markeer als afgehandeld
              </label>
              <span className="text-[12px] text-muted-foreground">
                {busy ? "Bezig…" : " "}
              </span>
            </div>

            <div className="flex items-end gap-2">
              <textarea
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                placeholder="Stuur een manueel bericht (fleet manager)…"
                disabled={busy}
                rows={2}
                className="min-h-[44px] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-[15px] leading-snug text-foreground placeholder:text-muted-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => void sendReply()}
                disabled={busy || reply.trim().length === 0}
                className="h-10 shrink-0 rounded-lg bg-red-600 px-4 text-[14px] font-semibold text-white shadow-sm transition-[filter,transform] hover:brightness-110 disabled:opacity-40"
              >
                {busy ? "…" : "Verstuur"}
              </button>
            </div>
            <p className="mt-2 text-[12px] text-muted-foreground">
              Dit bericht verschijnt bij de medewerker in dezelfde chat, maar wordt niet door de AI verstuurd.
            </p>
          </div>
        </main>
      )}
    </div>
  );
}

