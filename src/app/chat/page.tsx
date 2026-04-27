"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { WelcomeCard } from "@/components/welcome-card";
import { ChatMessageList } from "@/components/chat-message-list";
import { ChatComposer } from "@/components/chat-composer";
import { LoadingState } from "@/components/loading-state";
import {
  DraftChoiceDialog,
  type DraftRow,
} from "@/components/ongeval/draft-choice-dialog";
import type { ChatMessage, ChatPostResponse } from "@/types/chat";
import { createInitialAccidentState } from "@/types/ongeval";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");
  const [voornaam, setVoornaam] = useState("");
  const [showFleetManagerNav, setShowFleetManagerNav] = useState(false);
  const [hasActiveFleetEscalation, setHasActiveFleetEscalation] = useState(false);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [draftsDialogOpen, setDraftsDialogOpen] = useState(false);

  const router = useRouter();
  const supabase = createClient();

  const createNewDraftAndNavigate = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      toast.error("Je moet ingelogd zijn.");
      return;
    }
    const payload = createInitialAccidentState();
    const { data: row, error } = await supabase
      .from("ongeval_aangiften")
      .insert({
        user_id: user.id,
        status: "draft",
        payload: payload as unknown as Record<string, unknown>,
      })
      .select("id")
      .single();

    if (error || !row?.id) {
      console.error(error);
      toast.error("Kon de wizard niet openen. Probeer via het menu Ongeval melden.");
      return;
    }
    router.push(`/ongeval/${row.id}?returnTo=/chat`);
  }, [router, supabase]);

  const openAccidentWizard = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Je moet ingelogd zijn.");
        return;
      }
      const { data: rows } = await supabase
        .from("ongeval_aangiften")
        .select("id, payload, updated_at")
        .eq("user_id", user.id)
        .eq("status", "draft")
        .order("updated_at", { ascending: false });

      const list = (rows ?? []) as DraftRow[];
      if (list.length === 0) {
        await createNewDraftAndNavigate();
        return;
      }
      setDrafts(list);
      setDraftsDialogOpen(true);
    } catch (e) {
      console.error(e);
      toast.error("Kon de wizard niet openen.");
    }
  }, [supabase, createNewDraftAndNavigate]);

  const handleContinueDraft = useCallback(
    (id: string) => {
      setDraftsDialogOpen(false);
      router.push(`/ongeval/${id}?returnTo=/chat`);
    },
    [router],
  );

  const handleStartNew = useCallback(async () => {
    setDraftsDialogOpen(false);
    await createNewDraftAndNavigate();
  }, [createNewDraftAndNavigate]);

  const handleDeleteDraft = useCallback(
    async (id: string) => {
      const { error } = await supabase
        .from("ongeval_aangiften")
        .delete()
        .eq("id", id);
      if (error) {
        console.error(error);
        toast.error("Kon concept niet verwijderen.");
        return;
      }
      setDrafts((prev) => {
        const next = prev.filter((d) => d.id !== id);
        if (next.length === 0) setDraftsDialogOpen(false);
        return next;
      });
      toast.success("Concept verwijderd.");
    },
    [supabase],
  );

  const loadMessages = useCallback(async () => {
    const res = await fetch("/api/chat/messages", { credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: Array<Omit<ChatMessage, "timestamp"> & { timestamp: string }>;
    };
    setMessages(
      data.messages.map((m) => ({
        ...m,
        timestamp: new Date(m.timestamp),
      })),
    );
  }, []);

  const loadEscalationStatus = useCallback(async () => {
    const res = await fetch("/api/chat/escalation-status", {
      credentials: "same-origin",
    });
    if (!res.ok) return;
    const data = (await res.json()) as { active?: boolean };
    setHasActiveFleetEscalation(Boolean(data.active));
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        router.push("/login");
        return;
      }

      setUserEmail(user.email);

      const { data: medewerker } = await supabase
        .from("medewerkers")
        .select("voornaam, naam, role, rol")
        .eq("emailadres", user.email)
        .maybeSingle();

      if (medewerker) {
        if (medewerker.voornaam) {
          setVoornaam(medewerker.voornaam);
        }
        const volledigeNaam = [medewerker.voornaam, medewerker.naam]
          .filter((s) => typeof s === "string" && s.trim().length > 0)
          .map((s) => s.trim())
          .join(" ");
        if (volledigeNaam) {
          setUserDisplayName(volledigeNaam);
        }

        const role = (medewerker as { role?: string | null; rol?: string | null }).role ??
          (medewerker as { role?: string | null; rol?: string | null }).rol ??
          "medewerker";
        const isFleet = role === "fleet_manager" || role === "management";
        setShowFleetManagerNav(isFleet);
        if (isFleet) {
          router.replace("/inbox");
          return;
        }
      }

      try {
        await loadMessages();
        await loadEscalationStatus();
      } catch (e) {
        console.error(e);
        toast.error("Kon je chatgeschiedenis niet laden.");
      } finally {
        setIsBootLoading(false);
      }
    };

    checkAuth();
  }, [router, supabase, loadMessages, loadEscalationStatus]);

  const sendMessage = useCallback(
    async (content: string, files: File[] = []) => {
      const trimmed = content.trim();
      const optimisticId = `user-${Date.now()}`;
      const blobUrls: string[] = [];

      const userMessage: ChatMessage = {
        id: optimisticId,
        role: "user",
        content: trimmed,
        timestamp: new Date(),
        attachments:
          files.length > 0
            ? files.map((f) => {
                const url = URL.createObjectURL(f);
                blobUrls.push(url);
                return {
                  name: f.name,
                  url,
                  mime: f.type || undefined,
                };
              })
            : undefined,
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const messageForApi = trimmed;

        let response: Response;
        if (files.length === 0) {
          response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: messageForApi }),
          });
        } else {
          const fd = new FormData();
          fd.append("message", messageForApi);
          for (const f of files) {
            fd.append("files", f);
          }
          response = await fetch("/api/chat", { method: "POST", body: fd });
        }

        const result = (await response.json()) as ChatPostResponse & {
          error?: string;
        };

        const revokeBlobs = () => {
          for (const u of blobUrls) {
            URL.revokeObjectURL(u);
          }
        };

        if (!response.ok) {
          revokeBlobs();
          toast.error(
            result.error ||
              result.message ||
              "Er ging iets mis. Probeer het opnieuw.",
          );
          await loadMessages();
          await loadEscalationStatus();
          return;
        }

        await loadMessages();
        await loadEscalationStatus();
        revokeBlobs();

        if (result.persisted?.attachments?.length) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === result.persisted.userMessageId
                ? { ...m, attachments: result.persisted.attachments }
                : m,
            ),
          );
        }
      } catch {
        for (const u of blobUrls) {
          URL.revokeObjectURL(u);
        }
        toast.error(
          "Er is een fout opgetreden bij het verwerken van je vraag. Probeer het opnieuw.",
        );
        try {
          await loadMessages();
          await loadEscalationStatus();
        } catch {
          /* ignore */
        }
      } finally {
        setIsLoading(false);
      }
    },
    [loadMessages, loadEscalationStatus],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="chat-app-shell flex h-dvh min-h-0 max-h-dvh flex-col overflow-hidden">
      {isBootLoading ? (
        <div className="flex min-h-0 w-full min-w-0 flex-1 items-center justify-center">
          <LoadingState />
        </div>
      ) : (
        <>
          <AppHeader
            userEmail={userEmail}
            userDisplayName={userDisplayName}
            showFleetManagerNav={showFleetManagerNav}
          />

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
              {hasActiveFleetEscalation ? (
                <div className="px-safe pt-3">
                  <div className="rounded-2xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-foreground">
                    <p className="font-semibold">Je bent in gesprek met je fleet manager.</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">
                      Antwoorden van de fleet manager verschijnen hieronder in het rood. De chatbot blijft beschikbaar, maar je ziet duidelijke sessiescheidingen.
                    </p>
                  </div>
                </div>
              ) : null}
              {!hasMessages && (
                <WelcomeCard voornaam={voornaam} onAction={sendMessage} />
              )}

              <ChatMessageList
                messages={messages}
                isLoading={isLoading}
                onOpenAccidentWizard={openAccidentWizard}
              />
            </div>

            <ChatComposer
              onSend={sendMessage}
              disabled={isLoading}
            />
          </main>
          <DraftChoiceDialog
            open={draftsDialogOpen}
            onOpenChange={setDraftsDialogOpen}
            drafts={drafts}
            onContinue={handleContinueDraft}
            onStartNew={handleStartNew}
            onDelete={handleDeleteDraft}
          />
        </>
      )}
    </div>
  );
}
