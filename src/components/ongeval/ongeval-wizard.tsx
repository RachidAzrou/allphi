"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Building2,
  Car,
  Check,
  ChevronRight,
  ClipboardList,
  Clock,
  Camera,
  Download,
  DoorOpen,
  FilePenLine,
  GitBranch,
  ListChecks,
  ScanLine,
  Info,
  Languages,
  MapPin,
  ParkingCircle,
  Pencil,
  Plus,
  Trash2,
  QrCode,
  RefreshCw,
  Send,
  ShieldAlert,
  Smartphone,
  SmartphoneNfc,
  Split,
  Truck,
  UserCircle,
  Users,
  X,
} from "lucide-react";
import { FcTwoSmartphones } from "react-icons/fc";
import { FaCarSide } from "react-icons/fa";
import { TbCarCrash, TbPhotoShare } from "react-icons/tb";
import { GiCrackedGlass } from "react-icons/gi";
import { GoTasklist } from "react-icons/go";
import { toast } from "sonner";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WizardFooterButton, WizardShell } from "@/components/ongeval/wizard-shell";
import { ImpactDiagram } from "@/components/ongeval/impact-diagram";
import { LocationPicker } from "@/components/ongeval/location-picker";
import { ScanCaptureStep, ScanPdfPreview } from "@/components/ongeval/scan-flow";
import { SignaturePad } from "@/components/ongeval/signature-pad";
import { STEP_BANNERS } from "@/components/ongeval/step-banners";
import { isPlaceholderPlate, normalizeBelgianPlate } from "@/lib/formatters/plate";
import {
  advanceState,
  computeLocationHash,
  getNextStepId,
  getNextAfterOverviewSkip,
  getPreviousStepId,
  mergePayloadIntoState,
  popHistory,
  requiresLocationApproval,
  validateStep,
} from "@/lib/ongeval/engine";
import { toIsoDate } from "@/lib/ongeval/date-utils";
import {
  getCategoryDescription,
  getCategoryLabel,
  getDetailLabel,
  resolveLang,
  t,
  type OngevalLang,
} from "@/lib/ongeval/i18n";
import {
  CENTER_LINE_OPTIONS,
  GENERIC_SINGLE,
  LANE_CHANGE_OPTIONS,
  MANEUVER_A_OPTIONS,
  MANEUVER_B_OPTIONS,
  PRIORITY_OPTIONS,
  REAR_END_OPTIONS,
  SITUATION_CATEGORIES,
} from "@/lib/ongeval/situations";
import { formatDateForDisplay, formatTimeForDisplay } from "@/lib/ongeval/date-utils";
import type {
  AccidentReportState,
  DamagePhoto,
  OngevalStepId,
  SituationCategoryId,
} from "@/types/ongeval";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

function VandalismIcon({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <span
      aria-hidden
      className={cn("inline-block bg-current", className)}
      style={{
        WebkitMaskImage: 'url("/icons/vandalisme.png")',
        maskImage: 'url("/icons/vandalisme.png")',
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        WebkitMaskSize: "contain",
        maskSize: "contain",
      }}
    />
  );
}

