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
import { Camera, Download, Plus, Trash2, Upload } from "lucide-react";
import { TbPhotoShare } from "react-icons/tb";
import { toast } from "sonner";
import { PDFDocument, PageSizes } from "pdf-lib";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AllphiLoader } from "@/components/allphi-loader";
import { createClient } from "@/lib/supabase/client";
import type { OngevalLang } from "@/lib/ongeval/i18n";
import { t } from "@/lib/ongeval/i18n";
import { isPlaceholderPlate, normalizeBelgianPlate } from "@/lib/formatters/plate";
import type { AccidentReportState, ScanSubmission } from "@/types/ongeval";

type CapturedPage = {
  /** Stable id voor reorder/delete zonder data-collisions. */
  id: string;
  /** Originele bron-blob (JPEG/PNG); HEIC wordt door iOS bij upload geconverteerd. */
  blob: Blob;
  /** Object URL voor thumbnail-rendering (revoke bij delete). */
  previewUrl: string;
};

// iOS camera/library levert soms HEIC/HEIF; we normaliseren client-side naar JPEG.
const ACCEPTED_TYPES = "image/*";
const MAX_PAGES = 10;
const MAX_BYTES_PER_PAGE = 12 * 1024 * 1024;

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function normalizeImageToJpeg(file: File): Promise<Blob> {
  // pdf-lib ondersteunt enkel JPG/PNG. We converteren alles naar JPG (behalve PNG).
  if (file.type === "image/png") return file;
  if (file.type === "image/jpeg" || file.type === "") return file;

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = objectUrl;
    await img.decode();

    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no_canvas_context");
    ctx.drawImage(img, 0, 0);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error("to_blob_failed"))),
        "image/jpeg",
        0.9,
      );
    });
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
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
  reportId,
  storagePath,
  lang,
}: {
  reportId: string;
  storagePath: string | null;
  lang: OngevalLang;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [resolvedPath, setResolvedPath] = useState<string | null>(storagePath);
  const [url, setUrl] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  // Versie-teller om manueel hertekenen te triggeren zonder setState in
  // de effect-body (vermijdt react-hooks/set-state-in-effect waarschuwing).
  const [reloadTick, setReloadTick] = useState(0);
  const triggerReload = useCallback(() => setReloadTick((n) => n + 1), []);

  useEffect(() => {
    setResolvedPath(storagePath);
  }, [storagePath]);

  useEffect(() => {
    // Als de wizard state na refresh/restore geen storagePath meer heeft,
    // proberen we hem te herstellen uit de DB kolom `scan_storage_path`.
    if (resolvedPath) return;
    let cancelled = false;
    void supabase
      .from("ongeval_aangiften")
      .select("scan_storage_path")
      .eq("id", reportId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setSignError(error.message);
          return;
        }
        const p = (data as { scan_storage_path?: string | null } | null)
          ?.scan_storage_path?.trim();
        if (p) setResolvedPath(p);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase, resolvedPath, reportId]);

  useEffect(() => {
    if (!resolvedPath) return;
    let cancelled = false;
    void supabase.storage
      .from("ongeval-scans")
      .createSignedUrl(resolvedPath, 60 * 10)
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
  }, [supabase, resolvedPath, reloadTick]);

  const error = !resolvedPath ? "missing" : signError;

  const download = useCallback(async () => {
    if (!resolvedPath) return;
    setDownloading(true);
    try {
      // Supabase zal via "download" response headers een attachment forceren.
      const { data, error: signErr } = await supabase.storage
        .from("ongeval-scans")
        // @ts-expect-error supabase-js supports `download`, typings vary per version
        .createSignedUrl(resolvedPath, 60 * 10, {
          download: `aanrijdingsformulier-scan-${reportId}.pdf`,
        });
      if (signErr || !data?.signedUrl) throw new Error(signErr?.message ?? "sign_failed");
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.download = `aanrijdingsformulier-scan-${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error("[scan] download failed", e);
      toast.error(t(lang, "complete.error_title"));
    } finally {
      setDownloading(false);
    }
  }, [supabase, resolvedPath, reportId, lang]);

  if (error) {
    return (
      <div className="mx-4 my-4 flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-[13px] text-destructive">
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
    <div className="mx-4 my-4">
      <div className="app-card overflow-hidden rounded-2xl">
        {url ? (
          <iframe src={url} title="Scan preview" className="h-[420px] w-full" />
        ) : (
          <div className="flex h-[160px] items-center justify-center text-[13px] text-muted-foreground">
            {t(lang, "complete.loading")}
          </div>
        )}
      </div>
      <div className="mx-auto mt-3 flex w-full max-w-sm flex-col gap-2">
        <Button
          type="button"
          disabled={!resolvedPath || downloading}
          onClick={() => void download()}
          className="stitch-btn-primary h-12 w-full justify-center gap-2 rounded-xl text-[15px] font-semibold shadow-[0_14px_30px_rgba(0,98,142,0.2)] active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
        >
          {downloading ? <AllphiLoader size={16} /> : <Download aria-hidden="true" />}
          {t(lang, "complete.download")}
        </Button>
      </div>
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
  const [isPlateAutoFilled, setIsPlateAutoFilled] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);

  const meta = state.scanSubmission.metadata;
  const alreadyUploaded =
    state.scanSubmission.storagePath !== null &&
    state.scanSubmission.uploadedAt !== null;

  // Wanneer je terugkomt naar deze stap (concept heropenen / navigeren),
  // wil je altijd opnieuw kunnen beginnen met een verse set pagina's.
  useEffect(() => {
    setPages((prev) => {
      for (const p of prev) URL.revokeObjectURL(p.previewUrl);
      return [];
    });
  }, [reportId, state.scanSubmission.storagePath]);

  // Cleanup bij unmount.
  useEffect(() => {
    return () => {
      for (const p of pages) URL.revokeObjectURL(p.previewUrl);
    };
  }, [pages]);

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

  useEffect(() => {
    if (meta.datum.trim()) return;
    // ISO YYYY-MM-DD, compatibel met <input type="date" />.
    const today = new Date().toISOString().slice(0, 10);
    updateMeta({ datum: today });
  }, [meta.datum, updateMeta]);

  useEffect(() => {
    if (isPlateAutoFilled) return;
    if (meta.nummerplaat.trim()) return;
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data, error } = await supabase
        .from("v_fleet_assistant_context")
        .select("nummerplaat")
        .ilike("emailadres", user.email)
        .order("nummerplaat", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.warn("[scan] could not prefill plate", error.message);
        return;
      }

      const plate = (data as { nummerplaat?: string | null } | null)?.nummerplaat
        ?.trim()
        .toUpperCase();
      if (!plate) return;

      if (isPlaceholderPlate(plate)) return;
      updateMeta({ nummerplaat: normalizeBelgianPlate(plate) });
      setIsPlateAutoFilled(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase, meta.nummerplaat, isPlateAutoFilled, updateMeta]);

  const addFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const selected = Array.from(files);

      const nextPages: CapturedPage[] = [];
      for (const f of selected) {
        // Houd rekening met al bestaande pagina's + wat we nu aan het toevoegen zijn.
        const currentCount = pages.length + nextPages.length;
        if (currentCount >= MAX_PAGES) {
          toast.error(t(lang, "scan.error.too_many"));
          break;
        }
        if (!f.type.startsWith("image/") && f.type !== "") {
          toast.error(t(lang, "scan.error.bad_type"));
          continue;
        }
        if (f.size > MAX_BYTES_PER_PAGE) {
          toast.error(t(lang, "scan.error.too_large"));
          continue;
        }

        try {
          const normalizedBlob = await normalizeImageToJpeg(f);
          const previewUrl = URL.createObjectURL(normalizedBlob);
          nextPages.push({
            id: uid(),
            blob: normalizedBlob,
            previewUrl,
          });
        } catch (e) {
          console.warn("[scan] could not normalize image", e);
          toast.error(t(lang, "scan.error.bad_type"));
        }
      }

      if (nextPages.length > 0) {
        setPages((prev) => [...prev, ...nextPages]);
      }
    },
    [lang, pages.length],
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
      // Laat de gebruiker meteen opnieuw kunnen starten zonder dat
      // de oude pagina's de "max pages" limiet blokkeren.
      setPages((prev) => {
        for (const p of prev) URL.revokeObjectURL(p.previewUrl);
        return [];
      });
      toast.success(t(lang, "scan.upload_success"));
    } catch (e) {
      console.error("[scan] upload failed", e);
      toast.error(t(lang, "scan.error.upload_failed"));
    } finally {
      setIsUploading(false);
    }
  }, [pages, supabase, reportId, state.scanSubmission, onUploaded, lang]);

  const missingRequirements = useMemo(() => {
    const missing: string[] = [];
    if (pages.length < 1) missing.push(t(lang, "scan.error.no_pages"));
    if (meta.datum.trim().length === 0) missing.push(`${t(lang, "scan.field_datum")} ontbreekt.`);
    if (meta.stad.trim().length === 0) missing.push(`${t(lang, "scan.field_stad")} ontbreekt.`);
    if (meta.nummerplaat.trim().length === 0)
      missing.push(`${t(lang, "scan.field_nummerplaat")} ontbreekt.`);
    return missing;
  }, [pages.length, meta.datum, meta.stad, meta.nummerplaat, lang]);

  const canUpload =
    pages.length >= 1 &&
    meta.datum.trim().length > 0 &&
    meta.stad.trim().length > 0 &&
    meta.nummerplaat.trim().length > 0 &&
    !isUploading;

  return (
    <div className="flex flex-col gap-6 px-4 py-5">
      <section className="flex flex-col gap-3">
        <h3 className="font-heading text-[15px] font-semibold text-foreground">
          {t(lang, "scan.pages_title")}
        </h3>
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          {t(lang, "scan.pages_help")}
        </p>

        <input
          ref={cameraInputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          capture="environment"
          className="hidden"
          onChange={(e) => {
            void addFiles(e.target.files);
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
            void addFiles(e.target.files);
            e.target.value = "";
          }}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={pages.length >= MAX_PAGES}
            className="h-12 justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-[14px] font-semibold text-primary-foreground shadow-[0_14px_30px_rgba(39,153,215,0.18)] hover:from-primary hover:to-primary disabled:opacity-50"
          >
            <Camera aria-hidden="true" className="size-4" />
            {t(lang, "scan.button_camera")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => galleryInputRef.current?.click()}
            disabled={pages.length >= MAX_PAGES}
            className="h-12 justify-center gap-2 rounded-xl border-primary/30 text-[14px] font-semibold text-primary hover:bg-secondary disabled:opacity-50"
          >
            <TbPhotoShare aria-hidden="true" className="size-4" />
            {t(lang, "scan.button_gallery")}
          </Button>
        </div>

        {pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/50 px-4 py-8 text-center">
            <Plus className="size-6 text-primary/60" strokeWidth={1.75} />
            <p className="text-[13px] text-muted-foreground">
              {t(lang, "scan.empty")}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {pages.map((page, idx) => (
              <li
                key={page.id}
                className="app-card flex items-center gap-3 rounded-2xl p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.previewUrl}
                  alt={`Pagina ${idx + 1}`}
                  className="h-20 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground">
                    {t(lang, "scan.page_label")} {idx + 1}
                  </p>
                  <p className="truncate text-[11.5px] text-muted-foreground">
                    {(page.blob.size / 1024).toFixed(0)} KB
                  </p>
                  <div className="mt-1 flex gap-1">
                    <button
                      type="button"
                      onClick={() => movePage(page.id, -1)}
                      disabled={idx === 0}
                      className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground disabled:opacity-30"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => movePage(page.id, 1)}
                      disabled={idx === pages.length - 1}
                      className="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground disabled:opacity-30"
                    >
                      ↓
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removePage(page.id)}
                  className="flex size-9 items-center justify-center rounded-lg text-destructive transition hover:bg-destructive/10"
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
        <h3 className="font-heading text-[15px] font-semibold text-foreground">
          {t(lang, "scan.metadata_title")}
        </h3>
        <p className="text-[12.5px] leading-snug text-muted-foreground">
          {t(lang, "scan.metadata_help")}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">
              {t(lang, "scan.field_datum")}
              <span className="sr-only"> (verplicht)</span>
            </span>
            <Input
              type="date"
              required
              value={meta.datum}
              onChange={(e) => updateMeta({ datum: e.target.value })}
              className="bg-white"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">
              {t(lang, "scan.field_stad")}
              <span className="sr-only"> (verplicht)</span>
            </span>
            <Input
              required
              value={meta.stad}
              onChange={(e) => updateMeta({ stad: e.target.value })}
              placeholder="Brussel"
              className="bg-white"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t(lang, "scan.field_nummerplaat")}
            <span className="sr-only"> (verplicht)</span>
          </span>
          <Input
            required
            value={meta.nummerplaat}
            onChange={(e) => updateMeta({ nummerplaat: e.target.value })}
            onBlur={(e) =>
              updateMeta({ nummerplaat: normalizeBelgianPlate(e.target.value) })
            }
            placeholder="1-ABC-123"
            disabled={isPlateAutoFilled}
            className={
              isPlateAutoFilled
                ? "bg-white disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                : "bg-white"
            }
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-muted-foreground">
            {t(lang, "scan.field_notitie")}
          </span>
          <Input
            value={meta.notitie}
            onChange={(e) => updateMeta({ notitie: e.target.value })}
            placeholder={t(lang, "scan.field_notitie_placeholder")}
            className="bg-white"
          />
        </label>
      </section>

      <section className="flex flex-col gap-2">
        <Button
          type="button"
          onClick={() => void upload()}
          disabled={!canUpload}
          className="h-12 w-full justify-center gap-2 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-[15px] font-semibold text-primary-foreground shadow-[0_14px_30px_rgba(39,153,215,0.18)] hover:from-primary hover:to-primary disabled:opacity-50 disabled:shadow-none"
        >
          {isUploading ? (
            <AllphiLoader size={16} />
          ) : (
            <Upload aria-hidden="true" className="size-4" />
          )}
          {isUploading
            ? t(lang, "scan.uploading")
            : alreadyUploaded
              ? t(lang, "scan.reupload")
              : t(lang, "scan.upload")}
        </Button>
        {!canUpload && missingRequirements.length > 0 ? (
          <div className="rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
            <p className="font-medium text-foreground/80">Nog nodig om te kunnen uploaden:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {missingRequirements.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </div>
        ) : null}
        {alreadyUploaded ? (
          <p className="text-center text-[11.5px] text-muted-foreground">
            {t(lang, "scan.already_uploaded")}
          </p>
        ) : null}
      </section>
    </div>
  );
}
