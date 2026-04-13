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
import type { ChatMessage, ChatPostResponse } from "@/types/chat";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [voornaam, setVoornaam] = useState("");

  const router = useRouter();
  const supabase = createClient();

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
        .select("voornaam")
        .eq("emailadres", user.email)
        .maybeSingle();

      if (medewerker?.voornaam) {
        setVoornaam(medewerker.voornaam);
      }

      try {
        await loadMessages();
      } catch (e) {
        console.error(e);
        toast.error("Kon je chatgeschiedenis niet laden.");
      } finally {
        setIsBootLoading(false);
      }
    };

    checkAuth();
  }, [router, supabase, loadMessages]);

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
        const messageForApi =
          trimmed || (files.length > 0 ? "Bijlagen toegevoegd." : "");

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
          return;
        }

        await loadMessages();
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
        } catch {
          /* ignore */
        }
      } finally {
        setIsLoading(false);
      }
    },
    [loadMessages],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-dvh min-h-0 max-h-dvh flex-col overflow-hidden bg-chat-canvas">
      {isBootLoading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <LoadingState message="Even inladen..." />
        </div>
      ) : (
        <>
          <AppHeader userEmail={userEmail} />

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
              {!hasMessages && (
                <WelcomeCard voornaam={voornaam} onAction={sendMessage} />
              )}

              <ChatMessageList messages={messages} isLoading={isLoading} />
            </div>

            <ChatComposer onSend={sendMessage} disabled={isLoading} />
          </main>
        </>
      )}
    </div>
  );
}