function sanitizeFileName(name: string): string {
  const stripped = String(name ?? "")
    .replace(/[^\w.\-() \u00C0-\u024F]+/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return stripped.slice(0, 120) || "foto";
}

const CATEGORY_ICONS: Record<SituationCategoryId, LucideIcon> = {
  parking: ParkingCircle,
  rear_end: Car,
  maneuver: GitBranch,
  priority: ShieldAlert,
  lane_change: Split,
  opposite: ArrowLeftRight,
  door: DoorOpen,
  load: Truck,
};

function DamagePhotoUploader({
  reportId,
  guestMode,
  supabase,
  photos,
  onChange,
  lang,
}: {
  reportId: string;
  guestMode: boolean;
  supabase: ReturnType<typeof createClient>;
  photos: DamagePhoto[];
  onChange: (next: DamagePhoto[]) => void;
  lang: OngevalLang;
}) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});

  const removeAt = useCallback(
    (idx: number) => {
      const next = photos.filter((_, i) => i !== idx);
      onChange(next);
    },
    [photos, onChange],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of photos) {
        if (!p?.path) continue;
        try {
          const { data, error } = await supabase.storage
            .from(p.bucket)
            .createSignedUrl(p.path, 60 * 10);
          if (!error && data?.signedUrl) next[p.path] = data.signedUrl;
        } catch {
          // ignore: we still show filename
        }
      }
      if (cancelled) return;
      setPreviewUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [photos, supabase]);

  const onFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      if (guestMode) {
        toast.error("Foto’s toevoegen kan enkel wanneer je ingelogd bent.");
        return;
      }

      setUploading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) {
          toast.error("Je moet ingelogd zijn om foto’s toe te voegen.");
          return;
        }

        const uploaded: DamagePhoto[] = [];
        let seq = 0;
        for (const file of Array.from(files)) {
          const safe = sanitizeFileName(file.name);
          const path = `${user.id}/${reportId}/${Date.now()}-${seq}-${safe}`;
          seq += 1;

          const { error: uploadError } = await supabase.storage
            .from("ongeval-photos")
            .upload(path, file, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });
          if (uploadError) {
            console.error("[ongeval] photo upload failed", uploadError.message);
            toast.error("Uploaden mislukt. Probeer opnieuw.");
            continue;
          }

          uploaded.push({
            bucket: "ongeval-photos",
            path,
            name: safe,
            mime: file.type || "application/octet-stream",
            uploadedAt: new Date().toISOString(),
          });
        }

        if (uploaded.length > 0) {
          onChange([...photos, ...uploaded]);
          toast.success(
            lang === "fr"
              ? "Photos ajoutées."
              : lang === "en"
                ? "Photos added."
                : "Foto’s toegevoegd.",
          );
        }
      } finally {
        setUploading(false);
        if (cameraInputRef.current) cameraInputRef.current.value = "";
        if (galleryInputRef.current) galleryInputRef.current.value = "";
      }
    },
    [guestMode, supabase, reportId, photos, onChange, lang],
  );

  return (
    <div className="space-y-3">
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => void onFiles(e.currentTarget.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void onFiles(e.currentTarget.files)}
      />

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={uploading}
          variant="outline"
          className="h-12 justify-center gap-2 rounded-xl border-primary/30 text-[14px] font-semibold text-primary hover:bg-secondary disabled:opacity-50"
        >
          <Camera aria-hidden className="size-4" />
          {lang === "fr" ? "Photo" : lang === "en" ? "Take photo" : "Foto maken"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => galleryInputRef.current?.click()}
          disabled={uploading}
          className="h-12 justify-center gap-2 rounded-xl border-primary/30 text-[14px] font-semibold text-primary hover:bg-secondary disabled:opacity-50"
        >
          <TbPhotoShare aria-hidden className="size-4" />
          {lang === "fr" ? "Galerie" : lang === "en" ? "From gallery" : "Uit galerij"}
        </Button>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-muted/50 px-4 py-8 text-center">
          <Plus className="size-6 text-primary/60" strokeWidth={1.75} />
          <p className="text-[13px] text-muted-foreground">
            {lang === "fr"
              ? "Nog geen foto’s. Voeg minstens één foto toe."
              : lang === "en"
                ? "No photos yet. Add at least one photo."
                : "Nog geen foto’s. Voeg minstens één foto toe."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {photos.map((p, idx) => (
            <li key={`${p.path}-${idx}`} className="app-card flex items-center gap-3 rounded-2xl p-2">
              {previewUrls[p.path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrls[p.path]}
                  alt={p.name}
                  className="h-20 w-20 rounded-lg object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-muted/60" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">{p.name}</p>
                <p className="truncate text-[11.5px] text-muted-foreground">
                  {p.mime || "image"} • {p.uploadedAt ? new Date(p.uploadedAt).toLocaleString("nl-BE") : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => removeAt(idx)}
                className="flex size-9 items-center justify-center rounded-lg text-destructive transition hover:bg-destructive/10"
                aria-label="Foto verwijderen"
              >
                <Trash2 className="size-4" strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type OngevalWizardProps = {
  reportId: string;
  initialPayload: unknown;
  /** Guest mode (partij B zonder login): secret uit QR/link */
  guestSecret?: string | null;
  /** Chat-overlay: compacte layout en sluiten zonder route-wissel */
  embedded?: boolean;
  /** Bij embedded: terug/exit/voltooid sluiten het venster */
  onRequestClose?: () => void;
};

export function OngevalWizard({
  reportId,
  initialPayload,
  guestSecret = null,
  embedded = false,
  onRequestClose,
}: OngevalWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => {
    const raw = searchParams?.get("returnTo");
    if (!raw) return null;
    // Keep it simple and safe: only allow internal absolute paths.
    if (!raw.startsWith("/")) return null;
    return raw;
  }, [searchParams]);
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<AccidentReportState>(() => {
    const merged = mergePayloadIntoState(initialPayload);
    // Guest join (partij B zonder login) moet in de B-flow starten,
    // niet in de maker (partij A) flow.
    if (!guestSecret) return merged;
    return {
      ...merged,
      role: "B",
      currentStepId: "party_b_language",
      navigationHistory: [],
    };
  });
  const [exitOpen, setExitOpen] = useState(false);
  const [exitBusy, setExitBusy] = useState<"save" | "delete" | null>(null);
  const [saving, setSaving] = useState(false);
  const skipPersistRef = useRef(true);
  const localEditAtRef = useRef(0);
  const prefillCtxRef = useRef<{
    insuranceCompany: string;
    policyNumber: string;
    greenCardNumber: string;
    greenCardValidFrom: string;
    greenCardValidTo: string;
    vehicleMakeModel: string;
    vehiclePlate: string;
    vehicleRegistrationCountry: string;
  }>({
    insuranceCompany: "",
    policyNumber: "",
    greenCardNumber: "",
    greenCardValidFrom: "",
    greenCardValidTo: "",
    vehicleMakeModel: "",
    vehiclePlate: "",
    vehicleRegistrationCountry: "",
  });
  const [joinSecret, setJoinSecret] = useState<string | null>(null);
  const [joinQrDataUrl, setJoinQrDataUrl] = useState<string | null>(null);
  const [refreshingJoinQr, setRefreshingJoinQr] = useState(false);
  const [partyBJoinedAt, setPartyBJoinedAt] = useState<string | null>(null);

  const stepId = state.currentStepId;
  const lang: OngevalLang = resolveLang(
    state.role,
    state.partyBLanguage as OngevalLang | null,
  );
  const bannerKey = `banner_${stepId}`;
  // Vertaalde banner-tekst (val terug op NL indien key niet bestaat).
  const bannerKeyByStep: Partial<Record<OngevalStepId, string>> = {
    signature_a: "banner.signature",
    signature_b: "banner.signature",
    vehicle_contact: "banner.vehicle_contact",
    circumstances_manual: "banner.circumstances_manual",
  };
  const bannerMessageI18nKey = bannerKeyByStep[stepId];
  const bannerMessage = bannerMessageI18nKey
    ? t(lang, bannerMessageI18nKey)
    : STEP_BANNERS[stepId];
  const bannerDismissed = state.dismissedBanners[bannerKey] === true;

  const persist = useCallback(
    async (next: AccidentReportState): Promise<boolean> => {
      setSaving(true);
      try {
        if (guestSecret) {
          const res = await fetch(
            `/api/ongeval/${encodeURIComponent(reportId)}/guest`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ secret: guestSecret, payload: next }),
            },
          );
          if (!res.ok) throw new Error("guest_update_failed");
        } else {
          const { error } = await supabase
            .from("ongeval_aangiften")
            .update({
              payload: next as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            })
            .eq("id", reportId);
          if (error) throw error;
        }
        return true;
      } catch (e) {
        console.error(e);
        toast.error("Opslaan mislukt. Probeer opnieuw.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [guestSecret, reportId, supabase],
  );

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      void persist(state);
    }, 800);
    return () => clearTimeout(t);
  }, [state, persist]);

  const updateState = useCallback((patch: Partial<AccidentReportState>) => {
    localEditAtRef.current = Date.now();
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    // Guest mode (partij B zonder login) kan meestal geen Supabase Realtime updates
    // ontvangen door RLS. Daarom poll’en we de guest endpoint en mergen we payload.
    if (guestSecret) {
      let cancelled = false;
      const interval = window.setInterval(async () => {
        if (cancelled) return;
        if (Date.now() - localEditAtRef.current < 1200) return;
        try {
          const res = await fetch(
            `/api/ongeval/${encodeURIComponent(reportId)}/guest?secret=${encodeURIComponent(guestSecret)}`,
            { cache: "no-store" },
          );
          const json = (await res.json().catch(() => null)) as
            | { payload?: unknown; party_b_joined_at?: string | null }
            | null;
          if (!res.ok || !json) return;

          if (typeof json.party_b_joined_at === "string" || json.party_b_joined_at === null) {
            setPartyBJoinedAt(json.party_b_joined_at ?? null);
          }

          const remotePayload = json.payload;
          if (!remotePayload) return;

          setState((prev) => {
            const merged = mergePayloadIntoState(remotePayload);
            merged.currentStepId = prev.currentStepId;
            merged.navigationHistory = prev.navigationHistory;
            merged.role = prev.role;
            merged.dismissedBanners = prev.dismissedBanners;

            const prevApproval = (prev as any)?.locationApproval?.status as string | undefined;
            const nextApproval = (merged as any)?.locationApproval?.status as string | undefined;
            if (prev.role === "B" && prevApproval === "idle" && nextApproval === "pending") {
              toast.message("Partij A heeft plaats & tijd doorgestuurd.", {
                description: "Open de stap om te bevestigen of te weigeren.",
              });
            }

            if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
            return merged;
          });
        } catch {
          // ignore polling errors (offline/temporary)
        }
      }, 2500);
      return () => {
        cancelled = true;
        window.clearInterval(interval);
      };
    }

    const channel = supabase
      .channel(`ongeval_aangiften:${reportId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ongeval_aangiften",
          filter: `id=eq.${reportId}`,
        },
        (payload) => {
          const nextRow = (payload as any)?.new as
            | { payload?: unknown; party_b_joined_at?: string | null }
            | undefined;
          const remotePayload = nextRow?.payload as unknown;

          // Track Party B join status (used to gate share_qr).
          if (typeof nextRow?.party_b_joined_at === "string" || nextRow?.party_b_joined_at === null) {
            setPartyBJoinedAt(nextRow.party_b_joined_at ?? null);
          }

          if (!remotePayload) return;
          if (Date.now() - localEditAtRef.current < 1200) return;
          setState((prev) => {
            const merged = mergePayloadIntoState(remotePayload);
            // Keep navigation/role strictly per-device so Partij A and Partij B
            // can move through the wizard independently on their own toestel.
            merged.currentStepId = prev.currentStepId;
            merged.navigationHistory = prev.navigationHistory;
            merged.role = prev.role;
            merged.dismissedBanners = prev.dismissedBanners;
            if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
            return merged;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [guestSecret, reportId, supabase]);

  const ensureJoinQr = useCallback(
    async (mode: "existing" | "rotate" = "existing") => {
      if (mode === "rotate") setRefreshingJoinQr(true);
      try {
        let secret: string | null = null;

        if (mode === "rotate") {
          const nextSecret = Array.from(
            crypto.getRandomValues(new Uint8Array(16)),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          const { data, error } = await supabase
            .from("ongeval_aangiften")
            .update({
              join_secret: nextSecret,
              party_b_user_id: null,
              party_b_joined_at: null,
            })
            .eq("id", reportId)
            .select("join_secret")
            .maybeSingle();

          if (error) throw error;
          secret = ((data as any)?.join_secret as string | null) ?? nextSecret;
          setPartyBJoinedAt(null);
          toast.success("QR-code vernieuwd.");
        } else {
          const { data, error } = await supabase
            .from("ongeval_aangiften")
            .select("join_secret, party_b_joined_at")
            .eq("id", reportId)
            .maybeSingle();
          if (error) return;
          secret = (data as any)?.join_secret as string | null;
          setPartyBJoinedAt(((data as any)?.party_b_joined_at as string | null) ?? null);
        }

        if (!secret) return;
        setJoinSecret(secret);

        const url = `${window.location.origin}/ongeval/join?rid=${reportId}&s=${encodeURIComponent(
          secret,
        )}`;
        const png = await QRCode.toDataURL(url, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 680,
          color: {
            dark: "#163247",
            light: "#FFFFFF",
          },
        });
        setJoinQrDataUrl(png);
      } catch (e) {
        console.error(e);
        toast.error("QR-code vernieuwen mislukt.");
      } finally {
        if (mode === "rotate") setRefreshingJoinQr(false);
      }
    },
    [reportId, supabase],
  );

  useEffect(() => {
    if (stepId !== "share_qr") return;
    void ensureJoinQr("existing");
  }, [ensureJoinQr, stepId]);

  // Fallback polling voor partyBJoinedAt zolang A op share_qr wacht — dekt
  // scenario waarbij Supabase-realtime (postgres_changes) niet actief is.
  useEffect(() => {
    if (stepId !== "share_qr") return;
    if (state.role !== "A") return;
    if (partyBJoinedAt) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      const { data } = await supabase
        .from("ongeval_aangiften")
        .select("party_b_joined_at")
        .eq("id", reportId)
        .maybeSingle();
      const joined = (data as { party_b_joined_at?: string | null } | null)?.party_b_joined_at ?? null;
      if (joined) {
        setPartyBJoinedAt(joined);
        window.clearInterval(interval);
      }
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [stepId, state.role, partyBJoinedAt, reportId, supabase]);

  // Auto-advance Partij A uit de QR-deelstap zodra Partij B gekoppeld is, zodat
  // A niet blijft hangen op de QR-pagina.
  const autoAdvancedFromShareQrRef = useRef(false);
  useEffect(() => {
    if (stepId !== "share_qr") {
      autoAdvancedFromShareQrRef.current = false;
      return;
    }
    if (state.role !== "A") return;
    if (!partyBJoinedAt) return;
    if (autoAdvancedFromShareQrRef.current) return;
    autoAdvancedFromShareQrRef.current = true;
    toast.success("Partij B is gekoppeld. Ga verder met plaats en tijd.");
    setState((prev) => advanceState(prev, "location_time"));
  }, [stepId, state.role, partyBJoinedAt]);

  // Vangnet: in een 2-toestel-setup is `party_b_optional` altijd onzin —
  // Partij A hoort door naar plaats/tijd, Partij B naar het eigen formulier.
  // Voorkomt dat oude, al opgeslagen state iemand hier laat stranden.
  useEffect(() => {
    if (stepId !== "party_b_optional") return;
    if (state.devicesCount !== 2) return;
    const target = state.role === "B" ? "party_b_form" : "location_time";
    setState((prev) => advanceState(prev, target));
  }, [stepId, state.devicesCount, state.role]);

  const goNext = useCallback(() => {
    if (!validateStep(stepId, state)) {
      toast.error("Vul de verplichte velden in om verder te gaan.");
      return;
    }
    const nextId = getNextStepId(stepId, state);
    if (!nextId) return;
    setState(advanceState(state, nextId));
  }, [stepId, state]);

  const goBack = useCallback(() => {
    const prevId = getPreviousStepId(state);
    if (prevId) {
      setState(popHistory(state));
      return;
    }
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    router.push(returnTo ?? "/ongeval");
  }, [state, router, onRequestClose, returnTo]);

  const dismissBanner = useCallback(() => {
    updateState({
      dismissedBanners: { ...state.dismissedBanners, [bannerKey]: true },
    });
  }, [bannerKey, state.dismissedBanners, updateState]);

  const handleExit = useCallback(() => {
    setExitOpen(true);
  }, []);

  const leaveWizard = useCallback(() => {
    setExitOpen(false);
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    router.push(returnTo ?? "/chat");
  }, [router, onRequestClose, returnTo]);

  const saveDraftAndClose = useCallback(async () => {
    setExitBusy("save");
    try {
      const ok = await persist(state);
      if (!ok) return;
      leaveWizard();
    } finally {
      setExitBusy(null);
    }
  }, [leaveWizard, persist, state]);

  const deleteDraftAndClose = useCallback(async () => {
    if (guestSecret) return;
    setExitBusy("delete");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.id) {
        toast.error("Je moet ingelogd zijn om te verwijderen.");
        return;
      }
      const { error } = await supabase
        .from("ongeval_aangiften")
        .delete()
        .eq("id", reportId)
        .eq("user_id", user.id)
        .eq("status", "draft");
      if (error) throw error;
      toast.success("Concept verwijderd.");
      leaveWizard();
    } catch (e) {
      console.error(e);
      toast.error("Verwijderen mislukt.");
    } finally {
      setExitBusy(null);
    }
  }, [guestSecret, leaveWizard, reportId, supabase]);

  useEffect(() => {
    setState((s) => {
      const hasDate = s.location.datum.trim().length > 0;
      const hasTime = s.location.tijd.trim().length > 0;
      if (hasDate && hasTime) return s;
      const d = new Date();
      return {
        ...s,
        location: {
          ...s.location,
          datum: hasDate ? s.location.datum : d.toLocaleDateString("nl-BE"),
          tijd: hasTime
            ? s.location.tijd
            : d.toLocaleTimeString("nl-BE", {
                hour: "2-digit",
                minute: "2-digit",
              }),
        },
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email ?? "";
      if (!email) return;

      const { data: medewerker } = await supabase
        .from("medewerkers")
        .select("*")
        .ilike("emailadres", email)
        .maybeSingle();

      const { data: vctx } = await supabase
        .from("v_fleet_assistant_context")
        .select(
          "nummerplaat, merk_model, insurance_company, policy_number, green_card_number, green_card_valid_from, green_card_valid_to",
        )
        .ilike("emailadres", email)
        .order("merk_model", { ascending: true })
        .order("nummerplaat", { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: company } = await supabase
        .from("company_profile")
        .select(
          "name, contact_first_name, enterprise_number, street, house_number, box, postal_code, city, country",
        )
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      setState((prev) => {
        const next = { ...prev };

        const firstNonEmptyString = (obj: unknown, keys: string[]): string => {
          if (!obj || typeof obj !== "object") return "";
          for (const k of keys) {
            const v = (obj as any)[k];
            if (typeof v === "string" && v.trim().length > 0) return v.trim();
          }
          return "";
        };

        // Prefill employee driver basics
        if ((medewerker as any)?.voornaam && !next.employeeDriver.voornaam) {
          next.employeeDriver = {
            ...next.employeeDriver,
            voornaam: String((medewerker as any).voornaam ?? ""),
          };
        }
        if ((medewerker as any)?.naam && !next.employeeDriver.naam) {
          next.employeeDriver = {
            ...next.employeeDriver,
            naam: String((medewerker as any).naam ?? ""),
          };
        }
        if (email && !next.employeeDriver.email) {
          next.employeeDriver = { ...next.employeeDriver, email };
        }
        if ((medewerker as any)?.telefoonnummer && !next.employeeDriver.telefoon) {
          next.employeeDriver = {
            ...next.employeeDriver,
            telefoon: String((medewerker as any).telefoonnummer ?? ""),
          };
        }

        const geboortedatum =
          typeof (medewerker as any)?.geboortedatum === "string"
            ? String((medewerker as any).geboortedatum)
            : "";
        if (geboortedatum && !next.employeeDriver.geboortedatum) {
          next.employeeDriver = {
            ...next.employeeDriver,
            geboortedatum: toIsoDate(geboortedatum),
          };
        }

        const maybeSetAddress = (key: string, value: unknown) => {
          if (typeof value !== "string") return;
          if (!value.trim()) return;
          if ((next.employeeDriver.adres as any)[key]?.trim?.()) return;
          next.employeeDriver = {
            ...next.employeeDriver,
            adres: { ...next.employeeDriver.adres, [key]: value },
          };
        };
        maybeSetAddress("straat", (medewerker as any)?.straat);
        maybeSetAddress("huisnummer", (medewerker as any)?.huisnummer);
        maybeSetAddress("bus", (medewerker as any)?.bus);
        maybeSetAddress("postcode", (medewerker as any)?.postcode);
        maybeSetAddress("stad", (medewerker as any)?.stad);
        maybeSetAddress("land", (medewerker as any)?.land);

        // Prefill rijbewijs from profiel (veldnamen kunnen verschillen per dataset)
        const rijbewijsNummer = firstNonEmptyString(medewerker, [
          "rijbewijsNummer",
          "rijbewijsnummer",
          "rijbewijs_nummer",
          "license_number",
        ]);
        if (rijbewijsNummer && !next.employeeDriver.rijbewijsNummer) {
          next.employeeDriver = { ...next.employeeDriver, rijbewijsNummer };
        }

        const rijbewijsCategorie = firstNonEmptyString(medewerker, [
          "rijbewijsCategorie",
          "rijbewijscategorie",
          "rijbewijs_categorie",
          "license_category",
        ]);
        if (rijbewijsCategorie && !next.employeeDriver.rijbewijsCategorie) {
          next.employeeDriver = { ...next.employeeDriver, rijbewijsCategorie };
        }

        const rijbewijsGeldigTotRaw = firstNonEmptyString(medewerker, [
          "rijbewijsGeldigTot",
          "rijbewijsgeldigTot",
          "rijbewijsgeldig_tot",
          "license_valid_to",
        ]);
        if (rijbewijsGeldigTotRaw && !next.employeeDriver.rijbewijsGeldigTot) {
          next.employeeDriver = {
            ...next.employeeDriver,
            rijbewijsGeldigTot: toIsoDate(rijbewijsGeldigTotRaw),
          };
        }

        // When the employee is the driver, also prefill partyA.bestuurder (used in overview/PDF).
        if (next.driverWasEmployee !== false) {
          const b = next.partyA.bestuurder;
          const ed = next.employeeDriver;

          const setBestuurderIfEmpty = (
            key: keyof typeof b,
            value: unknown,
          ) => {
            if (typeof value !== "string") return;
            if (!value.trim()) return;
            if (String((b as any)[key] ?? "").trim()) return;
            next.partyA = {
              ...next.partyA,
              bestuurder: { ...next.partyA.bestuurder, [key]: value },
            };
          };

          setBestuurderIfEmpty("voornaam", ed.voornaam);
          setBestuurderIfEmpty("naam", ed.naam);
          setBestuurderIfEmpty("geboortedatum", toIsoDate(ed.geboortedatum));
          setBestuurderIfEmpty("email", ed.email);
          setBestuurderIfEmpty("telefoon", ed.telefoon);
          setBestuurderIfEmpty("rijbewijsNummer", ed.rijbewijsNummer);

          const ba = next.partyA.bestuurder.adres;
          const ea = ed.adres;
          const setBestuurderAdresIfEmpty = (k: keyof typeof ba, v: unknown) => {
            if (typeof v !== "string") return;
            if (!v.trim()) return;
            if (String((ba as any)[k] ?? "").trim()) return;
            next.partyA = {
              ...next.partyA,
              bestuurder: {
                ...next.partyA.bestuurder,
                adres: { ...next.partyA.bestuurder.adres, [k]: v },
              },
            };
          };

          setBestuurderAdresIfEmpty("straat", ea.straat);
          setBestuurderAdresIfEmpty("huisnummer", ea.huisnummer);
          setBestuurderAdresIfEmpty("bus", ea.bus);
          setBestuurderAdresIfEmpty("postcode", ea.postcode);
          setBestuurderAdresIfEmpty("stad", ea.stad);
          setBestuurderAdresIfEmpty("land", ea.land);
        }

        // Policyholder is always company: keep fields blank unless user filled them.
        if (company && typeof company === "object") {
          const cp = company as any;
          const current = next.partyA.verzekeringsnemer;

          const setIfEmpty = (key: keyof typeof current, value: unknown) => {
            if (typeof value !== "string") return;
            if (!value.trim()) return;
            if (String((current as any)[key] ?? "").trim()) return;
            next.partyA = {
              ...next.partyA,
              verzekeringsnemer: { ...next.partyA.verzekeringsnemer, [key]: value },
            };
          };

          setIfEmpty("naam", cp.name);
          setIfEmpty("voornaam", cp.contact_first_name);
          setIfEmpty("ondernemingsnummer", cp.enterprise_number);

          const ca = next.partyA.verzekeringsnemer.adres;
          const setAddrIfEmpty = (k: keyof typeof ca, v: unknown) => {
            if (typeof v !== "string") return;
            if (!v.trim()) return;
            if (String((ca as any)[k] ?? "").trim()) return;
            next.partyA = {
              ...next.partyA,
              verzekeringsnemer: {
                ...next.partyA.verzekeringsnemer,
                adres: { ...next.partyA.verzekeringsnemer.adres, [k]: v },
              },
            };
          };

          setAddrIfEmpty("straat", cp.street);
          setAddrIfEmpty("huisnummer", cp.house_number);
          setAddrIfEmpty("bus", cp.box);
          setAddrIfEmpty("postcode", cp.postal_code);
          setAddrIfEmpty("stad", cp.city);
          setAddrIfEmpty("land", cp.country);
        }

        // Prefill vehicle
        const nummerplaatRaw =
          typeof (vctx as any)?.nummerplaat === "string"
            ? String((vctx as any).nummerplaat)
            : "";
        const nummerplaat =
          nummerplaatRaw && !isPlaceholderPlate(nummerplaatRaw)
            ? normalizeBelgianPlate(nummerplaatRaw)
            : "";
        const merkModel =
          typeof (vctx as any)?.merk_model === "string"
            ? String((vctx as any).merk_model)
            : "";
        const insuranceCompany =
          typeof (vctx as any)?.insurance_company === "string"
            ? String((vctx as any).insurance_company)
            : "";
        const policyNumber =
          typeof (vctx as any)?.policy_number === "string"
            ? String((vctx as any).policy_number)
            : "";
        const greenCardNumberRaw =
          typeof (vctx as any)?.green_card_number === "string"
            ? String((vctx as any).green_card_number)
            : "";
        const greenCardNumber =
          greenCardNumberRaw.trim().toUpperCase() === "UNKNOWN" ? "" : greenCardNumberRaw;
        const greenCardValidFrom =
          greenCardNumber &&
          typeof (vctx as any)?.green_card_valid_from === "string"
            ? String((vctx as any).green_card_valid_from)
            : "";
        const greenCardValidTo =
          greenCardNumber &&
          typeof (vctx as any)?.green_card_valid_to === "string"
            ? String((vctx as any).green_card_valid_to)
            : "";

      // Bewaar welke waarden uit context kwamen (voor grey-out/lock in UI).
      prefillCtxRef.current = {
        insuranceCompany,
        policyNumber,
        greenCardNumber,
        greenCardValidFrom,
        greenCardValidTo,
        vehicleMakeModel: merkModel,
        vehiclePlate: nummerplaat,
        // Momenteel niet mee in v_fleet_assistant_context; lock deze enkel mee
        // wanneer we effectief vehicle-prefill hebben (merk/nummerplaat).
        vehicleRegistrationCountry: merkModel || nummerplaat ? "België" : "",
      };

        if (nummerplaat && !next.partyA.voertuig.nummerplaat) {
          next.partyA = {
            ...next.partyA,
            voertuig: { ...next.partyA.voertuig, nummerplaat },
          };
        }
        if (merkModel && !next.partyA.voertuig.merkModel) {
          next.partyA = {
            ...next.partyA,
            voertuig: { ...next.partyA.voertuig, merkModel },
          };
        }
        if (insuranceCompany && !next.partyA.verzekering.maatschappij) {
          next.partyA = {
            ...next.partyA,
            verzekering: {
              ...next.partyA.verzekering,
              maatschappij: insuranceCompany,
            },
          };
        }
        if (policyNumber && !next.partyA.verzekering.polisnummer) {
          next.partyA = {
            ...next.partyA,
            verzekering: { ...next.partyA.verzekering, polisnummer: policyNumber },
          };
        }
        const partyAGreenCardIsEmpty =
          !next.partyA.verzekering.groeneKaartNr ||
          next.partyA.verzekering.groeneKaartNr.trim().toUpperCase() === "UNKNOWN";
        if (greenCardNumber && partyAGreenCardIsEmpty) {
          next.partyA = {
            ...next.partyA,
            verzekering: { ...next.partyA.verzekering, groeneKaartNr: greenCardNumber },
          };
        }
        if (greenCardValidFrom && !next.partyA.verzekering.geldigVan) {
          next.partyA = {
            ...next.partyA,
            verzekering: { ...next.partyA.verzekering, geldigVan: greenCardValidFrom },
          };
        }
        if (greenCardValidTo && !next.partyA.verzekering.geldigTot) {
          next.partyA = {
            ...next.partyA,
            verzekering: { ...next.partyA.verzekering, geldigTot: greenCardValidTo },
          };
        }

        // Prefill ook voor partij B (als die flow gebruikt wordt).
        if (insuranceCompany && !next.partyB.verzekering.maatschappij) {
          next.partyB = {
            ...next.partyB,
            verzekering: { ...next.partyB.verzekering, maatschappij: insuranceCompany },
          };
        }
        if (policyNumber && !next.partyB.verzekering.polisnummer) {
          next.partyB = {
            ...next.partyB,
            verzekering: { ...next.partyB.verzekering, polisnummer: policyNumber },
          };
        }
        const partyBGreenCardIsEmpty =
          !next.partyB.verzekering.groeneKaartNr ||
          next.partyB.verzekering.groeneKaartNr.trim().toUpperCase() === "UNKNOWN";
        if (greenCardNumber && partyBGreenCardIsEmpty) {
          next.partyB = {
            ...next.partyB,
            verzekering: { ...next.partyB.verzekering, groeneKaartNr: greenCardNumber },
          };
        }
        if (greenCardValidFrom && !next.partyB.verzekering.geldigVan) {
          next.partyB = {
            ...next.partyB,
            verzekering: { ...next.partyB.verzekering, geldigVan: greenCardValidFrom },
          };
        }
        if (greenCardValidTo && !next.partyB.verzekering.geldigTot) {
          next.partyB = {
            ...next.partyB,
            verzekering: { ...next.partyB.verzekering, geldigTot: greenCardValidTo },
          };
        }

        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function renderPartyBForm() {
    const p = state.partyB;
    return (
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="rounded-2xl border border-primary/12 bg-gradient-to-br from-muted to-card px-4 py-4 shadow-sm">
          <p className="text-[14px] leading-relaxed text-muted-foreground">
            {t(lang, "party_b_form.intro")}
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-[15px] font-semibold text-foreground">
            {t(lang, "party_b_form.section.policyholder")}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t(lang, "field.firstname")}>
              <Input
                value={p.verzekeringsnemer.voornaam}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        voornaam: e.target.value,
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.lastname")}>
              <Input
                value={p.verzekeringsnemer.naam}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        naam: e.target.value,
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
          <Field label={t(lang, "field.street")}>
            <Input
              value={p.verzekeringsnemer.adres.straat}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    verzekeringsnemer: {
                      ...p.verzekeringsnemer,
                      adres: { ...p.verzekeringsnemer.adres, straat: e.target.value },
                    },
                  },
                })
              }
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t(lang, "field.housenumber")}>
              <Input
                value={p.verzekeringsnemer.adres.huisnummer}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, huisnummer: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.box")}>
              <Input
                value={p.verzekeringsnemer.adres.bus}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, bus: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.postcode")}>
              <Input
                value={p.verzekeringsnemer.adres.postcode}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, postcode: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t(lang, "field.city")}>
              <Input
                value={p.verzekeringsnemer.adres.stad}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, stad: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.country")}>
              <Input
                value={p.verzekeringsnemer.adres.land}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, land: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-[15px] font-semibold text-foreground">
            {t(lang, "party_b_form.section.insurance")}
          </h3>
          {(() => {
            const lockedInsuranceCompany =
              Boolean(prefillCtxRef.current.insuranceCompany) &&
              p.verzekering.maatschappij.trim() ===
                prefillCtxRef.current.insuranceCompany.trim();
            const lockedPolicyNumber =
              Boolean(prefillCtxRef.current.policyNumber) &&
              p.verzekering.polisnummer.trim() === prefillCtxRef.current.policyNumber.trim();
            const lockedGreenCardNumber =
              Boolean(prefillCtxRef.current.greenCardNumber) &&
              p.verzekering.groeneKaartNr.trim() === prefillCtxRef.current.greenCardNumber.trim();
            const lockedGreenCardValidFrom =
              Boolean(prefillCtxRef.current.greenCardValidFrom) &&
              p.verzekering.geldigVan.trim() ===
                prefillCtxRef.current.greenCardValidFrom.trim();
            const lockedGreenCardValidTo =
              Boolean(prefillCtxRef.current.greenCardValidTo) &&
              p.verzekering.geldigTot.trim() === prefillCtxRef.current.greenCardValidTo.trim();

            return (
              <>
          <Field label={t(lang, "field.insurance_company")}>
            <Input
              required
              value={p.verzekering.maatschappij}
              disabled={lockedInsuranceCompany}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    verzekering: { ...p.verzekering, maatschappij: e.target.value },
                  },
                })
              }
            />
          </Field>
          <Field label={t(lang, "field.policy_number")}>
            <Input
              required
              value={p.verzekering.polisnummer}
              disabled={lockedPolicyNumber}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    verzekering: { ...p.verzekering, polisnummer: e.target.value },
                  },
                })
              }
            />
          </Field>
          <section className="flex flex-col gap-3">
            <h3 className="font-heading text-[15px] font-semibold text-foreground">
              {t(lang, "insurance.extra_toggle")}
            </h3>
            <div className="flex flex-col gap-3">
              <Field label={t(lang, "insurance.green_card")} required>
                <Input
                  required
                  value={p.verzekering.groeneKaartNr}
                  disabled={lockedGreenCardNumber}
                  onChange={(e) =>
                    updateState({
                      partyB: {
                        ...p,
                        verzekering: {
                          ...p.verzekering,
                          groeneKaartNr: e.target.value,
                        },
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label={t(lang, "insurance.valid_from")} required>
                  <Input
                    required
                    type="date"
                    value={p.verzekering.geldigVan}
                    disabled={lockedGreenCardValidFrom}
                    onChange={(e) =>
                      updateState({
                        partyB: {
                          ...p,
                          verzekering: {
                            ...p.verzekering,
                            geldigVan: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t(lang, "insurance.valid_to")} required>
                  <Input
                    required
                    type="date"
                    value={p.verzekering.geldigTot}
                    disabled={lockedGreenCardValidTo}
                    onChange={(e) =>
                      updateState({
                        partyB: {
                          ...p,
                          verzekering: {
                            ...p.verzekering,
                            geldigTot: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label={t(lang, "insurance.agency")}>
                <Input
                  value={p.verzekering.agentschap.naam}
                  onChange={(e) =>
                    updateState({
                      partyB: {
                        ...p,
                        verzekering: {
                          ...p.verzekering,
                          agentschap: {
                            ...p.verzekering.agentschap,
                            naam: e.target.value,
                          },
                        },
                      },
                    })
                  }
                />
              </Field>
            </div>
          </section>
              </>
            );
          })()}
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-[15px] font-semibold text-foreground">
            {t(lang, "party_b_form.section.vehicle")}
          </h3>
          {(() => {
            const lockedVehicleMakeModel =
              Boolean(prefillCtxRef.current.vehicleMakeModel) &&
              p.voertuig.merkModel.trim() === prefillCtxRef.current.vehicleMakeModel.trim();
            const lockedVehiclePlate =
              Boolean(prefillCtxRef.current.vehiclePlate) &&
              p.voertuig.nummerplaat.trim() === prefillCtxRef.current.vehiclePlate.trim();
            const lockedVehicleRegCountry =
              (lockedVehicleMakeModel || lockedVehiclePlate) &&
              Boolean(prefillCtxRef.current.vehicleRegistrationCountry) &&
              p.voertuig.landInschrijving.trim() ===
                prefillCtxRef.current.vehicleRegistrationCountry.trim();
            return (
              <>
                <Field label={t(lang, "field.make_model")}>
                  <Input
                    value={p.voertuig.merkModel}
                    disabled={lockedVehicleMakeModel}
                    onChange={(e) =>
                      updateState({
                        partyB: {
                          ...p,
                          voertuig: { ...p.voertuig, merkModel: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label={t(lang, "field.plate")}>
                    <Input
                      value={p.voertuig.nummerplaat}
                      disabled={lockedVehiclePlate}
                      onChange={(e) =>
                        updateState({
                          partyB: {
                            ...p,
                            voertuig: {
                              ...p.voertuig,
                              nummerplaat: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label={t(lang, "field.registration_country")}>
                    <Input
                      value={p.voertuig.landInschrijving}
                      disabled={lockedVehicleRegCountry}
                      onChange={(e) =>
                        updateState({
                          partyB: {
                            ...p,
                            voertuig: {
                              ...p.voertuig,
                              landInschrijving: e.target.value,
                            },
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              </>
            );
          })()}
          <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4">
            <label className="flex cursor-pointer items-start justify-between gap-3">
              <span className="flex flex-col">
                <span className="font-heading text-[14px] font-semibold text-foreground">
                  {t(lang, "vehicle.trailer_toggle")}
                </span>
                <span className="text-[12.5px] leading-snug text-muted-foreground">
                  {t(lang, "vehicle.trailer_help")}
                </span>
              </span>
              <input
                type="checkbox"
                className="app-checkbox-primary"
                checked={p.voertuig.aanhanger !== null}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      voertuig: {
                        ...p.voertuig,
                        aanhanger: e.target.checked
                          ? { nummerplaat: "", landInschrijving: "België" }
                          : null,
                      },
                    },
                  })
                }
              />
            </label>
            {p.voertuig.aanhanger ? (
              <div className="grid grid-cols-2 gap-2">
                <Field label={t(lang, "vehicle.trailer_plate")} required>
                  <Input
                    required
                    value={p.voertuig.aanhanger.nummerplaat}
                    onChange={(e) =>
                      updateState({
                        partyB: {
                          ...p,
                          voertuig: {
                            ...p.voertuig,
                            aanhanger: {
                              ...p.voertuig.aanhanger!,
                              nummerplaat: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label={t(lang, "vehicle.trailer_country")} required>
                  <Input
                    required
                    value={p.voertuig.aanhanger.landInschrijving}
                    onChange={(e) =>
                      updateState({
                        partyB: {
                          ...p,
                          voertuig: {
                            ...p.voertuig,
                            aanhanger: {
                              ...p.voertuig.aanhanger!,
                              landInschrijving: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-[15px] font-semibold text-foreground">
            {t(lang, "party_b_form.section.driver")}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t(lang, "field.firstname")}>
              <Input
                value={p.bestuurder.voornaam}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: { ...p.bestuurder, voornaam: e.target.value },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.lastname")}>
              <Input
                value={p.bestuurder.naam}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: { ...p.bestuurder, naam: e.target.value },
                    },
                  })
                }
              />
            </Field>
          </div>
          <Field label={t(lang, "field.birthdate")}>
            <Input
              type="date"
              value={p.bestuurder.geboortedatum}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    bestuurder: { ...p.bestuurder, geboortedatum: e.target.value },
                  },
                })
              }
            />
          </Field>
          <Field label={t(lang, "field.license_number")}>
            <Input
              value={p.bestuurder.rijbewijsNummer}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    bestuurder: {
                      ...p.bestuurder,
                      rijbewijsNummer: e.target.value,
                    },
                  },
                })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t(lang, "field.license_category")}>
              <select
                className="app-select"
                value={p.bestuurder.rijbewijsCategorie}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: {
                        ...p.bestuurder,
                        rijbewijsCategorie: e.target.value,
                      },
                    },
                  })
                }
              >
                <option value="">Kies categorie…</option>
                <option value="AM">AM</option>
                <option value="A1">A1</option>
                <option value="A2">A2</option>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="BE">BE</option>
                <option value="C1">C1</option>
                <option value="C1E">C1E</option>
                <option value="C">C</option>
                <option value="CE">CE</option>
                <option value="D1">D1</option>
                <option value="D1E">D1E</option>
                <option value="D">D</option>
                <option value="DE">DE</option>
                <option value="G">G</option>
              </select>
            </Field>
            <Field label={t(lang, "field.license_valid_to")}>
              <Input
                type="date"
                value={p.bestuurder.rijbewijsGeldigTot}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: {
                        ...p.bestuurder,
                        rijbewijsGeldigTot: e.target.value,
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
          <Field label={t(lang, "field.street")}>
            <Input
              value={p.bestuurder.adres.straat}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    bestuurder: {
                      ...p.bestuurder,
                      adres: { ...p.bestuurder.adres, straat: e.target.value },
                    },
                  },
                })
              }
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t(lang, "field.housenumber")}>
              <Input
                value={p.bestuurder.adres.huisnummer}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: {
                        ...p.bestuurder,
                        adres: { ...p.bestuurder.adres, huisnummer: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.postcode")}>
              <Input
                value={p.bestuurder.adres.postcode}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: {
                        ...p.bestuurder,
                        adres: { ...p.bestuurder.adres, postcode: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.city")}>
              <Input
                value={p.bestuurder.adres.stad}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: {
                        ...p.bestuurder,
                        adres: { ...p.bestuurder.adres, stad: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
          <Field label={t(lang, "field.country")}>
            <Input
              value={p.bestuurder.adres.land}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    bestuurder: {
                      ...p.bestuurder,
                      adres: { ...p.bestuurder.adres, land: e.target.value },
                    },
                  },
                })
              }
            />
          </Field>
        </section>
      </div>
    );
  }

  function renderBody() {
    switch (stepId) {
      case "incident_kind":
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={TbCarCrash as unknown as LucideIcon}
              title="Ongeval met tegenpartij of derden"
              description="Je vult het Europees aanrijdingsformulier stap voor stap in (eventueel met partij B via QR)."
              onClick={() => {
                const next: AccidentReportState = {
                  ...state,
                  incidentKind: "accident_with_other_party",
                };
                setState(advanceState(next, "safety_police"));
              }}
            />
            <ModeCard
              icon={ClipboardList}
              title="Schade zonder tegenpartij"
              description="Eenzijdige schade, vandalisme/diefstal of glasbreuk. We begeleiden je door de melding en afhandeling."
              onClick={() => {
                const next: AccidentReportState = {
                  ...state,
                  incidentKind: "damage_only",
                };
                setState(advanceState(next, "damage_type"));
              }}
            />
          </div>
        );
      case "safety_police": {
        const hasReason = (r: AccidentReportState["policeReasons"][number]) =>
          state.policeReasons.includes(r);
        const toggleReason = (r: AccidentReportState["policeReasons"][number]) => {
          updateState({
            policeReasons: hasReason(r)
              ? state.policeReasons.filter((x) => x !== r)
              : [...state.policeReasons, r],
            hitAndRun:
              r === "hit_and_run"
                ? !hasReason("hit_and_run")
                : state.hitAndRun,
          });
        };

        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-5 text-primary" aria-hidden />
                <div className="min-w-0">
                  <h3 className="font-heading text-[15px] font-semibold text-foreground">
                    Veiligheid eerst
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Bij gewonden: bel onmiddellijk <span className="font-semibold text-foreground">112</span>.
                    Parkeer de wagen veilig als dat kan en maak de situatie veilig.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant={state.vehicleParkedSafe === true ? "default" : "outline"}
                  className="min-h-11 justify-center"
                  onClick={() => updateState({ vehicleParkedSafe: true })}
                >
                  Wagen veilig / ok
                </Button>
                <Button
                  type="button"
                  variant={state.vehicleParkedSafe === false ? "default" : "outline"}
                  className="min-h-11 justify-center"
                  onClick={() => updateState({ vehicleParkedSafe: false })}
                >
                  Niet zeker / kan niet
                </Button>
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <Info className="mt-0.5 size-5 text-primary" aria-hidden />
                <div className="min-w-0">
                  <h3 className="font-heading text-[15px] font-semibold text-foreground">
                    Wanneer politie bellen?
                  </h3>
                  <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                    Bel de politie als één van deze situaties van toepassing is.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant={hasReason("refused_to_sign") ? "default" : "outline"}
                  className="min-h-11 justify-start"
                  onClick={() => toggleReason("refused_to_sign")}
                >
                  Tegenpartij weigert te tekenen
                </Button>
                <Button
                  type="button"
                  variant={hasReason("hit_and_run") ? "default" : "outline"}
                  className="min-h-11 justify-start"
                  onClick={() => toggleReason("hit_and_run")}
                >
                  Vluchtmisdrijf
                </Button>
                <Button
                  type="button"
                  variant={hasReason("suspected_impairment") ? "default" : "outline"}
                  className="min-h-11 justify-start"
                  onClick={() => toggleReason("suspected_impairment")}
                >
                  Tegenpartij lijkt onder invloed
                </Button>
              </div>

              {state.policeReasons.length > 0 ? (
                <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[13px] text-muted-foreground">
                  Noteer het PV-nummer zodra je dat hebt. In de volgende stap kun je dit invullen.
                </div>
              ) : null}
            </section>

            {state.policeReasons.length > 0 ? (
              <section className="rounded-xl border border-border bg-card p-4">
                <h3 className="font-heading text-[15px] font-semibold text-foreground">
                  PV-nummer (optioneel nu, kan later)
                </h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                  Als de politie een PV opmaakt, noteer hier het nummer. Je kan dit later nog aanpassen.
                </p>
                <div className="mt-3">
                  <Input
                    value={state.policeReportNumber}
                    placeholder="PV-nummer"
                    onChange={(e) => updateState({ policeReportNumber: e.target.value })}
                  />
                </div>
              </section>
            ) : null}
          </div>
        );
      }
      case "damage_type":
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={GiCrackedGlass}
              title="Glasbreuk"
              description="Ruitschade (bv. sterretje, barst)."
              onClick={() => {
                const next = { ...state, damageType: "glass" as const };
                setState(advanceState(next, "damage_glass"));
              }}
            />
            <ModeCard
              icon={VandalismIcon}
              title="Diefstal / inbraak / vandalisme"
              description="Onmiddellijk aangifte doen bij de politie en PV-nummer bezorgen."
              onClick={() => {
                const next = { ...state, damageType: "theft_vandalism" as const };
                setState(advanceState(next, "damage_theft_vandalism"));
              }}
            />
            <ModeCard
              icon={TbCarCrash as unknown as React.ComponentType<{
                className?: string;
                strokeWidth?: number;
              }>}
              title="Eenzijdige schade"
              description="Bv. paaltje geraakt, parkeerschade, …"
              onClick={() => {
                const next = { ...state, damageType: "single_vehicle" as const };
                setState(advanceState(next, "damage_single_vehicle"));
              }}
            />
          </div>
        );
      case "damage_glass":
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Glasbreuk
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Contacteer een erkende hersteller (bv. Carglass). In veel contracten is er geen franchise op glasbreuk.
              </p>
              <div className="mt-4">
                <Field label="Hernemer (optioneel)">
                  <Input
                    value={state.glassRepairProvider}
                    onChange={(e) => updateState({ glassRepairProvider: e.target.value })}
                    placeholder="Carglass"
                  />
                </Field>
              </div>
            </section>
            <section className="rounded-xl border border-border bg-card p-4">
              <Field label="Heb je foto’s gemaakt?">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={state.photosTaken === true ? "default" : "outline"}
                    className="min-h-11"
                    onClick={() => updateState({ photosTaken: true })}
                  >
                    Ja
                  </Button>
                  <Button
                    type="button"
                    variant={state.photosTaken === false ? "default" : "outline"}
                    className="min-h-11"
                    onClick={() =>
                      updateState({ photosTaken: false, damagePhotos: [] })
                    }
                  >
                    Nee
                  </Button>
                </div>
              </Field>
              {state.photosTaken === true ? (
                <div className="mt-4">
                  <DamagePhotoUploader
                    reportId={reportId}
                    guestMode={Boolean(guestSecret)}
                    supabase={supabase}
                    photos={state.damagePhotos}
                    onChange={(next) =>
                      updateState({
                        photosTaken: next.length > 0 ? true : state.photosTaken,
                        damagePhotos: next,
                      })
                    }
                    lang={lang}
                  />
                </div>
              ) : null}
            </section>
          </div>
        );
      case "damage_theft_vandalism":
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Diefstal / inbraak / vandalisme
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Doe onmiddellijk aangifte bij de politie en noteer het PV-nummer.
              </p>
              <div className="mt-4">
                <Field label="PV-nummer" required>
                  <Input
                    required
                    value={state.policeReportNumber}
                    onChange={(e) => updateState({ policeReportNumber: e.target.value })}
                    placeholder="PV-nummer"
                  />
                </Field>
                <div className="mt-4">
                  <DamagePhotoUploader
                    reportId={reportId}
                    guestMode={Boolean(guestSecret)}
                    supabase={supabase}
                    photos={state.damagePhotos}
                    onChange={(next) =>
                      updateState({ photosTaken: next.length > 0 ? true : state.photosTaken, damagePhotos: next })
                    }
                    lang={lang}
                  />
                </div>
              </div>
            </section>
          </div>
        );
      case "damage_single_vehicle":
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Eenzijdige schade
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Maak duidelijke foto’s van de schade en omgeving. Vul indien mogelijk extra info in voor de claim.
              </p>
              <div className="mt-4">
                <Field label="Heb je foto’s gemaakt?">
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      variant={state.photosTaken === true ? "default" : "outline"}
                      className="min-h-11"
                      onClick={() => updateState({ photosTaken: true })}
                    >
                      Ja
                    </Button>
                    <Button
                      type="button"
                      variant={state.photosTaken === false ? "default" : "outline"}
                      className="min-h-11"
                      onClick={() =>
                        updateState({ photosTaken: false, damagePhotos: [] })
                      }
                    >
                      Nee
                    </Button>
                  </div>
                </Field>
                {state.photosTaken === true ? (
                  <div className="mt-4">
                    <DamagePhotoUploader
                      reportId={reportId}
                      guestMode={Boolean(guestSecret)}
                      supabase={supabase}
                      photos={state.damagePhotos}
                      onChange={(next) =>
                        updateState({
                          photosTaken: next.length > 0 ? true : state.photosTaken,
                          damagePhotos: next,
                        })
                      }
                      lang={lang}
                    />
                  </div>
                ) : null}
                <Field label="Notitie voor de fleet manager (optioneel)">
                  <Input
                    value={state.claimNotes}
                    onChange={(e) => updateState({ claimNotes: e.target.value })}
                    placeholder="Bv. parkeerschade op parking, geen getuigen, …"
                  />
                </Field>
              </div>
            </section>
          </div>
        );
      case "police_pv":
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                PV-nummer
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Vul het PV-nummer in dat je van de politie kreeg.
              </p>
              <div className="mt-4">
                <Field label="PV-nummer" required>
                  <Input
                    required
                    value={state.policeReportNumber}
                    onChange={(e) => updateState({ policeReportNumber: e.target.value })}
                    placeholder="PV-nummer"
                  />
                </Field>
              </div>
            </section>
          </div>
        );
      case "franchise": {
        const level = state.employeeLevel;
        const baseFranchiseEur = 600;
        const percentage =
          level === 1 ? 0.2 : level === 2 ? 0.5 : level === 3 ? 1 : null;
        const est = state.repairCostEstimateEur;
        const effectiveBase =
          typeof est === "number" && Number.isFinite(est) && est > 0 && est < baseFranchiseEur
            ? est
            : baseFranchiseEur;
        const contribution =
          percentage === null ? null : Math.round(effectiveBase * percentage);

        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Eigen risico (franchise)
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Kies je medewerkersniveau. Indien de herstelkost lager is dan €600, wordt het percentage op de werkelijke kost berekend.
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant={level === 1 ? "default" : "outline"}
                  className="min-h-11"
                  onClick={() => updateState({ employeeLevel: 1 })}
                >
                  Niveau 1
                </Button>
                <Button
                  type="button"
                  variant={level === 2 ? "default" : "outline"}
                  className="min-h-11"
                  onClick={() => updateState({ employeeLevel: 2 })}
                >
                  Niveau 2
                </Button>
                <Button
                  type="button"
                  variant={level === 3 ? "default" : "outline"}
                  className="min-h-11"
                  onClick={() => updateState({ employeeLevel: 3 })}
                >
                  Niveau 3
                </Button>
              </div>

              <div className="mt-5">
                <Field label="Schatting herstelkost (EUR, optioneel)">
                  <Input
                    inputMode="numeric"
                    value={est === null ? "" : String(est)}
                    placeholder="bv. 450"
                    onChange={(e) => {
                      const raw = e.target.value.trim();
                      if (!raw) return updateState({ repairCostEstimateEur: null });
                      const n = Number(raw.replace(",", "."));
                      updateState({
                        repairCostEstimateEur: Number.isFinite(n) ? Math.max(0, n) : null,
                      });
                    }}
                  />
                </Field>
              </div>

              {contribution !== null ? (
                <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[13px] text-muted-foreground">
                  Verwachte bijdrage: <span className="font-semibold text-foreground">€{contribution}</span>
                </div>
              ) : null}
            </section>
          </div>
        );
      }
      case "vehicle_mobility":
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Is de wagen nog mobiel?
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                Als de wagen niet meer kan rijden: bel de erkende takeldienst (zie boorddocumenten).
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={state.vehicleMobile === true ? "default" : "outline"}
                  className="min-h-11"
                  onClick={() =>
                    updateState({ vehicleMobile: true, towingRequired: false })
                  }
                >
                  Ja
                </Button>
                <Button
                  type="button"
                  variant={state.vehicleMobile === false ? "default" : "outline"}
                  className="min-h-11"
                  onClick={() =>
                    updateState({ vehicleMobile: false, towingRequired: true })
                  }
                >
                  Nee
                </Button>
              </div>
              {state.vehicleMobile === false ? (
                <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3 text-[13px] text-muted-foreground">
                  Bel de <span className="font-semibold text-foreground">geautoriseerde takeldienst</span> en volg de instructies van AllPhi/leasemaatschappij.
                </div>
              ) : null}
            </section>
          </div>
        );
      case "escalation": {
        const flagged =
          state.gewonden === true ||
          state.escalation.uncertainLiability ||
          state.escalation.heavyOrComplexDamage ||
          state.escalation.grossNegligenceSuspected ||
          state.escalation.unreportedDamageAtReturn;

        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Escalatie naar Fleet Manager
              </h3>
              <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
                We escaleren automatisch bij gewonden, complexe schade of onduidelijkheid. Duid aan wat van toepassing is (optioneel).
              </p>
              <div className="mt-4 grid grid-cols-1 gap-2">
                <Button
                  type="button"
                  variant={state.escalation.uncertainLiability ? "default" : "outline"}
                  className="min-h-11 justify-start"
                  onClick={() =>
                    updateState({
                      escalation: {
                        ...state.escalation,
                        uncertainLiability: !state.escalation.uncertainLiability,
                      },
                    })
                  }
                >
                  Onzekere aansprakelijkheid
                </Button>
                <Button
                  type="button"
                  variant={state.escalation.heavyOrComplexDamage ? "default" : "outline"}
                  className="min-h-11 justify-start"
                  onClick={() =>
                    updateState({
                      escalation: {
                        ...state.escalation,
                        heavyOrComplexDamage: !state.escalation.heavyOrComplexDamage,
                      },
                    })
                  }
                >
                  Zware of complexe schade
                </Button>
                <Button
                  type="button"
                  variant={state.escalation.grossNegligenceSuspected ? "default" : "outline"}
                  className="min-h-11 justify-start"
                  onClick={() =>
                    updateState({
                      escalation: {
                        ...state.escalation,
                        grossNegligenceSuspected: !state.escalation.grossNegligenceSuspected,
                      },
                    })
                  }
                >
                  Vermoeden grove nalatigheid
                </Button>
                <Button
                  type="button"
                  variant={state.escalation.unreportedDamageAtReturn ? "default" : "outline"}
                  className="min-h-11 justify-start"
                  onClick={() =>
                    updateState({
                      escalation: {
                        ...state.escalation,
                        unreportedDamageAtReturn: !state.escalation.unreportedDamageAtReturn,
                      },
                    })
                  }
                >
                  Schade bij inname niet vooraf gemeld
                </Button>
              </div>

              {flagged ? (
                <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[13px] text-muted-foreground">
                  Escalatie is gemarkeerd. De fleet manager krijgt extra context in het dossier/PDF.
                </div>
              ) : (
                <div className="mt-4 rounded-lg bg-muted/40 p-3 text-[13px] text-muted-foreground">
                  Geen escalatie-indicatie geselecteerd.
                </div>
              )}
            </section>
          </div>
        );
      }
      case "submission_mode":
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={ListChecks}
              title={t(lang, "submission_mode.wizard_title")}
              description={t(lang, "submission_mode.wizard_desc")}
              onClick={() => {
                const next: AccidentReportState = {
                  ...state,
                  submissionMode: "wizard",
                };
                setState(advanceState(next, "driver_select"));
              }}
            />
            <ModeCard
              icon={ScanLine}
              title={t(lang, "submission_mode.scan_title")}
              description={t(lang, "submission_mode.scan_desc")}
              onClick={() => {
                const next: AccidentReportState = {
                  ...state,
                  submissionMode: "scan",
                };
                setState(advanceState(next, "scan_capture"));
              }}
            />
          </div>
        );
      case "scan_capture":
        return (
          <ScanCaptureStep
            reportId={reportId}
            state={state}
            lang={lang}
            onUpdateState={updateState}
            onUploaded={(scan) => {
              setState((prev) =>
                advanceState(
                  { ...prev, scanSubmission: scan, submissionMode: "scan" },
                  "vehicle_mobility",
                ),
              );
            }}
          />
        );
      case "driver_select":
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={UserCircle}
              title="Ik was de bestuurder"
              description="We vullen je gegevens in vanuit je profiel (je kunt ze nog aanpassen)."
              onClick={() => {
                const next = { ...state, driverWasEmployee: true };
                setState(advanceState(next, "driver_employee_form"));
              }}
            />
            <ModeCard
              icon={Users}
              title="Een andere bestuurder"
              description="Je vult de gegevens van de bestuurder in (bv. collega, partner, …)."
              onClick={() => {
                const next = { ...state, driverWasEmployee: false };
                setState(advanceState(next, "driver_other_form"));
              }}
            />
          </div>
        );
      case "driver_employee_form": {
        const d = state.employeeDriver;
        const lockedFromProfile = true;
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Persoonsgegevens
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Voornaam" required>
                  <Input
                    required
                    value={d.voornaam}
                    disabled={lockedFromProfile}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: { ...d, voornaam: e.target.value },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            voornaam: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Naam" required>
                  <Input
                    required
                    value={d.naam}
                    disabled={lockedFromProfile}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: { ...d, naam: e.target.value },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            naam: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Geboortedatum" required>
                <Input
                  required
                  type="date"
                  value={d.geboortedatum}
                  disabled={lockedFromProfile}
                  onChange={(e) =>
                    updateState({
                      employeeDriver: { ...d, geboortedatum: e.target.value },
                      partyA: {
                        ...state.partyA,
                        bestuurder: {
                          ...state.partyA.bestuurder,
                          geboortedatum: e.target.value,
                        },
                      },
                    })
                  }
                />
              </Field>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Adres
              </h3>
              <Field label="Straat" required>
                <Input
                  required
                  value={d.adres.straat}
                  disabled={lockedFromProfile}
                  onChange={(e) =>
                    updateState({
                      employeeDriver: {
                        ...d,
                        adres: { ...d.adres, straat: e.target.value },
                      },
                      partyA: {
                        ...state.partyA,
                        bestuurder: {
                          ...state.partyA.bestuurder,
                          adres: {
                            ...state.partyA.bestuurder.adres,
                            straat: e.target.value,
                          },
                        },
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Huisnr." required>
                  <Input
                    required
                    value={d.adres.huisnummer}
                    disabled={lockedFromProfile}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, huisnummer: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              huisnummer: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Bus">
                  <Input
                    value={d.adres.bus}
                    disabled={lockedFromProfile}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, bus: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              bus: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Postcode" required>
                  <Input
                    required
                    value={d.adres.postcode}
                    disabled={lockedFromProfile}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, postcode: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              postcode: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Stad" required>
                  <Input
                    required
                    value={d.adres.stad}
                    disabled={lockedFromProfile}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, stad: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              stad: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Land" required>
                  <Input
                    required
                    value={d.adres.land}
                    disabled={lockedFromProfile}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, land: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              land: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Rijbewijs
              </h3>
              <Field label="Rijbewijsnummer" required>
                <Input
                  required
                  value={d.rijbewijsNummer}
                  onChange={(e) =>
                    updateState({
                      employeeDriver: { ...d, rijbewijsNummer: e.target.value },
                      partyA: {
                        ...state.partyA,
                        bestuurder: {
                          ...state.partyA.bestuurder,
                          rijbewijsNummer: e.target.value,
                        },
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Categorie">
                  <select
                    className="app-select"
                    value={d.rijbewijsCategorie}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: { ...d, rijbewijsCategorie: e.target.value },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            rijbewijsCategorie: e.target.value,
                          },
                        },
                      })
                    }
                  >
                    <option value="">Kies categorie…</option>
                    <option value="AM">AM</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="BE">BE</option>
                    <option value="C1">C1</option>
                    <option value="C1E">C1E</option>
                    <option value="C">C</option>
                    <option value="CE">CE</option>
                    <option value="D1">D1</option>
                    <option value="D1E">D1E</option>
                    <option value="D">D</option>
                    <option value="DE">DE</option>
                    <option value="G">G</option>
                  </select>
                </Field>
                <Field label="Geldig tot">
                  <Input
                    type="date"
                    value={d.rijbewijsGeldigTot}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: { ...d, rijbewijsGeldigTot: e.target.value },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            rijbewijsGeldigTot: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </section>
          </div>
        );
      }
      case "driver_other_form": {
        const d = state.otherDriver;
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Persoonsgegevens
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Voornaam" required>
                  <Input
                    required
                    value={d.voornaam}
                    onChange={(e) =>
                      updateState({
                        otherDriver: { ...d, voornaam: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Naam" required>
                  <Input
                    required
                    value={d.naam}
                    onChange={(e) =>
                      updateState({
                        otherDriver: { ...d, naam: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Geboortedatum" required>
                <Input
                  required
                  type="date"
                  value={d.geboortedatum}
                  onChange={(e) =>
                    updateState({
                      otherDriver: { ...d, geboortedatum: e.target.value },
                    })
                  }
                />
              </Field>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Adres
              </h3>
              <Field label="Straat" required>
                <Input
                  required
                  value={d.adres.straat}
                  onChange={(e) =>
                    updateState({
                      otherDriver: {
                        ...d,
                        adres: { ...d.adres, straat: e.target.value },
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Huisnr." required>
                  <Input
                    required
                    value={d.adres.huisnummer}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, huisnummer: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Bus">
                  <Input
                    value={d.adres.bus}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, bus: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Postcode" required>
                  <Input
                    required
                    value={d.adres.postcode}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, postcode: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Stad" required>
                  <Input
                    required
                    value={d.adres.stad}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, stad: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Land" required>
                  <Input
                    required
                    value={d.adres.land}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, land: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Rijbewijs
              </h3>
              <Field label="Rijbewijsnummer" required>
                <Input
                  required
                  value={d.rijbewijsNummer}
                  onChange={(e) =>
                    updateState({
                      otherDriver: { ...d, rijbewijsNummer: e.target.value },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Categorie">
                  <select
                    className="app-select"
                    value={d.rijbewijsCategorie}
                    onChange={(e) =>
                      updateState({
                        otherDriver: { ...d, rijbewijsCategorie: e.target.value },
                      })
                    }
                  >
                    <option value="">Kies categorie…</option>
                    <option value="AM">AM</option>
                    <option value="A1">A1</option>
                    <option value="A2">A2</option>
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="BE">BE</option>
                    <option value="C1">C1</option>
                    <option value="C1E">C1E</option>
                    <option value="C">C</option>
                    <option value="CE">CE</option>
                    <option value="D1">D1</option>
                    <option value="D1E">D1E</option>
                    <option value="D">D</option>
                    <option value="DE">DE</option>
                    <option value="G">G</option>
                  </select>
                </Field>
                <Field label="Geldig tot">
                  <Input
                    type="date"
                    value={d.rijbewijsGeldigTot}
                    onChange={(e) =>
                      updateState({
                        otherDriver: { ...d, rijbewijsGeldigTot: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
            </section>
          </div>
        );
      }
      case "policyholder_select":
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={Building2}
              title="Bedrijf"
              description="De verzekeringsnemer is altijd het bedrijf (naam + adres)."
              onClick={() => {
                const next = {
                  ...state,
                  partyA: {
                    ...state.partyA,
                    verzekeringsnemerType: "company" as const,
                  },
                };
                setState(advanceState(next, "policyholder_form"));
              }}
            />
          </div>
        );
      case "policyholder_form": {
        const p = state.partyA.verzekeringsnemer;
        const lockedFromCompanyProfile = state.partyA.verzekeringsnemerType === "company";
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Bedrijfsgegevens
              </h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Field label="Contactpersoon — optioneel">
                  <Input
                    value={p.voornaam}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: { ...p, voornaam: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Naam (bedrijf)" required>
                  <Input
                    required
                    value={p.naam}
                    disabled={lockedFromCompanyProfile}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: { ...p, naam: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Ondernemingsnummer">
                <Input
                  value={p.ondernemingsnummer}
                  disabled={lockedFromCompanyProfile}
                  onChange={(e) =>
                    updateState({
                      partyA: {
                        ...state.partyA,
                        verzekeringsnemer: {
                          ...p,
                          ondernemingsnummer: e.target.value,
                        },
                      },
                    })
                  }
                />
              </Field>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Adres
              </h3>
              <Field label="Straat" required>
                <Input
                  required
                  value={p.adres.straat}
                  disabled={lockedFromCompanyProfile}
                  onChange={(e) =>
                    updateState({
                      partyA: {
                        ...state.partyA,
                        verzekeringsnemer: {
                          ...p,
                          adres: { ...p.adres, straat: e.target.value },
                        },
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Huisnr." required>
                  <Input
                    required
                    value={p.adres.huisnummer}
                    disabled={lockedFromCompanyProfile}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, huisnummer: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Bus">
                  <Input
                    value={p.adres.bus}
                    disabled={lockedFromCompanyProfile}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, bus: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Postcode" required>
                  <Input
                    required
                    value={p.adres.postcode}
                    disabled={lockedFromCompanyProfile}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, postcode: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Stad" required>
                  <Input
                    required
                    value={p.adres.stad}
                    disabled={lockedFromCompanyProfile}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, stad: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Land" required>
                  <Input
                    required
                    value={p.adres.land}
                    disabled={lockedFromCompanyProfile}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, land: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </section>
          </div>
        );
      }
      case "insurer_select": {
        const ins = state.partyA.verzekering;
        const updateIns = (patch: Partial<typeof ins>) =>
          updateState({
            partyA: {
              ...state.partyA,
              verzekering: { ...ins, ...patch },
            },
          });
        const lockedInsuranceCompany =
          Boolean(prefillCtxRef.current.insuranceCompany) &&
          ins.maatschappij.trim() === prefillCtxRef.current.insuranceCompany.trim();
        const lockedPolicyNumber =
          Boolean(prefillCtxRef.current.policyNumber) &&
          ins.polisnummer.trim() === prefillCtxRef.current.policyNumber.trim();
        const lockedGreenCardNumber =
          Boolean(prefillCtxRef.current.greenCardNumber) &&
          ins.groeneKaartNr.trim() === prefillCtxRef.current.greenCardNumber.trim();
        const lockedGreenCardValidFrom =
          Boolean(prefillCtxRef.current.greenCardValidFrom) &&
          ins.geldigVan.trim() === prefillCtxRef.current.greenCardValidFrom.trim();
        const lockedGreenCardValidTo =
          Boolean(prefillCtxRef.current.greenCardValidTo) &&
          ins.geldigTot.trim() === prefillCtxRef.current.greenCardValidTo.trim();
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <Field label="Verzekeringsmaatschappij" required>
              <Input
                required
                value={ins.maatschappij}
                disabled={lockedInsuranceCompany}
                onChange={(e) => updateIns({ maatschappij: e.target.value })}
              />
            </Field>
            <Field label="Polisnummer" required>
              <Input
                required
                value={ins.polisnummer}
                disabled={lockedPolicyNumber}
                onChange={(e) => updateIns({ polisnummer: e.target.value })}
              />
            </Field>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-foreground">
                Extra verzekeringsdetails
              </h3>
              <Field label="Nr. groene kaart" required>
                <Input
                  required
                  value={ins.groeneKaartNr}
                  disabled={lockedGreenCardNumber}
                  onChange={(e) => updateIns({ groeneKaartNr: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Geldig vanaf" required>
                  <Input
                    required
                    type="date"
                    value={ins.geldigVan}
                    disabled={lockedGreenCardValidFrom}
                    onChange={(e) => updateIns({ geldigVan: e.target.value })}
                  />
                </Field>
                <Field label="Geldig tot" required>
                  <Input
                    required
                    type="date"
                    value={ins.geldigTot}
                    disabled={lockedGreenCardValidTo}
                    onChange={(e) => updateIns({ geldigTot: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Agentschap / makelaar">
                <Input
                  value={ins.agentschap.naam}
                  onChange={(e) =>
                    updateIns({
                      agentschap: { ...ins.agentschap, naam: e.target.value },
                    })
                  }
                />
              </Field>
              <YesNoBlock
                label="Is de schade aan jouw voertuig verzekerd in het contract?"
                value={ins.schadeVerzekerd}
                onChange={(v) => updateIns({ schadeVerzekerd: v })}
                variant="inline"
                lang={lang}
              />
            </section>
          </div>
        );
      }
      case "vehicle_confirm": {
        const v = state.partyA.voertuig;
        const updateV = (patch: Partial<typeof v>) =>
          updateState({
            partyA: { ...state.partyA, voertuig: { ...v, ...patch } },
          });
        const trailerOn = v.aanhanger !== null;
        const lockedVehicleMakeModel =
          Boolean(prefillCtxRef.current.vehicleMakeModel) &&
          v.merkModel.trim() === prefillCtxRef.current.vehicleMakeModel.trim();
        const lockedVehiclePlate =
          Boolean(prefillCtxRef.current.vehiclePlate) &&
          v.nummerplaat.trim() === prefillCtxRef.current.vehiclePlate.trim();
        const lockedVehicleRegCountry =
          (lockedVehicleMakeModel || lockedVehiclePlate) &&
          Boolean(prefillCtxRef.current.vehicleRegistrationCountry) &&
          v.landInschrijving.trim() ===
            prefillCtxRef.current.vehicleRegistrationCountry.trim();
        return (
          <div className="flex flex-col gap-4 px-4 py-6">
            <Field label="Merk & model" required>
              <Input
                required
                value={v.merkModel}
                disabled={lockedVehicleMakeModel}
                onChange={(e) => updateV({ merkModel: e.target.value })}
              />
            </Field>
            <Field label="Nummerplaat" required>
              <Input
                required
                value={v.nummerplaat}
                disabled={lockedVehiclePlate}
                onChange={(e) => updateV({ nummerplaat: e.target.value })}
                onBlur={(e) => updateV({ nummerplaat: normalizeBelgianPlate(e.target.value) })}
              />
            </Field>
            <Field label="Land van inschrijving" required>
              <Input
                required
                value={v.landInschrijving}
                disabled={lockedVehicleRegCountry}
                onChange={(e) => updateV({ landInschrijving: e.target.value })}
              />
            </Field>

            <div className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4">
              <label className="flex cursor-pointer items-start justify-between gap-3">
                <span className="flex flex-col">
                  <span className="font-heading text-[14px] font-semibold text-foreground">
                    Aanhangwagen aangekoppeld?
                  </span>
                  <span className="text-[12.5px] leading-snug text-muted-foreground">
                    Vul enkel in als er een aanhanger aan het voertuig hing op het moment van het ongeval.
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="app-checkbox-primary"
                  checked={trailerOn}
                  onChange={(e) =>
                    updateV({
                      aanhanger: e.target.checked
                        ? { nummerplaat: "", landInschrijving: "België" }
                        : null,
                    })
                  }
                />
              </label>
              {trailerOn && v.aanhanger ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Nummerplaat aanhanger" required>
                    <Input
                      required
                      value={v.aanhanger.nummerplaat}
                      onChange={(e) =>
                        updateV({
                          aanhanger: {
                            ...v.aanhanger!,
                            nummerplaat: e.target.value,
                          },
                        })
                      }
                      onBlur={(e) =>
                        updateV({
                          aanhanger: {
                            ...v.aanhanger!,
                            nummerplaat: normalizeBelgianPlate(e.target.value),
                          },
                        })
                      }
                    />
                  </Field>
                  <Field label="Land inschrijving" required>
                    <Input
                      required
                      value={v.aanhanger.landInschrijving}
                      onChange={(e) =>
                        updateV({
                          aanhanger: {
                            ...v.aanhanger!,
                            landInschrijving: e.target.value,
                          },
                        })
                      }
                    />
                  </Field>
                </div>
              ) : null}
            </div>
          </div>
        );
      }
      case "parties_count":
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={UserCircle}
              title="1 partij aanwezig"
              description="Je bent alleen aanwezig en vult het dossier in."
              onClick={() => {
                const next = {
                  ...state,
                  partiesCount: 1 as const,
                  wantsFillPartyB: false,
                  devicesCount: 1 as const,
                  role: null,
                };
                setState(advanceState(next, "location_time"));
              }}
            />
            <ModeCard
              icon={Users}
              title="2 partijen aanwezig"
              description="Partij A en B zijn aanwezig om het dossier in te vullen."
              onClick={() => {
                const next = {
                  ...state,
                  partiesCount: 2 as const,
                  wantsFillPartyB: null,
                };
                setState(advanceState(next, "devices_count"));
              }}
            />
          </div>
        );
      case "devices_count":
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={Smartphone}
              title="Eén toestel"
              description="Je vult alles in op één toestel."
              onClick={() => {
                const next = { ...state, devicesCount: 1 as const, role: null };
                setState(advanceState(next, "party_b_language"));
              }}
            />
            <ModeCard
              icon={FcTwoSmartphones}
              title="Twee toestellen"
              description="Partij A en B vullen mee in op hun eigen toestel (QR-link)."
              onClick={() => {
                const next = { ...state, devicesCount: 2 as const };
                setState(advanceState(next, "role_select"));
              }}
            />
          </div>
        );
      case "role_select":
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={BadgeCheck}
              title="Rol A — maakt het rapport"
              description="Je start de aangifte en deelt een QR-code met partij B."
              onClick={() => {
                const next = { ...state, role: "A" as const };
                setState(advanceState(next, "share_qr"));
              }}
            />
            <ModeCard
              icon={QrCode}
              title="Rol B — assisteert"
              description="Je scant de QR-code van partij A en vult mee in."
              onClick={() => {
                toast.message("Open de koppelpagina om te scannen.");
                router.push("/ongeval/join");
              }}
            />
          </div>
        );
      case "share_qr":
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6 md:max-w-2xl">
            <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_12px_26px_rgba(24,28,32,0.06)]">
              <div className="flex items-center justify-between gap-2 border-b border-border/80 bg-muted px-4 py-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Info
                    className="mt-[2px] size-4 shrink-0 text-primary"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="min-w-0 text-[14px] font-semibold leading-snug text-foreground">
                      Laat partij B deze QR-code scannen om mee in te vullen.
                    </p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {partyBJoinedAt ? "Partij B is gekoppeld." : "Wachten op partij B…"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Vernieuw QR-code"
                  className="inline-flex items-center text-primary"
                  onClick={() => void ensureJoinQr("rotate")}
                  disabled={refreshingJoinQr}
                >
                  <RefreshCw className="size-4" strokeWidth={2} aria-hidden />
                  <span className="sr-only">Vernieuw</span>
                </button>
              </div>
              <div className="p-4">
                {joinQrDataUrl ? (
                  <div className="rounded-2xl border border-border/80 bg-muted p-5 md:p-6">
                    <img
                      src={joinQrDataUrl}
                      alt="QR-code om dossier te koppelen"
                      className="mx-auto w-full max-w-[360px] rounded-lg bg-card md:max-w-[420px]"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center text-[14px] text-muted-foreground">
                    QR-code wordt geladen…
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case "scan_qr":
        return (
          <div className="px-4 py-10 text-center text-[15px] text-muted-foreground">
            QR scannen wordt zo meteen toegevoegd in de volgende stap.
          </div>
        );
      case "party_b_language": {
        const pickLanguage = (lang: "nl" | "fr" | "en") => {
          const next = { ...state, partyBLanguage: lang };
          const target = getNextStepId("party_b_language", next) ?? "party_b_optional";
          setState(advanceState(next, target));
        };
        return (
          <div className="wizard-choice-step mx-auto w-full max-w-lg gap-3 md:max-w-2xl">
            <ModeCard
              icon={Languages}
              title="Nederlands"
              description="Partij B gebruikt Nederlands."
              onClick={() => pickLanguage("nl")}
            />
            <ModeCard
              icon={Languages}
              title="Frans"
              description="Partij B gebruikt Frans."
              onClick={() => pickLanguage("fr")}
            />
            <ModeCard
              icon={Languages}
              title="Engels"
              description="Partij B gebruikt Engels."
              onClick={() => pickLanguage("en")}
            />
          </div>
        );
      }
      case "party_b_optional":
        if (state.partiesCount !== 1) {
          return (
            <div className="px-4 py-10 text-center text-[15px] text-muted-foreground">
              Partij B vult mee in via het tweede toestel.
            </div>
          );
        }
        return (
          <div className="wizard-choice-step gap-6">
            <p className="text-center text-[15px] leading-relaxed text-foreground">
              Wil je nu al bepaalde gegevens van partij B invullen?
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setState(advanceState({ ...state, wantsFillPartyB: true }, "party_b_form"))
                }
                className="min-h-[88px] min-w-[120px] touch-manipulation rounded-2xl border border-border/60 bg-secondary/60 px-4 text-[16px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground active:scale-[0.99] dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() =>
                  setState(advanceState({ ...state, wantsFillPartyB: false }, "location_time"))
                }
                className="min-h-[88px] min-w-[120px] touch-manipulation rounded-2xl border border-border/60 bg-secondary/60 px-4 text-[16px] font-medium text-muted-foreground transition-colors hover:border-border hover:bg-secondary hover:text-foreground active:scale-[0.99] dark:border-white/10 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]"
              >
                Nee
              </button>
            </div>
          </div>
        );
      case "party_b_form":
        return renderPartyBForm();
      case "location_time": {
        const approval = state.locationApproval;
        const needsApproval = requiresLocationApproval(state);
        const isPartyB = needsApproval && state.role === "B";
        const editingLocked =
          needsApproval && (approval.status === "pending" || approval.status === "approved");
        const fieldsFilled =
          state.location.straat.trim().length > 0 &&
          state.location.huisnummer.trim().length > 0 &&
          state.location.postcode.trim().length > 0 &&
          state.location.stad.trim().length > 0 &&
          state.location.land.trim().length > 0 &&
          state.location.datum.trim().length > 0 &&
          state.location.tijd.trim().length > 0;

        if (isPartyB) {
          return (
            <PartyBLocationApprovalView
              lang={lang}
              location={state.location}
              approval={approval}
              onApprove={() => {
                updateState({
                  locationApproval: {
                    status: "approved",
                    approvedAt: new Date().toISOString(),
                    rejectedAt: null,
                    rejectionNote: "",
                    approvedValuesHash: computeLocationHash(state.location),
                  },
                });
              }}
              onReject={(note) => {
                updateState({
                  locationApproval: {
                    status: "rejected",
                    approvedAt: null,
                    rejectedAt: new Date().toISOString(),
                    rejectionNote: note,
                    approvedValuesHash: null,
                  },
                });
              }}
            />
          );
        }

        return (
          <div className="flex flex-col gap-3 px-4 py-4">
            {needsApproval && approval.status === "idle" ? (
              <p className="rounded-xl border border-primary/20 bg-secondary px-3 py-2 text-[12.5px] leading-snug text-foreground">
                {t(lang, "location.approval.a.intro")}
              </p>
            ) : null}
            <LocationPicker
              lang={lang}
              disabled={editingLocked}
              value={{
                straat: state.location.straat,
                huisnummer: state.location.huisnummer,
                postcode: state.location.postcode,
                stad: state.location.stad,
                land: state.location.land,
              }}
              onChange={(next) =>
                updateState({
                  location: {
                    ...state.location,
                    straat: next.straat || state.location.straat,
                    huisnummer: next.huisnummer || state.location.huisnummer,
                    postcode: next.postcode || state.location.postcode,
                    stad: next.stad || state.location.stad,
                    land: next.land || state.location.land,
                  },
                })
              }
            />
            <Field label={t(lang, "field.street")}>
              <Input
                disabled={editingLocked}
                value={state.location.straat}
                onChange={(e) =>
                  updateState({
                    location: { ...state.location, straat: e.target.value },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.housenumber")}>
              <Input
                disabled={editingLocked}
                value={state.location.huisnummer}
                onChange={(e) =>
                  updateState({
                    location: { ...state.location, huisnummer: e.target.value },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(lang, "field.postcode")}>
                <Input
                  disabled={editingLocked}
                  value={state.location.postcode}
                  onChange={(e) =>
                    updateState({
                      location: { ...state.location, postcode: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t(lang, "field.city")}>
                <Input
                  disabled={editingLocked}
                  value={state.location.stad}
                  onChange={(e) =>
                    updateState({
                      location: { ...state.location, stad: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
            <Field label={t(lang, "field.country")}>
              <Input
                disabled={editingLocked}
                value={state.location.land}
                onChange={(e) =>
                  updateState({
                    location: { ...state.location, land: e.target.value },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(lang, "field.date")}>
                <Input
                  type="date"
                  disabled={editingLocked}
                  value={state.location.datum}
                  onChange={(e) =>
                    updateState({
                      location: { ...state.location, datum: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t(lang, "field.time")}>
                <Input
                  type="time"
                  disabled={editingLocked}
                  value={state.location.tijd}
                  onChange={(e) =>
                    updateState({
                      location: { ...state.location, tijd: e.target.value },
                    })
                  }
                />
              </Field>
            </div>

            {needsApproval ? (
              <PartyALocationApprovalCard
                lang={lang}
                approval={approval}
                fieldsFilled={fieldsFilled}
                onSend={() => {
                  if (!fieldsFilled) return;
                  updateState({
                    locationApproval: {
                      status: "pending",
                      approvedAt: null,
                      rejectedAt: null,
                      rejectionNote: "",
                      approvedValuesHash: null,
                    },
                  });
                }}
                onRetract={() => {
                  if (
                    approval.status === "approved" &&
                    !window.confirm(t(lang, "location.approval.a.retract_confirm"))
                  ) {
                    return;
                  }
                  updateState({
                    locationApproval: {
                      status: "idle",
                      approvedAt: null,
                      rejectedAt: null,
                      rejectionNote: "",
                      approvedValuesHash: null,
                    },
                  });
                }}
              />
            ) : null}
          </div>
        );
      }
      case "injuries_material":
        return (
          <div className="wizard-choice-step gap-6">
            <YesNoBlock
              label={t(lang, "injuries.question")}
              value={state.gewonden}
              onChange={(v) => updateState({ gewonden: v })}
              lang={lang}
            />
            <YesNoBlock
              label={t(lang, "material.question")}
              value={state.materieleSchadeAnders}
              onChange={(v) => updateState({ materieleSchadeAnders: v })}
              lang={lang}
            />
          </div>
        );
      case "witnesses":
        return (
          <div className="wizard-choice-step gap-5">
            <YesNoBlock
              label={t(lang, "witnesses.question")}
              value={state.hasGetuigen}
              onChange={(v) => {
                if (v === true && state.getuigenList.length === 0) {
                  updateState({
                    hasGetuigen: true,
                    getuigenList: [{ voornaam: "", naam: "", telefoon: "" }],
                  });
                } else if (v === false) {
                  updateState({ hasGetuigen: false, getuigenList: [] });
                } else {
                  updateState({ hasGetuigen: v });
                }
              }}
              lang={lang}
            />

            {state.hasGetuigen === true ? (
              <div className="mx-auto w-full max-w-lg space-y-3 sm:max-w-2xl">
                {state.getuigenList.map((w, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-3 rounded-2xl border border-border/80 bg-card p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-heading text-[14px] font-semibold text-foreground">
                        {t(lang, "witnesses.entry_label")} {idx + 1}
                      </p>
                      {idx > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            updateState({
                              getuigenList: state.getuigenList.filter(
                                (_, i) => i !== idx,
                              ),
                            })
                          }
                          className="flex size-8 items-center justify-center rounded-md text-destructive transition hover:bg-destructive/10"
                          aria-label={t(lang, "witnesses.remove")}
                        >
                          <Trash2 className="size-4" strokeWidth={2} />
                        </button>
                      ) : null}
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <Field label={t(lang, "field.firstname")} required>
                        <Input
                          required
                          value={w.voornaam}
                          onChange={(e) => {
                            const list = [...state.getuigenList];
                            list[idx] = { ...list[idx], voornaam: e.target.value };
                            updateState({ getuigenList: list });
                          }}
                        />
                      </Field>
                      <Field label={t(lang, "field.lastname")} required>
                        <Input
                          required
                          value={w.naam}
                          onChange={(e) => {
                            const list = [...state.getuigenList];
                            list[idx] = { ...list[idx], naam: e.target.value };
                            updateState({ getuigenList: list });
                          }}
                        />
                      </Field>
                    </div>
                    <Field label={t(lang, "witnesses.field_phone")}>
                      <Input
                        type="tel"
                        inputMode="tel"
                        value={w.telefoon}
                        placeholder="+32 …"
                        onChange={(e) => {
                          const list = [...state.getuigenList];
                          list[idx] = { ...list[idx], telefoon: e.target.value };
                          updateState({ getuigenList: list });
                        }}
                      />
                    </Field>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    updateState({
                      getuigenList: [
                        ...state.getuigenList,
                        { voornaam: "", naam: "", telefoon: "" },
                      ],
                    })
                  }
                  className="min-h-12 w-full justify-center gap-2 rounded-xl border-primary/30 text-[15px] font-semibold text-primary hover:bg-secondary"
                >
                  <Plus aria-hidden="true" className="size-4" />
                  {t(lang, "witnesses.add")}
                </Button>
              </div>
            ) : null}

            {state.hasGetuigen === false ? (
              <div className="mx-auto w-full max-w-lg rounded-2xl border border-border/70 bg-card px-4 py-3.5 text-center text-[13.5px] leading-snug text-foreground shadow-sm sm:max-w-2xl">
                {t(lang, "witnesses.none_note")}
              </div>
            ) : null}
          </div>
        );
      case "situation_main": {
        const selected = new Set(state.situationCategories);
        return (
          <div className="flex flex-col gap-3 px-3 py-3">
            <p className="px-1 text-[13px] leading-snug text-muted-foreground">
              {t(lang, "situation.multi_hint")}
            </p>
            <div className="flex flex-col overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_12px_26px_rgba(24,28,32,0.06)]">
              {SITUATION_CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat.id];
                const isSelected = selected.has(cat.id);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => {
                      const next = new Set(state.situationCategories);
                      if (next.has(cat.id)) next.delete(cat.id);
                      else next.add(cat.id);
                      const nextCats = Array.from(next);
                      // Wanneer een categorie verdwijnt, ruimen we ook alle
                      // bijhorende detail-/manoeuvre-keys op zodat we geen
                      // wezen-data overhouden in de samenvatting/PDF.
                      const detailsByCat: Record<string, string[]> = {
                        parking: ["park_moving", "park_opening"],
                        rear_end: ["a_rear", "b_rear"],
                        priority: [
                          "a_yield_x",
                          "b_yield_x",
                          "a_stop_x",
                          "b_stop_x",
                          "a_yield_round",
                          "b_yield_round",
                        ],
                        lane_change: ["a_lane", "b_lane", "both_lane"],
                        opposite: ["a_crossed", "b_crossed", "both_crossed"],
                        door: ["door_a", "door_b"],
                        load: ["load_a", "load_b"],
                      };
                      const removed = !next.has(cat.id);
                      let nextDetails = state.situationDetailKeys;
                      let nextManA = state.maneuverAKeys;
                      let nextManB = state.maneuverBKeys;
                      if (removed) {
                        const drop = new Set(detailsByCat[cat.id] ?? []);
                        if (drop.size > 0) {
                          nextDetails = nextDetails.filter((k) => !drop.has(k));
                        }
                        if (cat.id === "maneuver") {
                          nextManA = [];
                          nextManB = [];
                        }
                      }
                      updateState({
                        situationCategories: nextCats,
                        situationDetailKeys: nextDetails,
                        maneuverAKeys: nextManA,
                        maneuverBKeys: nextManB,
                      });
                    }}
                    className={`flex w-full items-start gap-3 border-b border-border/60 px-4 py-4 text-left transition-colors last:border-b-0 ${
                      isSelected
                        ? "bg-secondary/70"
                        : "hover:bg-muted/80 active:bg-secondary/50"
                    }`}
                  >
                    <div
                      aria-hidden="true"
                      className={`mt-1 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        isSelected
                          ? "border-primary stitch-gradient-fill"
                          : "border-border bg-card text-transparent"
                      }`}
                    >
                      <Check className="size-3.5" strokeWidth={3} />
                    </div>
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary/90 text-primary ring-1 ring-primary/10">
                      <Icon className="size-6" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-[15px] font-semibold text-foreground">
                        {getCategoryLabel(cat.id, lang) || cat.title}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
                        {getCategoryDescription(cat.id, lang) || cat.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      }
      case "sit_rear_end":
        return (
          <OptionList
            lang={lang}
            options={REAR_END_OPTIONS}
            selectedIds={state.situationDetailKeys}
            onToggle={(id) =>
              updateState({
                situationDetailKeys: toggleInList(state.situationDetailKeys, id),
              })
            }
          />
        );
      case "sit_center_line":
        return (
          <OptionList
            lang={lang}
            options={CENTER_LINE_OPTIONS}
            selectedIds={state.situationDetailKeys}
            onToggle={(id) =>
              updateState({
                situationDetailKeys: toggleInList(state.situationDetailKeys, id),
              })
            }
          />
        );
      case "sit_priority":
        return (
          <OptionList
            lang={lang}
            options={PRIORITY_OPTIONS}
            selectedIds={state.situationDetailKeys}
            onToggle={(id) =>
              updateState({
                situationDetailKeys: toggleInList(state.situationDetailKeys, id),
              })
            }
          />
        );
      case "sit_maneuver_a":
        return (
          <div>
            <p className="border-b border-primary/10 bg-muted px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
              {lang === "fr"
                ? "Choisissez les manœuvres de la partie A"
                : lang === "en"
                  ? "Choose the manoeuvres of party A"
                  : "Kies de rijbewegingen van partij A"}
            </p>
            <OptionList
              lang={lang}
              options={MANEUVER_A_OPTIONS}
              selectedIds={state.maneuverAKeys}
              onToggle={(id) =>
                updateState({
                  maneuverAKeys: toggleInList(state.maneuverAKeys, id),
                })
              }
            />
          </div>
        );
      case "sit_maneuver_b":
        return (
          <div>
            <p className="border-b border-primary/10 bg-muted px-4 py-2.5 text-[13px] font-medium text-muted-foreground">
              {lang === "fr"
                ? "Choisissez les manœuvres de la partie B"
                : lang === "en"
                  ? "Choose the manoeuvres of party B"
                  : "Kies de rijbewegingen van partij B"}
            </p>
            <OptionList
              lang={lang}
              options={MANEUVER_B_OPTIONS}
              selectedIds={state.maneuverBKeys}
              onToggle={(id) =>
                updateState({
                  maneuverBKeys: toggleInList(state.maneuverBKeys, id),
                })
              }
            />
          </div>
        );
      case "sit_lane_change":
        return (
          <OptionList
            lang={lang}
            options={LANE_CHANGE_OPTIONS}
            selectedIds={state.situationDetailKeys}
            onToggle={(id) =>
              updateState({
                situationDetailKeys: toggleInList(state.situationDetailKeys, id),
              })
            }
          />
        );
      case "sit_parking":
        return (
          <OptionList
            lang={lang}
            options={GENERIC_SINGLE.parking ?? []}
            selectedIds={state.situationDetailKeys}
            onToggle={(id) =>
              updateState({
                situationDetailKeys: toggleInList(state.situationDetailKeys, id),
              })
            }
          />
        );
      case "sit_door":
        return (
          <OptionList
            lang={lang}
            options={GENERIC_SINGLE.door ?? []}
            selectedIds={state.situationDetailKeys}
            onToggle={(id) =>
              updateState({
                situationDetailKeys: toggleInList(state.situationDetailKeys, id),
              })
            }
          />
        );
      case "sit_load":
        return (
          <OptionList
            lang={lang}
            options={GENERIC_SINGLE.load ?? []}
            selectedIds={state.situationDetailKeys}
            onToggle={(id) =>
              updateState({
                situationDetailKeys: toggleInList(state.situationDetailKeys, id),
              })
            }
          />
        );
      case "circumstances_manual":
        return (
          <div className="px-4 py-4">
            <Field label={t(lang, "circumstances.label")}>
              <textarea
                className="min-h-[160px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder={t(lang, "circumstances.placeholder")}
                value={state.circumstancesNotes}
                onChange={(e) =>
                  updateState({ circumstancesNotes: e.target.value })
                }
              />
            </Field>
          </div>
        );
      case "vehicle_contact":
        return (
          <div className="wizard-choice-step gap-8">
            <YesNoBlock
              label={t(lang, "vehicle_contact.question")}
              value={state.vehicleContact}
              onChange={(vehicleContact) => updateState({ vehicleContact })}
              lang={lang}
            />
          </div>
        );
      case "impact_party_a":
        return (
          <ImpactDiagram
            label={t(lang, "impact.a.label")}
            hint={t(lang, "impact.hint")}
            party="A"
            value={state.impactPartyA}
            onChange={(impactPartyA) => updateState({ impactPartyA })}
          />
        );
      case "visible_damage_a":
        return (
          <div className="flex flex-col gap-3 px-4 py-6">
            <p className="rounded-2xl border border-primary/20 bg-secondary px-3 py-2 text-[12.5px] leading-snug text-foreground">
              {t(lang, "visible_damage.intro_a")}
            </p>
            <Field label={t(lang, "visible_damage.label_a")}>
              <textarea
                className="min-h-[140px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder={t(lang, "visible_damage.placeholder")}
                value={state.visibleDamagePartyA}
                onChange={(e) =>
                  updateState({ visibleDamagePartyA: e.target.value })
                }
              />
            </Field>
            <p className="px-1 text-[12px] text-muted-foreground">
              {t(lang, "visible_damage.optional_hint")}
            </p>
          </div>
        );
      case "impact_party_b":
        return (
          <ImpactDiagram
            label={t(lang, "impact.b.label")}
            hint={t(lang, "impact.hint")}
            party="B"
            value={state.impactPartyB}
            onChange={(impactPartyB) => updateState({ impactPartyB })}
          />
        );
      case "visible_damage_b":
        return (
          <div className="flex flex-col gap-3 px-4 py-6">
            <p className="rounded-2xl border border-primary/20 bg-secondary px-3 py-2 text-[12.5px] leading-snug text-foreground">
              {t(lang, "visible_damage.intro_b")}
            </p>
            <Field label={t(lang, "visible_damage.label_b")}>
              <textarea
                className="min-h-[140px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder={t(lang, "visible_damage.placeholder")}
                value={state.visibleDamagePartyB}
                onChange={(e) =>
                  updateState({ visibleDamagePartyB: e.target.value })
                }
              />
            </Field>
            <p className="px-1 text-[12px] text-muted-foreground">
              {t(lang, "visible_damage.optional_hint")}
            </p>
          </div>
        );
      case "accident_sketch":
        return (
          <div className="flex flex-col gap-3 px-4 py-6">
            <p className="rounded-2xl border border-primary/20 bg-secondary px-3 py-2 text-[12.5px] leading-snug text-foreground">
              {t(lang, "sketch.intro")}
            </p>
            <SignaturePad
              value={state.accidentSketch}
              onChange={(accidentSketch) => updateState({ accidentSketch })}
              className="min-h-[280px]"
            />
            <p className="px-1 text-[12px] text-muted-foreground">
              {t(lang, "sketch.optional_hint")}
            </p>
          </div>
        );
      case "overview_intro":
        return (
          <div className="flex flex-col gap-6 px-4 py-10">
            <p className="text-center text-[15px] leading-relaxed text-foreground">
              {t(lang, "overview.intro")}
            </p>
          </div>
        );
      case "overview_detail":
        return <OverviewTabs state={state} lang={lang} />;
      case "signature_a":
        return (
          <div className="flex min-h-[280px] flex-col gap-3 px-4 py-4">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {lang === "fr"
                ? "Signez ci-dessous au nom du "
                : lang === "en"
                  ? "Sign below on behalf of "
                  : "Teken hieronder de handtekening van "}
              <strong className="font-semibold text-foreground">
                {lang === "fr"
                  ? "conducteur A"
                  : lang === "en"
                    ? "driver A"
                    : "bestuurder A"}
              </strong>
              {lang === "fr"
                ? ". Utilisez votre doigt ou un stylet."
                : lang === "en"
                  ? ". Use finger or stylus."
                  : ". Gebruik vinger of stylus."}
            </p>
            <SignaturePad
              value={state.signaturePartyA}
              onChange={(signaturePartyA) => updateState({ signaturePartyA })}
            />
          </div>
        );
      case "signature_b":
        return (
          <div className="flex min-h-[280px] flex-col gap-3 px-4 py-4">
            <p className="text-[14px] leading-relaxed text-muted-foreground">
              {t(lang, "signature.b.prompt")}
            </p>
            <SignaturePad
              value={state.signaturePartyB}
              onChange={(signaturePartyB) => updateState({ signaturePartyB })}
            />
          </div>
        );
      case "complete":
        if (state.submissionMode === "scan") {
          return (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col items-center gap-1 px-4 pt-6 text-center">
                <p className="text-[18px] font-semibold text-foreground">
                  {t(lang, "scan.complete_title")}
                </p>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {t(lang, "scan.complete_subtitle")}
                </p>
              </div>
              <ScanPdfPreview
                reportId={reportId}
                storagePath={state.scanSubmission.storagePath}
                lang={lang}
              />
              <AutoSendStatus
                reportId={reportId}
                lang={lang}
                isPartyB={false}
              />
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-2">
            <PdfPreviewStep
              reportId={reportId}
              guestSecret={guestSecret}
              lang={lang}
            />
            <AutoSendStatus
              reportId={reportId}
              lang={lang}
              isPartyB={state.role === "B" && state.devicesCount === 2}
            />
          </div>
        );
      default:
        return null;
    }
  }

  const footer = useMemo(() => {
    if (stepId === "complete") {
      return (
        <WizardFooterButton
          label={t(lang, "complete.close")}
          disabled={saving}
          onClick={async () => {
            try {
              setSaving(true);
              // Bewaar laatste payload-snapshot zodat niets verloren gaat.
              const { error } = await supabase
                .from("ongeval_aangiften")
                .update({
                  payload: state as unknown as Record<string, unknown>,
                })
                .eq("id", reportId);
              if (error) throw error;
              if (onRequestClose) {
                onRequestClose();
              } else {
                router.push(returnTo ?? "/ongeval");
              }
            } catch (e) {
              console.error(e);
              toast.error("Afronden mislukt.");
            } finally {
              setSaving(false);
            }
          }}
        />
      );
    }
    if (stepId === "overview_detail") {
      return (
        <div className="flex flex-col">
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center border-t border-border/80 bg-muted text-[15px] font-semibold text-foreground transition-colors hover:bg-muted"
            onClick={() => {
              setState(
                advanceState(
                  { ...state, overviewSkipped: true },
                  getNextAfterOverviewSkip(),
                ),
              );
            }}
          >
            {t(lang, "overview.skip")}
          </button>
          <WizardFooterButton label={t(lang, "common.next")} onClick={goNext} />
        </div>
      );
    }
    if (
      stepId === "signature_a" ||
      stepId === "signature_b" ||
      stepId === "impact_party_a" ||
      stepId === "impact_party_b"
    ) {
      return (
        <div className="grid grid-cols-1">
          <WizardFooterButton
            label={
              stepId.startsWith("signature")
                ? t(lang, "common.confirm")
                : t(lang, "common.next")
            }
            onClick={goNext}
            disabled={!validateStep(stepId, state)}
          />
        </div>
      );
    }
    if (
      stepId === "submission_mode" ||
      stepId === "scan_capture" ||
      stepId === "driver_select" ||
      stepId === "policyholder_select" ||
      stepId === "parties_count" ||
      stepId === "devices_count" ||
      stepId === "role_select" ||
      stepId === "party_b_language" ||
      stepId === "party_b_optional"
    ) {
      return null;
    }
    if (stepId === "share_qr" && state.role === "A") {
      return (
        <WizardFooterButton
          label={t(lang, "common.next")}
          onClick={goNext}
          disabled={!partyBJoinedAt || saving}
        />
      );
    }
    return (
      <WizardFooterButton
        label={t(lang, "common.next")}
        onClick={goNext}
        disabled={!validateStep(stepId, state) || saving}
      />
    );
  }, [
    stepId,
    goNext,
    router,
    state,
    saving,
    supabase,
    reportId,
    lang,
    onRequestClose,
    returnTo,
    partyBJoinedAt,
  ]);

  return (
    <>
      <WizardShell
        stepId={stepId}
        embedded={embedded}
        bannerMessage={bannerMessage}
        bannerDismissed={bannerDismissed}
        onDismissBanner={bannerMessage ? dismissBanner : undefined}
        onBack={goBack}
        showBack={
          stepId !== "submission_mode" && state.navigationHistory.length > 0
        }
        onExit={handleExit}
        showExit={stepId !== "complete"}
        footer={footer}
        lang={lang}
      >
        <ScrollArea
          className={
            embedded
              ? "min-h-0 flex-1"
              : "h-[min(100dvh-120px,900px)]"
          }
        >
          {renderBody()}
        </ScrollArea>
      </WizardShell>

      <Dialog
        open={exitOpen}
        onOpenChange={(open) => {
          if (!open && exitBusy !== null) return;
          setExitOpen(open);
        }}
      >
        <DialogContent showCloseButton={exitBusy === null}>
          <DialogTitle>Wizard stoppen?</DialogTitle>
          <DialogDescription className="space-y-2">
            <span className="block">
              {guestSecret
                ? "Je wijzigingen worden op het dossier bewaard. Sluit om later verder te gaan met dezelfde link of QR-code."
                : embedded
                  ? "Kies of je je voortgang als concept wil bewaren en later verdergaat, of dit dossier definitief wil verwijderen. Verwijderen kan niet ongedaan worden gemaakt."
                  : "Kies of je je voortgang als concept wil bewaren (via het menu Ongeval melden) of dit dossier definitief wil verwijderen. Verwijderen kan niet ongedaan worden gemaakt."}
            </span>
          </DialogDescription>
          <DialogFooter className="grid grid-cols-1 justify-items-center gap-2 min-[420px]:grid-cols-2 min-[420px]:[&>*:first-child]:col-span-2 sm:flex sm:flex-row sm:flex-wrap sm:justify-center sm:gap-3">
            <Button
              type="button"
              size="lg"
              className="min-h-11 whitespace-normal text-center text-[15px] leading-snug"
              onClick={() => void saveDraftAndClose()}
              disabled={exitBusy !== null}
            >
              {exitBusy === "save" ? "Bezig met opslaan…" : "Opslaan als concept"}
            </Button>
            {!guestSecret ? (
              <Button
                type="button"
                variant="destructive"
                size="lg"
                className="min-h-11 whitespace-normal text-center text-[15px] leading-snug"
                onClick={() => void deleteDraftAndClose()}
                disabled={exitBusy !== null}
              >
                {exitBusy === "delete" ? "Bezig met verwijderen…" : "Concept verwijderen"}
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11 whitespace-normal text-center text-[15px] leading-snug"
              onClick={() => setExitOpen(false)}
              disabled={exitBusy !== null}
            >
              Annuleren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

type LocationApprovalState = AccidentReportState["locationApproval"];

function PartyALocationApprovalCard({
  lang,
  approval,
  fieldsFilled,
  onSend,
  onRetract,
}: {
  lang: OngevalLang;
  approval: LocationApprovalState;
  fieldsFilled: boolean;
  onSend: () => void;
  onRetract: () => void;
}) {
  if (approval.status === "pending") {
    return (
      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-amber-500/30 bg-amber-50 px-4 py-3">
        <div className="flex items-center gap-2 text-amber-900">
          <Clock className="size-4" strokeWidth={2} />
          <p className="font-heading text-[14px] font-semibold">
            {t(lang, "location.approval.a.pending_title")}
          </p>
        </div>
        <p className="text-[12.5px] leading-snug text-amber-950">
          {t(lang, "location.approval.a.pending_body")}
        </p>
        <button
          type="button"
          onClick={onRetract}
          className="mt-1 inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-amber-500/40 bg-card px-3 py-1.5 text-[12.5px] font-semibold text-amber-900 transition-colors hover:bg-amber-100"
        >
          <Pencil className="size-3.5" strokeWidth={2} />
          {t(lang, "location.approval.a.retract")}
        </button>
      </div>
    );
  }

  if (approval.status === "approved") {
    return (
      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-emerald-600/30 bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2 text-emerald-700">
          <Check className="size-4" strokeWidth={2.5} />
          <p className="font-heading text-[14px] font-semibold">
            {t(lang, "location.approval.a.approved_title")}
          </p>
        </div>
        <p className="text-[12.5px] leading-snug text-emerald-900">
          {t(lang, "location.approval.a.approved_body")}
        </p>
        <button
          type="button"
          onClick={onRetract}
          className="mt-1 inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-emerald-600/30 bg-card px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
        >
          <Pencil className="size-3.5" strokeWidth={2} />
          {t(lang, "location.approval.a.retract")}
        </button>
      </div>
    );
  }

  if (approval.status === "rejected") {
    return (
      <div className="mt-2 flex flex-col gap-2 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3">
        <div className="flex items-center gap-2 text-destructive">
          <X className="size-4" strokeWidth={2.5} />
          <p className="font-heading text-[14px] font-semibold">
            {t(lang, "location.approval.a.rejected_title")}
          </p>
        </div>
        <p className="text-[12.5px] leading-snug text-destructive">
          {t(lang, "location.approval.a.rejected_body")}
        </p>
        {approval.rejectionNote.trim().length > 0 ? (
          <div className="rounded-lg border border-destructive/20 bg-card px-3 py-2 text-[12.5px] leading-snug text-foreground">
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-destructive">
              {t(lang, "location.approval.a.rejected_note")}
            </p>
            <p className="whitespace-pre-line">{approval.rejectionNote}</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onSend}
          disabled={!fieldsFilled}
          className="stitch-btn-primary mt-1 inline-flex items-center justify-center gap-1.5 self-start rounded-lg px-3 py-2 text-[13px] font-semibold transition-[filter,transform] disabled:opacity-50"
        >
          <Send className="size-3.5" strokeWidth={2} />
          {t(lang, "location.approval.a.send")}
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSend}
      disabled={!fieldsFilled}
      className="stitch-btn-primary mt-1 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-[15px] font-semibold shadow-sm transition-[filter,transform] disabled:opacity-50"
      title={!fieldsFilled ? t(lang, "location.approval.a.send_disabled") : undefined}
    >
      <Send className="size-4" strokeWidth={2} />
      {t(lang, "location.approval.a.send")}
    </button>
  );
}

function PartyBLocationApprovalView({
  lang,
  location,
  approval,
  onApprove,
  onReject,
}: {
  lang: OngevalLang;
  location: AccidentReportState["location"];
  approval: LocationApprovalState;
  onApprove: () => void;
  onReject: (note: string) => void;
}) {
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [note, setNote] = useState("");

  // Voor partij B: enkel akkoord/weigeren tonen als A de gegevens expliciet
  // ter goedkeuring heeft gestuurd. Anders (idle) wachten tot A klaar is.
  if (approval.status === "idle") {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
        <Clock className="size-8 text-muted-foreground" strokeWidth={1.5} />
        <p className="text-[14px] leading-snug text-muted-foreground">
          {t(lang, "location.approval.b.waiting")}
        </p>
      </div>
    );
  }

  if (approval.status === "approved") {
    return (
      <div className="flex flex-col gap-3 px-4 py-6">
        <div className="rounded-2xl border border-emerald-600/30 bg-emerald-50 px-4 py-4">
          <div className="flex items-center gap-2 text-emerald-700">
            <Check className="size-5" strokeWidth={2.5} />
            <p className="font-heading text-[15px] font-semibold">
              {t(lang, "location.approval.b.approved_title")}
            </p>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-emerald-900">
            {t(lang, "location.approval.b.approved_body")}
          </p>
        </div>
        <ReadonlyLocationSummary lang={lang} location={location} />
      </div>
    );
  }

  if (approval.status === "rejected") {
    return (
      <div className="flex flex-col gap-3 px-4 py-6">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-4">
          <div className="flex items-center gap-2 text-destructive">
            <X className="size-5" strokeWidth={2.5} />
            <p className="font-heading text-[15px] font-semibold">
              {t(lang, "location.approval.b.rejected_title")}
            </p>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-destructive">
            {t(lang, "location.approval.b.rejected_body")}
          </p>
        </div>
        <ReadonlyLocationSummary lang={lang} location={location} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 px-4 py-4">
      <div className="rounded-2xl border border-primary/20 bg-secondary px-4 py-3">
        <p className="font-heading text-[14px] font-semibold text-foreground">
          {t(lang, "location.approval.b.title")}
        </p>
        <p className="mt-1 text-[12.5px] leading-snug text-foreground/80">
          {t(lang, "location.approval.b.intro")}
        </p>
      </div>

      <ReadonlyLocationSummary lang={lang} location={location} />

      {showRejectForm ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-destructive/20 bg-card px-4 py-3 shadow-sm">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-medium text-muted-foreground">
              {t(lang, "location.approval.b.note_label")}
            </span>
            <textarea
              className="min-h-[100px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder={t(lang, "location.approval.b.note_placeholder")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onReject(note.trim())}
              className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-destructive px-4 text-[14px] font-semibold text-white transition-colors hover:bg-destructive/90"
            >
              <Send className="size-4" strokeWidth={2} />
              {t(lang, "location.approval.b.send_rejection")}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRejectForm(false);
                setNote("");
              }}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-border bg-card px-4 text-[14px] font-medium text-foreground hover:bg-muted"
            >
              {t(lang, "location.approval.b.cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onApprove}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-[15px] font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
          >
            <Check className="size-4" strokeWidth={2.5} />
            {t(lang, "location.approval.b.approve")}
          </button>
          <button
            type="button"
            onClick={() => setShowRejectForm(true)}
            className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-card px-4 text-[15px] font-semibold text-destructive shadow-sm transition-colors hover:bg-destructive/10"
          >
            <X className="size-4" strokeWidth={2.5} />
            {t(lang, "location.approval.b.reject")}
          </button>
        </div>
      )}
    </div>
  );
}

function ReadonlyLocationSummary({
  lang,
  location,
}: {
  lang: OngevalLang;
  location: AccidentReportState["location"];
}) {
  const dash = t(lang, "common.dash");
  const addressLines: string[] = [];
  const line1 = [location.straat, location.huisnummer].filter((s) => s.trim()).join(" ");
  if (line1) addressLines.push(line1);
  const line2 = [location.postcode, location.stad].filter((s) => s.trim()).join(" ");
  if (line2) addressLines.push(line2);
  if (location.land.trim()) addressLines.push(location.land);

  const dateText = formatDateForDisplay(location.datum) || dash;
  const timeText = formatTimeForDisplay(location.tijd) || dash;

  return (
    <div className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/80 bg-card shadow-sm">
      <div className="px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {t(lang, "overview.section.place")}
        </p>
        <div className="mt-1 text-[14px] leading-snug text-foreground">
          {addressLines.length > 0 ? (
            addressLines.map((l) => <div key={l}>{l}</div>)
          ) : (
            <span className="text-muted-foreground">{dash}</span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(lang, "field.date")}
          </p>
          <p className="mt-1 text-[14px] text-foreground">{dateText}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {t(lang, "field.time")}
          </p>
          <p className="mt-1 text-[14px] text-foreground">{timeText}</p>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  // Mobile-first form field. Alle child inputs/textareas/selects krijgen via
  // descendant-selectors een grotere, native-aanvoelende stijl:
  // - h-12 (48px) → iOS/Android touch-target minimum
  // - text-[16px] → voorkomt automatische zoom op iOS Safari bij focus
  // - rounded-xl + iets dikker padding → voelt aan als een echte mobile input
  return (
    <label
      className="flex flex-col gap-2
        [&_input]:h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-border
        [&_input]:bg-card [&_input]:px-3.5 [&_input]:py-2 [&_input]:text-[16px] [&_input]:leading-tight [&_input]:text-foreground
        [&_input]:shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]
        [&_input::placeholder]:text-muted-foreground
        [&_input:focus-visible]:border-primary [&_input:focus-visible]:ring-[3px] [&_input:focus-visible]:ring-primary/15
        [&_input:disabled]:bg-muted [&_input:disabled]:text-muted-foreground
        [&_input[type='date']]:appearance-none [&_input[type='time']]:appearance-none
        [&_textarea]:min-h-[96px] [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-border
        [&_textarea]:bg-card [&_textarea]:px-3.5 [&_textarea]:py-3 [&_textarea]:text-[16px] [&_textarea]:leading-snug [&_textarea]:text-foreground
        [&_textarea:focus-visible]:border-primary [&_textarea:focus-visible]:ring-[3px] [&_textarea:focus-visible]:ring-primary/15
        [&_select]:h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-border
        [&_select]:bg-card [&_select]:px-3 [&_select]:text-[16px] [&_select]:text-foreground
        [&_select:focus-visible]:border-primary [&_select:focus-visible]:ring-[3px] [&_select:focus-visible]:ring-primary/15
        [&_select:disabled]:bg-muted [&_select:disabled]:text-muted-foreground [&_select:disabled]:opacity-100"
    >
      <span className="text-[13.5px] font-semibold text-foreground">
        {label}
        {required ? <span className="sr-only"> (verplicht)</span> : null}
      </span>
      {children}
    </label>
  );
}

const yesNoBtnBase =
  "touch-manipulation min-h-[88px] min-w-[88px] rounded-full px-4 text-[16px] font-medium tracking-tight transition-[color,background-color,border-color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.97]";

/** Zelfde rustige basis; kleur alleen na keuze. */
const yesNoIdle =
  `${yesNoBtnBase} border border-primary/15 bg-primary/[0.06] text-primary/70 shadow-none hover:border-primary/25 hover:bg-primary/[0.10] hover:text-primary/90 dark:border-primary/25 dark:bg-primary/[0.12] dark:text-primary/75 dark:hover:border-primary/35 dark:hover:bg-primary/[0.16] dark:hover:text-primary/90`;

const yesNoYesClasses = (selected: boolean) =>
  selected
    ? `${yesNoBtnBase} border-transparent bg-emerald-600 text-white shadow-sm dark:bg-emerald-500`
    : yesNoIdle;

const yesNoNoClasses = (selected: boolean) =>
  selected
    ? `${yesNoBtnBase} border-transparent bg-rose-600 text-white shadow-sm dark:bg-rose-500`
    : yesNoIdle;

function YesNoBlock({
  label,
  value,
  onChange,
  variant = "center",
  lang = "nl",
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  variant?: "center" | "inline";
  lang?: OngevalLang;
}) {
  const isInline = variant === "inline";
  return (
    <div className={isInline ? "w-full" : "mx-auto w-full max-w-xl"}>
      <p
        className={
          isInline
            ? "mb-2 text-[14px] font-medium leading-snug text-foreground"
            : "mx-auto mb-4 max-w-[26rem] text-center font-heading text-[18px] font-semibold leading-snug tracking-tight text-foreground sm:text-[20px]"
        }
      >
        {label}
      </p>
      <div
        className={
          isInline
            ? "flex flex-wrap items-center justify-center gap-3 sm:justify-start"
            : "flex flex-wrap justify-center gap-4"
        }
      >
        <button
          type="button"
          onClick={() => onChange(true)}
          className={yesNoYesClasses(value === true) + (isInline ? " min-h-11 min-w-[72px] text-[14px]" : "")}
        >
          {t(lang, "common.yes")}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={yesNoNoClasses(value === false) + (isInline ? " min-h-11 min-w-[72px] text-[14px]" : "")}
        >
          {t(lang, "common.no")}
        </button>
      </div>
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  description,
  comingSoon,
  onClick,
  iconWrapClassName,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  comingSoon?: boolean;
  onClick: () => void;
  iconWrapClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-3 rounded-2xl border border-border/80 bg-card px-4 py-4 text-left shadow-[0_12px_26px_rgba(24,28,32,0.06)] transition-all hover:border-primary/25 hover:shadow-[0_4px_20px_rgba(39,153,215,0.1)] active:scale-[0.995]"
    >
      <div
        className={
          iconWrapClassName ??
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-secondary/90 text-primary ring-1 ring-primary/10"
        }
      >
        <Icon className="size-6" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-[15px] font-semibold leading-tight text-foreground">
            {title}
          </p>
          {comingSoon ? (
            <span className="inline-flex shrink-0 rounded-full border border-primary/15 bg-secondary/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              Binnenkort
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[13px] leading-snug text-muted-foreground">
          {description}
        </p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-primary/35 transition group-hover:translate-x-0.5 group-hover:text-primary/55" />
    </button>
  );
}

/** Voeg `id` toe of verwijder hem als hij al in de lijst stond. */
function toggleInList(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

/**
 * Lijst met selecteerbare opties. Standaard multi-select: gebruiker kan
 * meerdere vakjes aanvinken voor de huidige stap. De checkbox-stijl maakt
 * meteen visueel duidelijk dat meerdere keuzes mogelijk zijn.
 */
function OptionList({
  options,
  selectedIds,
  onToggle,
  lang = "nl",
}: {
  options: { id: string; title: string; description: string }[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  lang?: OngevalLang;
}) {
  const selectedSet = new Set(selectedIds);
  return (
    <div className="wizard-choice-step mx-auto w-full max-w-xl gap-3 md:max-w-2xl">
      <div className="app-ios-group shadow-[0_14px_34px_rgba(24,28,32,0.06)]">
        {options.map((o) => {
          const selected = selectedSet.has(o.id);
          const title = getDetailLabel(o.id, lang) || o.title;
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              onClick={() => onToggle(o.id)}
              className={cn(
                "group relative touch-manipulation flex w-full items-start justify-between gap-3 border-b border-border/60 px-4 py-3.5 text-left transition-[background-color] last:border-b-0",
                selected
                  ? "bg-secondary/70"
                  : "bg-card hover:bg-muted/25 active:bg-muted/35",
              )}
            >
              {selected ? (
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-full w-[3px] stitch-gradient-fill"
                />
              ) : null}
              <span className="min-w-0 flex-1">
                <span className="block font-heading text-[16px] font-semibold leading-snug text-foreground">
                  {title}
                </span>
                {o.description ? (
                  <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">
                    {o.description}
                  </span>
                ) : null}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
                  selected
                    ? "border-primary/25 bg-secondary/80 text-primary"
                    : "border-border/70 bg-card text-transparent group-hover:text-muted-foreground/35",
                )}
              >
                <Check className="size-5" strokeWidth={2.5} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function OverviewTabs({
  state,
  lang = "nl",
}: {
  state: AccidentReportState;
  lang?: OngevalLang;
}) {
  const [tab, setTab] = useState<
    "locatie" | "vragen" | "getuigen" | "gegevens" | "raakpunt"
  >("locatie");
  const loc = state.location;
  const notFilled = t(lang, "common.not_filled");
  const notSpecified = t(lang, "common.not_specified");
  const yesNo = (v: boolean | null) =>
    v === null ? null : v ? t(lang, "common.yes") : t(lang, "common.no");
  const personLine = (p: {
    voornaam: string;
    naam: string;
  }) => [p.voornaam, p.naam].filter(Boolean).join(" ");
  const addressLine = (a: {
    straat: string;
    huisnummer: string;
    bus?: string;
    postcode: string;
    stad: string;
    land: string;
  }) => {
    const street = [a.straat, a.huisnummer].filter(Boolean).join(" ");
    const bus = a.bus ? ` bus ${a.bus}` : "";
    const city = [a.postcode, a.stad].filter(Boolean).join(" ");
    const parts = [street + bus, city, a.land].filter((p) => p && p.trim());
    return parts.join(", ");
  };

  return (
    <div className="flex min-h-[320px] flex-col">
      <div className="flex overflow-x-auto border-b border-border bg-card px-2">
        {(
          [
            ["locatie", t(lang, "overview.tab.location"), MapPin],
            ["vragen", t(lang, "overview.tab.questions"), ClipboardList],
            ["raakpunt", t(lang, "overview.tab.impact"), TbCarCrash],
            ["getuigen", t(lang, "overview.tab.witnesses"), Users],
            ["gegevens", t(lang, "overview.tab.data"), UserCircle],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex min-h-11 flex-shrink-0 flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-[13px] font-medium ${
              tab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 px-4 py-4">
        {tab === "locatie" ? (
          <>
            <Section title={t(lang, "overview.section.place")} icon={MapPin}>
              <Row label={t(lang, "field.street")} value={loc.straat} />
              <Row label={t(lang, "field.housenumber")} value={loc.huisnummer} />
              <Row label={t(lang, "field.postcode")} value={loc.postcode} />
              <Row label={t(lang, "field.city")} value={loc.stad} />
              <Row label={t(lang, "field.country")} value={loc.land} />
            </Section>
            <Section title={t(lang, "overview.section.time")} icon={Clock}>
              <Row label={t(lang, "field.date")} value={formatDateForDisplay(loc.datum)} />
              <Row label={t(lang, "field.time")} value={formatTimeForDisplay(loc.tijd)} />
            </Section>
            <Section title={t(lang, "overview.section.damage")} icon={ShieldAlert}>
              <Row
                label={t(lang, "overview.row.injuries")}
                value={yesNo(state.gewonden) ?? notSpecified}
              />
              <Row
                label={t(lang, "overview.row.other_damage")}
                value={yesNo(state.materieleSchadeAnders) ?? notSpecified}
              />
            </Section>
          </>
        ) : null}
        {tab === "vragen" ? (
          <>
            <Section title={t(lang, "overview.section.accident_type")} icon={GoTasklist}>
              <Row
                label={t(lang, "overview.row.category")}
                value={
                  state.situationCategories.length > 0
                    ? state.situationCategories
                        .map((c) => getCategoryLabel(c, lang))
                        .filter(Boolean)
                        .join(" • ")
                    : t(lang, "overview.empty.category")
                }
              />
              <Row
                label={t(lang, "overview.row.detail")}
                value={
                  state.situationDetailKeys.length > 0
                    ? state.situationDetailKeys
                        .map((k) => getDetailLabel(k, lang))
                        .filter(Boolean)
                        .join(" • ")
                    : t(lang, "overview.empty.detail")
                }
              />
              {state.situationCategories.includes("maneuver") ? (
                <>
                  <Row
                    label={t(lang, "overview.row.maneuver_a")}
                    value={
                      state.maneuverAKeys.length > 0
                        ? state.maneuverAKeys
                            .map((k) => getDetailLabel(k, lang))
                            .filter(Boolean)
                            .join(" • ")
                        : t(lang, "overview.empty.maneuver_a")
                    }
                  />
                  <Row
                    label={t(lang, "overview.row.maneuver_b")}
                    value={
                      state.maneuverBKeys.length > 0
                        ? state.maneuverBKeys
                            .map((k) => getDetailLabel(k, lang))
                            .filter(Boolean)
                            .join(" • ")
                        : t(lang, "overview.empty.maneuver_b")
                    }
                  />
                </>
              ) : null}
            </Section>
            {state.circumstancesNotes.trim().length > 0 ? (
              <Section title={t(lang, "overview.section.proposal")} icon={Pencil}>
                <Row
                  label={t(lang, "overview.row.circumstances")}
                  value={state.circumstancesNotes}
                />
              </Section>
            ) : null}
            <Section title={t(lang, "overview.section.vehicle_contact")} icon={TbCarCrash}>
              <Row
                label={t(lang, "overview.row.contact")}
                value={yesNo(state.vehicleContact) ?? notSpecified}
              />
            </Section>
          </>
        ) : null}
        {tab === "raakpunt" ? (
          <>
            <Section title={t(lang, "overview.section.impact_a")} icon={TbCarCrash}>
              <OverviewImpactPreview party="A" point={state.impactPartyA} lang={lang} />
            </Section>
            <Section title={t(lang, "overview.section.impact_b")} icon={TbCarCrash}>
              <OverviewImpactPreview party="B" point={state.impactPartyB} lang={lang} />
            </Section>
          </>
        ) : null}
        {tab === "getuigen" ? (
          <Section title={t(lang, "overview.section.witnesses")} icon={Users}>
            {state.hasGetuigen === false ? (
              <p className="text-[14px] text-foreground">
                {t(lang, "overview.witnesses.none")}
              </p>
            ) : state.getuigenList.length > 0 ? (
              <div className="flex flex-col gap-2">
                {state.getuigenList.map((w, idx) => {
                  const name = [w.voornaam, w.naam]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                  return (
                    <div
                      key={idx}
                      className="rounded-lg border border-border/80 bg-card px-3 py-2"
                    >
                      <p className="text-[14px] font-semibold text-foreground">
                        {name || notFilled}
                      </p>
                      {w.telefoon ? (
                        <p className="text-[12.5px] text-muted-foreground">
                          {w.telefoon}
                        </p>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[14px] italic text-muted-foreground">
                {t(lang, "overview.empty.witnesses")}
              </p>
            )}
          </Section>
        ) : null}
        {tab === "gegevens" ? (
          <>
            <Section title={t(lang, "overview.section.driver_a")} icon={UserCircle}>
              <Row label={t(lang, "field.lastname")} value={personLine(state.partyA.bestuurder) || notFilled} />
              <Row
                label={t(lang, "field.birthdate")}
                value={
                  formatDateForDisplay(state.partyA.bestuurder.geboortedatum) ||
                  notFilled
                }
              />
              <Row label={t(lang, "overview.row.phone")} value={state.partyA.bestuurder.telefoon || notFilled} />
              <Row label={t(lang, "overview.row.email")} value={state.partyA.bestuurder.email || notFilled} />
              <Row label={t(lang, "overview.row.license")} value={state.partyA.bestuurder.rijbewijsNummer || notFilled} />
              <Row label={t(lang, "overview.row.address")} value={addressLine(state.partyA.bestuurder.adres) || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.vehicle_a")} icon={Car}>
              <Row label={t(lang, "field.make_model")} value={state.partyA.voertuig.merkModel || notFilled} />
              <Row label={t(lang, "field.plate")} value={state.partyA.voertuig.nummerplaat || notFilled} />
              <Row label={t(lang, "field.country")} value={state.partyA.voertuig.landInschrijving || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.insurance_a")} icon={BadgeCheck}>
              <Row label={t(lang, "overview.row.company")} value={state.partyA.verzekering.maatschappij || notFilled} />
              <Row label={t(lang, "overview.row.policy")} value={state.partyA.verzekering.polisnummer || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.holder_a")} icon={Building2}>
              <Row label={t(lang, "field.lastname")} value={personLine(state.partyA.verzekeringsnemer) || notFilled} />
              <Row label={t(lang, "overview.row.enterprise")} value={state.partyA.verzekeringsnemer.ondernemingsnummer || t(lang, "common.dash")} />
              <Row label={t(lang, "overview.row.address")} value={addressLine(state.partyA.verzekeringsnemer.adres) || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.driver_b")} icon={UserCircle}>
              <Row label={t(lang, "field.lastname")} value={personLine(state.partyB.bestuurder) || notFilled} />
              <Row
                label={t(lang, "field.birthdate")}
                value={
                  formatDateForDisplay(state.partyB.bestuurder.geboortedatum) ||
                  notFilled
                }
              />
              <Row label={t(lang, "overview.row.phone")} value={state.partyB.bestuurder.telefoon || notFilled} />
              <Row label={t(lang, "overview.row.email")} value={state.partyB.bestuurder.email || notFilled} />
              <Row label={t(lang, "overview.row.license")} value={state.partyB.bestuurder.rijbewijsNummer || notFilled} />
              <Row label={t(lang, "overview.row.address")} value={addressLine(state.partyB.bestuurder.adres) || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.vehicle_b")} icon={Car}>
              <Row label={t(lang, "field.make_model")} value={state.partyB.voertuig.merkModel || notFilled} />
              <Row label={t(lang, "field.plate")} value={state.partyB.voertuig.nummerplaat || notFilled} />
              <Row label={t(lang, "field.country")} value={state.partyB.voertuig.landInschrijving || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.insurance_b")} icon={BadgeCheck}>
              <Row label={t(lang, "overview.row.company")} value={state.partyB.verzekering.maatschappij || notFilled} />
              <Row label={t(lang, "overview.row.policy")} value={state.partyB.verzekering.polisnummer || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.holder_b")} icon={Building2}>
              <Row label={t(lang, "field.lastname")} value={personLine(state.partyB.verzekeringsnemer) || notFilled} />
              <Row label={t(lang, "overview.row.address")} value={addressLine(state.partyB.verzekeringsnemer.adres) || notFilled} />
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function OverviewImpactPreview({
  party,
  point,
  lang = "nl",
}: {
  party: "A" | "B";
  point: { x: number; y: number } | null;
  lang?: OngevalLang;
}) {
  if (!point) {
    return (
      <p className="text-[14px] italic text-muted-foreground">
        {t(lang, "overview.empty.impact")}
      </p>
    );
  }
  return (
    <div className="flex justify-center">
      <div className="relative w-[140px]">
        <ImpactDiagram
          label=""
          party={party}
          value={point}
          onChange={() => {}}
          readOnly
        />
      </div>
    </div>
  );
}

type SectionIcon = React.ComponentType<{
  className?: string;
  "aria-hidden"?: boolean | "true" | "false";
}>;

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: SectionIcon;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-primary/10 bg-secondary/60 px-3 py-1.5 text-[13px] font-semibold text-foreground">
        {Icon ? (
          <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
        ) : null}
        <span className="min-w-0 truncate">{title}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className="text-[15px] font-semibold text-foreground">{value || "—"}</p>
    </div>
  );
}

function PdfPreviewStep({
  reportId,
  guestSecret,
  lang = "nl",
}: {
  reportId: string;
  guestSecret: string | null;
  lang?: OngevalLang;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewUrl = useMemo(() => {
    const base = `/api/ongeval/${reportId}/pdf`;
    return guestSecret ? `${base}?s=${encodeURIComponent(guestSecret)}` : base;
  }, [reportId, guestSecret]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(previewUrl, { method: "GET" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let detail = "Onbekende fout";
        try {
          const parsed = JSON.parse(text);
          detail = parsed?.detail || parsed?.error || detail;
        } catch {
          detail = text || `HTTP ${res.status}`;
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Unknown error");
      toast.error(t(lang, "complete.error_title"));
    } finally {
      setLoading(false);
    }
  }, [previewUrl, lang]);

  useEffect(() => {
    void loadPreview();
    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  const download = useCallback(() => {
    const dlUrl = guestSecret
      ? `${previewUrl}&dl=1`
      : `${previewUrl}?dl=1`;
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = `aanrijdingsformulier-${reportId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [previewUrl, guestSecret, reportId]);

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[18px] font-semibold text-foreground">
          {t(lang, "complete.title")}
        </p>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          {t(lang, "complete.subtitle")}
        </p>
      </div>
      <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-border bg-muted">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-muted-foreground">
            {t(lang, "complete.loading")}
          </div>
        ) : null}
        {errorMessage && !loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-[14px] font-medium text-destructive">
              {t(lang, "complete.error_title")}
            </p>
            <p className="text-[12px] text-muted-foreground">{errorMessage}</p>
            <Button
              type="button"
              onClick={() => {
                void loadPreview();
              }}
              className="stitch-btn-primary h-10 rounded-lg text-[13px] font-semibold"
            >
              {t(lang, "complete.retry")}
            </Button>
          </div>
        ) : null}
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="h-[520px] w-full"
            title="European accident statement preview"
          />
        ) : null}
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
        <Button
          type="button"
          disabled={!pdfUrl}
          onClick={download}
          className="stitch-btn-primary h-12 w-full justify-center gap-2 rounded-xl text-[15px] font-semibold shadow-[0_14px_30px_rgba(0,98,142,0.2)] active:scale-[0.99] disabled:opacity-50 disabled:shadow-none"
        >
          <Download aria-hidden="true" />
          {t(lang, "complete.download")}
        </Button>
      </div>
    </div>
  );
}

