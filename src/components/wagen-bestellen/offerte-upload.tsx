"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Paperclip, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ACCEPT =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";

export type UploadedOffer = {
  storagePath: string;
  filename: string;
  uploadedAt: string;
};

export function OfferteUpload({
  bestellingId,
  existingPath,
  disabled,
  onUploaded,
}: {
  bestellingId: string;
  existingPath?: string | null;
  disabled?: boolean;
  onUploaded: (u: UploadedOffer) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const upload = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const {
          data: { user },
          error: userErr,
        } = await supabase.auth.getUser();
        if (userErr || !user) throw new Error("not_authenticated");

        const safeName = file.name.replace(/[^\w.\- ()]/g, "_");
        const path = `${user.id}/${bestellingId}/${Date.now()}-${safeName}`;

        const { error: uploadErr } = await supabase.storage
          .from("wagen-offertes")
          .upload(path, file, {
            contentType: file.type || "application/octet-stream",
            upsert: true,
          });
        if (uploadErr) throw uploadErr;

        const uploadedAt = new Date().toISOString();
        onUploaded({ storagePath: path, filename: file.name, uploadedAt });
        toast.success("Offerte geüpload.");
      } catch (e) {
        console.error("[wagen-bestellen] offer upload failed", e);
        toast.error("Upload mislukt. Probeer opnieuw.");
      } finally {
        setUploading(false);
      }
    },
    [bestellingId, onUploaded, supabase],
  );

  const canUpload = !disabled && !uploading;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />

      <div
        className={cn(
          "rounded-2xl border border-border bg-card p-4 shadow-sm",
          uploading && "opacity-80",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[14px] font-semibold text-foreground">Offerte upload</p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Upload je dealer-offerte (PDF/DOCX). We gebruiken dit voor automatische checks.
            </p>
          </div>
          <UploadCloud className="mt-0.5 size-5 text-muted-foreground" aria-hidden />
        </div>

        {existingPath ? (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-[13px] text-muted-foreground">
            <Paperclip className="size-4 text-primary" aria-hidden />
            <span className="truncate">Offerte aanwezig</span>
          </div>
        ) : null}

        <div className="mt-4">
          <Button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={!canUpload}
            className="h-11 w-full rounded-xl text-[14px] font-semibold"
          >
            {uploading ? "Bezig met uploaden…" : "Offerte kiezen en uploaden"}
          </Button>
        </div>
      </div>
    </div>
  );
}

