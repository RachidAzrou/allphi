"use client";

/**
 * Scan-fallback flow voor het Europees aanrijdingsformulier.
 * Partij A scant een papieren formulier ipv door de wizard te gaan; we
 * combineren de pagina's tot één PDF en uploaden naar de private storage
 * bucket `ongeval-scans`. De fleetmanager-mailing (iteratie 2) hangt er
 * op als attachment.
 *
 * Deze component verwacht een ingelogde Partij A. Guest-mode (Partij B met
 * QR-secret) komt nooit op deze step uit, want submission_mode wordt enkel
 * door A gekozen.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Camera, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { TbPhotoShare } from "react-icons/tb";
import { toast } from "sonner";
import { PDFDocument, PageSizes } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import type { OngevalLang } from "@/lib/ongeval/i18n";
import { t } from "@/lib/ongeval/i18n";
import type { AccidentReportState, ScanSubmission } from "@/types/ongeval";

type CapturedPage = {
  /** Stable id voor reorder/delete zonder data-collisions. */
  id: string;
  /** Originele bron-blob (JPEG/PNG); HEIC wordt door iOS bij upload geconverteerd. */
  blob: Blob;
  /** Object URL voor thumbnail-rendering (revoke bij delete). */
  previewUrl: string;
};

const ACCEPTED_TYPES = "image/jpeg,image/png";
const MAX_PAGES = 10;
const MAX_BYTES_PER_PAGE = 12 * 1024 * 1024;

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function buildPdfFromImages(blobs: Blob[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const blob of blobs) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const isPng = blob.type === "image/png";
    // pdf-lib accepteert enkel JPG/PNG; we filteren al op input maar val
    // alsnog terug op JPG-pad als het MIME-type leeg is (sommige iOS-versies).
    const img = isPng
      ? await pdf.embedPng(bytes)
      : await pdf.embedJpg(bytes);
    const page = pdf.addPage(PageSizes.A4);
    const { width: pw, height: ph } = page.getSize();
    const margin = 24;
    const maxW = pw - margin * 2;
    const maxH = ph - margin * 2;
    const ratio = Math.min(maxW / img.width, maxH / img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    page.drawImage(img, {
      x: (pw - w) / 2,
      y: (ph - h) / 2,
      width: w,
      height: h,
    });
  }
  return await pdf.save();
}

type ScanCaptureStepProps = {
  reportId: string;
  state: AccidentReportState;
  lang: OngevalLang;
  onUpdateState: (patch: Partial<AccidentReportState>) => void;
  /** Wordt aangeroepen na succesvolle upload zodat de wizard kan voortgaan. */
  onUploaded: (next: ScanSubmission) => void;
};

/**
 * Toont de scan-PDF in een iframe via een signed URL uit de bucket.
 * Wordt op de `complete`-stap getoond wanneer submissionMode === "scan".
 */
