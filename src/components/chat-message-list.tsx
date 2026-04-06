"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MessageCircle, User } from "lucide-react";
import type { ChatMessage } from "@/types/chat";
import { AssistantResponseCard } from "./assistant-response-card";

interface ChatMessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  if (messages.length === 0 && !isLoading) return null;

  return (
    <div className="flex-1 px-4 space-y-4 pb-4">
      {messages.map((msg) => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {msg.role === "user" ? (
            <UserBubble content={msg.content} />
          ) : (
            <AssistantBubble message={msg} />
          )}
        </motion.div>
      ))}

      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-start gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-[#2799D7] flex items-center justify-center shrink-0">
            <MessageCircle className="w-4 h-4 text-white" />
          </div>
          <div className="bg-white border border-[#DCE6EE] rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#2799D7] animate-[pulse_1s_ease-in-out_infinite]" />
              <div className="w-2 h-2 rounded-full bg-[#2799D7] animate-[pulse_1s_ease-in-out_0.2s_infinite]" />
              <div className="w-2 h-2 rounded-full bg-[#2799D7] animate-[pulse_1s_ease-in-out_0.4s_infinite]" />
            </div>
          </div>
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="flex items-start gap-2 max-w-[85%] flex-row-reverse">
        <div className="w-8 h-8 rounded-full bg-[#163247] flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
        <div className="bg-[#2799D7] text-white rounded-2xl rounded-tr-md px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    </div>
  );
}

function AssistantBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex items-start gap-3 max-w-[92%]">
      <div className="w-8 h-8 rounded-full bg-[#2799D7] flex items-center justify-center shrink-0 mt-0.5">
        <MessageCircle className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 space-y-3 min-w-0">
        <div className="bg-white border border-[#DCE6EE] rounded-2xl rounded-tl-md px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <div
            className="text-sm text-[#163247] leading-relaxed prose-sm [&_strong]:font-semibold [&_strong]:text-[#163247]"
            dangerouslySetInnerHTML={{ __html: formatMarkdown(message.content) }}
          />
        </div>

        {message.cards?.map((card, i) => (
          <AssistantResponseCard key={i} card={card} />
        ))}
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");
}
