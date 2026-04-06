"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { WelcomeCard } from "@/components/welcome-card";
import { QuickActions } from "@/components/quick-actions";
import { ChatMessageList } from "@/components/chat-message-list";
import { ChatComposer } from "@/components/chat-composer";
import { LoadingState } from "@/components/loading-state";
import type { ChatMessage, IntentResult } from "@/types/chat";

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userEmail, setUserEmail] = useState<string>("");
  const [voornaam, setVoornaam] = useState<string>("");

  const router = useRouter();
  const supabase = createClient();

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
        .eq("email", user.email)
        .maybeSingle();

      if (medewerker?.voornaam) {
        setVoornaam(medewerker.voornaam);
      }

      setIsAuthLoading(false);
    };

    checkAuth();
  }, [router, supabase]);

  const sendMessage = useCallback(
    async (content: string) => {
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content }),
        });

        const result: IntentResult = await response.json();

        const assistantMessage: ChatMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: result.message,
          timestamp: new Date(),
          intent: result.intent,
          cards: result.cards,
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "Er is een fout opgetreden bij het verwerken van je vraag. Probeer het opnieuw.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F9FC]">
        <LoadingState message="Even inladen..." />
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <AppHeader userEmail={userEmail} />

      <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          {!hasMessages && (
            <>
              <WelcomeCard voornaam={voornaam} />
              <QuickActions onAction={sendMessage} />
            </>
          )}

          <ChatMessageList messages={messages} isLoading={isLoading} />
        </div>

        <ChatComposer onSend={sendMessage} disabled={isLoading} />
      </main>
    </div>
  );
}