export function ScanPdfPreview({
  storagePath,
  lang,
}: {
  storagePath: string | null;
  lang: OngevalLang;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [url, setUrl] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  // Versie-teller om manueel hertekenen te triggeren zonder setState in
  // de effect-body (vermijdt react-hooks/set-state-in-effect waarschuwing).
  const [reloadTick, setReloadTick] = useState(0);
  const triggerReload = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    if (!storagePath) return;
    let cancelled = false;
    void supabase.storage
      .from("ongeval-scans")
      .createSignedUrl(storagePath, 60 * 10)
      .then(({ data, error: signErr }) => {
        if (cancelled) return;
        if (signErr || !data?.signedUrl) {
          setSignError(signErr?.message ?? "sign_failed");
          return;
        }
        setSignError(null);
        setUrl(data.signedUrl);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, storagePath, reloadTick]);

  const error = !storagePath ? "missing" : signError;

  if (error) {
    return (
      <div className="mx-4 my-4 flex flex-col gap-2 rounded-2xl border border-[#E11D2E]/30 bg-[#FDECEE] px-4 py-3 text-[13px] text-[#7A1F18]">
        <p>{t(lang, "scan.preview_error")}</p>
        <Button
          type="button"
          variant="outline"
          onClick={triggerReload}
          className="h-9 w-fit rounded-md text-[12px]"
        >
          {t(lang, "common.retry")}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-4 my-4 overflow-hidden rounded-2xl border border-black/[0.06] bg-[#F7F9FC]">
      {url ? (
        <iframe
          src={url}
          title="Scan preview"
          className="h-[420px] w-full"
        />
      ) : (
        <div className="flex h-[160px] items-center justify-center text-[13px] text-[#5F7382]">
          {t(lang, "complete.loading")}
        </div>
      )}
    </div>
  );
}

export function ScanCaptureStep({
  reportId,
  state,
  lang,
  onUpdateState,
  onUploaded,
}: ScanCaptureStepProps) {
  const supabase = useMemo(() => createClient(), []);
  const [pages, setPages] = useState<CapturedPage[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const meta = state.scanSubmission.metadata;
  const alreadyUploaded =
    state.scanSubmission.storagePath !== null &&
    state.scanSubmission.uploadedAt !== null;

  const updateMeta = useCallback(
    (patch: Partial<ScanSubmission["metadata"]>) => {
      onUpdateState({
        scanSubmission: {
          ...state.scanSubmission,
          metadata: { ...state.scanSubmission.metadata, ...patch },
        },
      });
    },
    [onUpdateState, state.scanSubmission],
  );

  const addFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setPages((prev) => {
        const next = [...prev];
        for (const f of Array.from(files)) {
          if (next.length >= MAX_PAGES) {
            toast.error(t(lang, "scan.error.too_many"));
            break;
          }
          const okType =
            f.type === "image/jpeg" || f.type === "image/png" || f.type === "";
          if (!okType) {
            toast.error(t(lang, "scan.error.bad_type"));
            continue;
          }
          if (f.size > MAX_BYTES_PER_PAGE) {
            toast.error(t(lang, "scan.error.too_large"));
            continue;
          }
          next.push({
            id: uid(),
            blob: f,
            previewUrl: URL.createObjectURL(f),
          });
        }
        return next;
      });
    },
    [lang],
  );

  const removePage = useCallback((id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const movePage = useCallback((id: string, direction: -1 | 1) => {
    setPages((prev) => {
      const idx = prev.findIndex((p) => p.id === id);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      next.splice(target, 0, removed);
      return next;
    });
  }, []);

  const upload = useCallback(async () => {
    if (pages.length === 0) {
      toast.error(t(lang, "scan.error.no_pages"));
      return;
    }
    setIsUploading(true);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error("not_authenticated");

      const pdfBytes = await buildPdfFromImages(pages.map((p) => p.blob));
      const path = `${user.id}/${reportId}/document.pdf`;
      // Slice naar nieuw ArrayBuffer zodat TS niet zeurt over SharedArrayBuffer.
      const pdfBlob = new Blob(
        [pdfBytes.slice().buffer as ArrayBuffer],
        { type: "application/pdf" },
      );
      const { error: uploadErr } = await supabase.storage
        .from("ongeval-scans")
        .upload(path, pdfBlob, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (uploadErr) throw uploadErr;

      const uploadedAt = new Date().toISOString();
      const { error: dbErr } = await supabase
        .from("ongeval_aangiften")
        .update({
          submission_mode: "scan",
          scan_storage_path: path,
          scan_page_count: pages.length,
          scan_uploaded_at: uploadedAt,
        })
        .eq("id", reportId);
      if (dbErr) throw dbErr;

      const next: ScanSubmission = {
        ...state.scanSubmission,
        storagePath: path,
        pageCount: pages.length,
        uploadedAt,
      };
      onUploaded(next);
      toast.success(t(lang, "scan.upload_success"));
    } catch (e) {
      console.error("[scan] upload failed", e);
      toast.error(t(lang, "scan.error.upload_failed"));
    } finally {
      setIsUploading(false);
    }
  }, [pages, supabase, reportId, state.scanSubmission, onUploaded, lang]);

  const canUpload =
    pages.length >= 1 &&
    meta.datum.trim().length > 0 &&
    meta.stad.trim().length > 0 &&
    meta.nummerplaat.trim().length > 0 &&
    !isUploading;

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
          {t(lang, "scan.pages_title")}
        </h3>
        <p className="text-[12.5px] leading-snug text-[#5F7382]">
          {t(lang, "scan.pages_help")}
        </p>

        <input
          ref={cameraInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={galleryInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={pages.length >= MAX_PAGES || alreadyUploaded}
            className="h-12 justify-center gap-2 rounded-xl bg-[#2799D7] text-[14px] font-semibold text-white shadow-sm hover:bg-[#1e7bb0] disabled:opacity-50"
          >
            <Camera aria-hidden="true" className="size-4" />
            {t(lang, "scan.button_camera")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => galleryInputRef.current?.click()}
            disabled={pages.length >= MAX_PAGES || alreadyUploaded}
            className="h-12 justify-center gap-2 rounded-xl border-[#2799D7]/30 text-[14px] font-semibold text-[#2799D7] hover:bg-[#E8F4FB] disabled:opacity-50"
          >
            <TbPhotoShare aria-hidden="true" className="size-4" />
            {t(lang, "scan.button_gallery")}
          </Button>
        </div>

        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#DCE6EE] bg-[#F7F9FC] px-4 py-8 text-center">
            <Plus className="size-6 text-[#2799D7]/60" strokeWidth={1.75} />
            <p className="text-[13px] text-[#5F7382]">
              {t(lang, "scan.empty")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pages.map((page, idx) => (
              <li
                key={page.id}
                className="flex items-center gap-3 rounded-2xl border border-black/[0.06] bg-white p-2 shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.previewUrl}
                  alt={`Pagina ${idx + 1}`}
                  className="h-20 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-[#163247]">
                    {t(lang, "scan.page_label")} {idx + 1}
                  </p>
                  <p className="truncate text-[11.5px] text-[#5F7382]">
                    {(page.blob.size / 1024).toFixed(0)} KB
                  </p>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => movePage(page.id, -1)}
                      disabled={idx === 0}
                      className="rounded-md border border-black/[0.06] px-2 py-0.5 text-[11px] text-[#5F7382] disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => movePage(page.id, 1)}
                      disabled={idx === pages.length - 1}
                      className="rounded-md border border-black/[0.06] px-2 py-0.5 text-[11px] text-[#5F7382] disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePage(page.id)}
                  className="flex size-9 items-center justify-center rounded-lg text-[#B42318] transition hover:bg-[#FDECEE]"
                  aria-label={t(lang, "scan.remove_page")}
                >
                  <Trash2 className="size-4" strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
          {t(lang, "scan.metadata_title")}
        </h3>
        <p className="text-[12.5px] leading-snug text-[#5F7382]">
          {t(lang, "scan.metadata_help")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#5F7382]">
              {t(lang, "scan.field_datum")}
              <span className="ml-0.5 text-[#E11D2E]">*</span>
            </span>
            <Input
              type="date"
              value={meta.datum}
              onChange={(e) => updateMeta({ datum: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-[#5F7382]">
              {t(lang, "scan.field_stad")}
              <span className="ml-0.5 text-[#E11D2E]">*</span>
            </span>
            <Input
              value={meta.stad}
              onChange={(e) => updateMeta({ stad: e.target.value })}
              placeholder="Brussel"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-[#5F7382]">
            {t(lang, "scan.field_nummerplaat")}
            <span className="ml-0.5 text-[#E11D2E]">*</span>
          </span>
          <Input
            value={meta.nummerplaat}
            onChange={(e) => updateMeta({ nummerplaat: e.target.value })}
            placeholder="1-ABC-123"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-[#5F7382]">
            {t(lang, "scan.field_notitie")}
          </span>
          <Input
            value={meta.notitie}
            onChange={(e) => updateMeta({ notitie: e.target.value })}
            placeholder={t(lang, "scan.field_notitie_placeholder")}
          />
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={() => void upload()}
          disabled={!canUpload}
          className="h-12 w-full justify-center gap-2 rounded-xl bg-[#2389C4] text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(35,137,196,0.25)] hover:bg-[#1e7bb0] disabled:opacity-50 disabled:shadow-none"
        >
          {isUploading ? (
            <RefreshCw className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload aria-hidden="true" className="size-4" />
          )}
          {isUploading
            ? t(lang, "scan.uploading")
            : alreadyUploaded
              ? t(lang, "scan.reupload")
              : t(lang, "scan.upload")}
        </Button>
        {alreadyUploaded ? (
          <p className="text-center text-[11.5px] text-[#5F7382]">
            {t(lang, "scan.already_uploaded")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
