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
  /** Mobiele camera i.p.v. bestandkiezer; optioneel. */
  showCamera?: boolean;
}

export function ChatComposer({
  onSend,
  disabled,
  showCamera = false,
}: ChatComposerProps) {
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
    setFiles((prev) => {
      const next: File[] = [...prev];
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
      return next;
    });
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
    <div className="shrink-0 border-t border-border bg-card safe-bottom">
      <div className="w-full max-w-none min-w-0 px-safe py-3">
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f, i) => (
              <span
                key={`${f.name}-${i}-${f.lastModified}`}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border bg-muted/40 py-1 pl-2.5 pr-1 text-[13px] text-foreground"
              >
                <Paperclip
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  strokeWidth={2}
                  aria-hidden
                />
                <span className="min-w-0 truncate">{f.name}</span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="flex h-7 w-7 shrink-0 touch-manipulation items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
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
            placeholder="Stel je vraag…"
            disabled={disabled}
            rows={1}
            enterKeyHint="send"
            autoComplete="off"
            autoCorrect="on"
            className="min-h-[44px] max-h-[min(40dvh,140px)] flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2.5 text-[16px] leading-snug text-foreground placeholder:text-muted-foreground shadow-sm
                       focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30
                       disabled:opacity-50 touch-manipulation"
          />

          <input
            ref={fileInputRef}
            type="file"
            className="sr-only"
            accept={CHAT_ATTACHMENT_INPUT_ACCEPT}
            multiple
            tabIndex={-1}
            capture={showCamera ? "environment" : undefined}
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled || files.length >= MAX_CHAT_ATTACHMENTS}
            className="mb-px flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border border-input bg-background text-muted-foreground shadow-sm
                       hover:bg-muted hover:text-foreground active:scale-[0.98]
                       disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-background
                       transition-colors"
            aria-label="Bijlage toevoegen"
          >
            <Paperclip className="h-5 w-5" strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSend}
            className="stitch-btn-primary mb-px flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg shadow-sm
                       disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:filter-none
                       transition-[filter,transform]"
            aria-label="Verstuur"
          >
            <ArrowUp className="h-5 w-5" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </div>
  );
}
