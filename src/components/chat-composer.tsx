"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowUp, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import {
  CHAT_ATTACHMENT_INPUT_ACCEPT,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENTS,
} from "@/lib/chat/attachment-limits";

interface ChatComposerProps {
  onSend: (message: string, files: File[]) => void;
  disabled?: boolean;
}

export function ChatComposer({ onSend, disabled }: ChatComposerProps) {
  const [value, setValue] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const addFiles = (list: FileList | null) => {
    if (!list?.length) return;
    const next: File[] = [...files];
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.size > MAX_CHAT_ATTACHMENT_BYTES) {
        toast.error(
          `“${f.name}” is te groot (max. ${Math.round(MAX_CHAT_ATTACHMENT_BYTES / (1024 * 1024))} MB).`,
        );
        continue;
      }
      if (next.length >= MAX_CHAT_ATTACHMENTS) {
        toast.error(`Maximaal ${MAX_CHAT_ATTACHMENTS} bijlagen.`);
        break;
      }
      next.push(f);
    }
    setFiles(next);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const trimmed = value.trim();
    if ((!trimmed && files.length === 0) || disabled) return;
    onSend(trimmed, files);
    setValue("");
    setFiles([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const canSend =
    (value.trim().length > 0 || files.length > 0) && !disabled;

  return (
    <div className="shrink-0 safe-bottom w-full min-w-0 border-t border-white/25 bg-white/65 backdrop-blur-lg supports-[backdrop-filter]:bg-white/55">
      <div className="w-full max-w-none min-w-0 px-safe pt-2 pb-2">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}-${f.lastModified}`}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-[#00000014] bg-white py-1 pl-2.5 pr-1 text-[13px] text-[#163247] shadow-[0_1px_0.5px_rgba(11,20,26,0.08)]"
              >
                <Paperclip
                  className="h-3.5 w-3.5 shrink-0 text-[#2799D7]"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-[#5F7382] transition-colors hover:bg-[#E8F4FB] hover:text-[#163247]"
                  aria-label={`Verwijder ${f.name}`}
                >
                  <X className="h-4 w-4" strokeWidth={2} />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex w-full min-w-0 items-end gap-2">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Bericht"
            disabled={disabled}
            rows={1}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
            className="min-h-[44px] max-h-[min(40dvh,120px)] flex-1 resize-none rounded-[24px] bg-white
                       px-[14px] py-2.5 text-[15px] leading-snug                      text-[#163247] placeholder:text-[#8696A0]
                       border border-[#00000014] shadow-[inset_0_1px_0_rgba(0,0,0,0.03)]
                       focus:outline-none focus:border-[#2799D7]/50 focus:ring-[3px] focus:ring-[#2799D7]/18
                       disabled:opacity-45 transition-[box-shadow,border-color] touch-manipulation"
          />

          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept={CHAT_ATTACHMENT_INPUT_ACCEPT}
            multiple
            tabIndex={-1}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || files.length >= MAX_CHAT_ATTACHMENTS}
            className="mb-0.5 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full border border-[#00000014] bg-white text-[#2799D7] shadow-[0_1px_0.5px_rgba(11,20,26,0.08)]
                       hover:bg-[#E8F4FB] active:scale-[0.96]
                       disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-white
                       transition-all duration-150"
            aria-label="Bijlage toevoegen"
          >
            <Paperclip className="h-5 w-5" strokeWidth={2.25} />
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className="mb-0.5 flex h-11 w-11 shrink-0 touch-manipulation items-center justify-center rounded-full bg-[#2799D7] text-white shadow-sm
                       hover:bg-[#1E7AB0] active:scale-[0.96]
                       disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-[#2799D7]
                       transition-all duration-150"
            aria-label="Verstuur"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  );
}
