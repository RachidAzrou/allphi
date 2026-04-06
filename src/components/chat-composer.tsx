"use client";

import { useState, useRef, useEffect } from "react";
import { SendHorizonal } from "lucide-react";

interface ChatComposerProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="sticky bottom-0 bg-white border-t border-[#DCE6EE] safe-bottom">
      <div className="flex items-end gap-2 px-3 py-3 max-w-2xl mx-auto">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Stel een vraag..."
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-xl border border-[#DCE6EE] bg-[#F7F9FC]
                     px-4 py-2.5 text-sm text-[#163247] placeholder:text-[#5F7382]/60
                     focus:outline-none focus:ring-2 focus:ring-[#2799D7]/30 focus:border-[#2799D7]
                     disabled:opacity-50 transition-all"
        />
        <button
          onClick={handleSubmit}
          disabled={!value.trim() || disabled}
          className="shrink-0 w-10 h-10 rounded-xl bg-[#2799D7] text-white
                     flex items-center justify-center
                     hover:bg-[#1E7AB0] active:scale-95
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all duration-150"
          aria-label="Verstuur"
        >
          <SendHorizonal className="w-4.5 h-4.5" />
        </button>
      </div>
    </div>
  );
}