type SendStatus = "idle" | "sending" | "sent" | "failed";

function sendErrorMessage(lang: OngevalLang, key: string | null): string {
  switch (key) {
    case "no_recipient":
      return t(lang, "send.error.no_recipient");
    case "incomplete":
      return t(lang, "send.error.incomplete");
    case "forbidden":
      return t(lang, "send.error.forbidden");
    default:
      return t(lang, "send.error.generic");
  }
}

/**
 * Toon "verzend naar fleetmanager" met manuele actie (enkel partij A).
 * De wizard toont statusfeedback; bij mislukking is er een retry-knop.
 * Definitieve afwerking + herverzendknop met statusbadge zit op /ongeval
 * ("Mijn incidenten").
 */
function AutoSendStatus({
  reportId,
  lang,
  isPartyB,
}: {
  reportId: string;
  lang: OngevalLang;
  isPartyB: boolean;
}) {
  const [status, setStatus] = useState<SendStatus>("idle");
  const [recipient, setRecipient] = useState<string | null>(null);
  const [cc, setCc] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const send = useCallback(async () => {
    setStatus("sending");
    setErrorKey(null);
    setErrorDetail(null);
    try {
      const res = await fetch(`/api/ongeval/${reportId}/send`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.ok === false) {
        const err = (body?.error as string | undefined) ?? "generic";
        setErrorKey(err);
        setErrorDetail(typeof body?.detail === "string" ? body.detail : null);
        setStatus("failed");
        return;
      }
      setRecipient(body?.recipient ?? null);
      setCc(body?.cc ?? null);
      setSimulated(Boolean(body?.simulated));
      setStatus("sent");
    } catch (e) {
      setErrorKey("generic");
      setErrorDetail(e instanceof Error ? e.message : null);
      setStatus("failed");
    }
  }, [reportId]);

  if (isPartyB) {
    return (
      <p
        role="status"
        className="mx-4 mb-6 px-4 text-center text-[13px] leading-snug text-muted-foreground"
      >
        {t(lang, "send.b.waiting")}
      </p>
    );
  }

  if (status === "idle") {
    return (
      <div className="mx-4 mb-6 flex flex-col items-center px-4 py-2 text-center">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
          <button
            type="button"
            onClick={() => void send()}
            className={cn(
              "stitch-btn-primary h-12 w-full justify-center gap-2 rounded-xl text-[15px] font-semibold shadow-[0_14px_30px_rgba(0,98,142,0.2)] active:scale-[0.99] disabled:opacity-50 disabled:shadow-none",
              "inline-flex items-center",
            )}
          >
            <Send className="size-4" aria-hidden />
            {t(lang, "send.button")}
          </button>
        </div>
      </div>
    );
  }

  if (status === "sending") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-4 mb-6 flex flex-col items-center gap-3 px-4 py-4"
      >
        <div className="relative h-9 w-full max-w-sm overflow-hidden">
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-1.5 h-px bg-gradient-to-r from-transparent via-primary/35 to-transparent"
          />
          <FaCarSide
            aria-hidden
            className="absolute bottom-1 h-7 w-7 text-primary [animation:wizardSendCar_2.4s_linear_infinite] motion-reduce:animate-none"
          />
        </div>
        <p className="text-center text-[14px] font-medium text-foreground">
          {t(lang, "send.sending")}
        </p>
        <style>{`@keyframes wizardSendCar{0%{left:-28px}100%{left:100%}}`}</style>
      </div>
    );
  }

  if (status === "sent") {
    return (
      <div
        role="status"
        aria-live="polite"
        className="mx-4 mb-6 flex flex-col items-center gap-2 px-4 py-4 text-center"
      >
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-emerald-600/12 text-emerald-700"
        >
          <Check className="size-5" strokeWidth={3} />
        </span>
        <p className="text-[14px] font-semibold text-emerald-800">
          {t(lang, "send.success_title")}
        </p>
        {recipient ? (
          <p className="max-w-md break-all text-[12.5px] leading-snug text-muted-foreground">
            <span className="text-foreground/65">
              {t(lang, "send.success_to")}
            </span>{" "}
            <span className="font-medium text-foreground">{recipient}</span>
          </p>
        ) : null}
        {cc ? (
          <p className="max-w-md break-all text-[12px] leading-snug text-muted-foreground">
            <span className="text-foreground/55">
              {t(lang, "send.success_cc")}
            </span>{" "}
            {cc}
          </p>
        ) : null}
        {simulated ? (
          <p className="inline-flex rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900">
            {t(lang, "send.success_simulated")}
          </p>
        ) : null}
      </div>
    );
  }

  // status === "failed"
  return (
    <div
      role="alert"
      className="mx-4 mb-6 flex flex-col items-center gap-2 px-4 py-4 text-center"
    >
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-full bg-destructive/12 text-destructive"
      >
        <X className="size-5" strokeWidth={3} />
      </span>
      <p className="text-[14px] font-semibold text-destructive">
        {t(lang, "send.failure_title")}
      </p>
      <p className="max-w-md text-[12.5px] leading-snug text-muted-foreground">
        {sendErrorMessage(lang, errorKey)}
      </p>
      {errorDetail && errorKey !== "no_recipient" ? (
        <p className="max-w-md text-[11px] leading-snug text-muted-foreground/85">
          {errorDetail}
        </p>
      ) : null}
      <p className="max-w-md text-[11.5px] leading-snug text-muted-foreground/85">
        {t(lang, "send.retry_hint")}
      </p>
      <button
        type="button"
        onClick={() => void send()}
        className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 text-[13px] font-semibold text-white shadow-sm transition-[filter,transform] hover:bg-emerald-700 active:scale-[0.99]"
      >
        <RefreshCw className="size-3.5" aria-hidden />
        {t(lang, "send.button_retry")}
      </button>
    </div>
  );
}
