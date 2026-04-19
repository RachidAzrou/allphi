"use client";

import {
  ArrowLeft,
  ArrowLeftRight,
  BadgeCheck,
  Building2,
  Car,
  Check,
  ClipboardList,
  DoorOpen,
  FilePenLine,
  GitBranch,
  Languages,
  LogOut,
  MapPin,
  ParkingCircle,
  Pencil,
  QrCode,
  ScanLine,
  ShieldAlert,
  Smartphone,
  Split,
  Truck,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";
import { TbCarCrash, TbScribble } from "react-icons/tb";
import { FaMagnifyingGlass, FaSignature } from "react-icons/fa6";
import { MdOutlineSmartphone } from "react-icons/md";
import type { IconType } from "react-icons";
import { cn } from "@/lib/utils";
import { InfoBanner } from "@/components/ongeval/info-banner";
import type { OngevalStepId } from "@/types/ongeval";
import { getProgressForStep } from "@/lib/ongeval/engine";
import { getStepTitleLocalized, type OngevalLang } from "@/lib/ongeval/i18n";

/**
 * Iconenmap per stap-id voor in de wizard-header. Houdt UI- en domein-
 * concerns gescheiden van `engine.ts`. Onbekende ids vallen terug op
 * `FilePenLine` zodat nieuwe stappen niet meteen breken.
 */
const STEP_ICONS: Partial<Record<OngevalStepId, LucideIcon | IconType>> = {
  submission_mode: FilePenLine,
  scan_capture: ScanLine,
  driver_select: UserCircle,
  driver_employee_form: UserCircle,
  driver_other_form: UserCircle,
  policyholder_select: Building2,
  policyholder_form: Building2,
  insurer_select: BadgeCheck,
  vehicle_confirm: Car,
  parties_count: Users,
  devices_count: MdOutlineSmartphone,
  role_select: UserCircle,
  share_qr: QrCode,
  scan_qr: QrCode,
  party_b_language: Languages,
  party_b_optional: Smartphone,
  party_b_form: UserCircle,
  location_time: MapPin,
  injuries_material: ShieldAlert,
  witnesses: Users,
  situation_main: ClipboardList,
  sit_rear_end: Car,
  sit_center_line: ArrowLeftRight,
  sit_priority: ShieldAlert,
  sit_maneuver_a: GitBranch,
  sit_maneuver_b: GitBranch,
  sit_lane_change: Split,
  sit_parking: ParkingCircle,
  sit_door: DoorOpen,
  sit_load: Truck,
  circumstances_manual: Pencil,
  vehicle_contact: TbCarCrash,
  impact_party_a: TbCarCrash,
  impact_party_b: TbCarCrash,
  visible_damage_a: FaMagnifyingGlass,
  visible_damage_b: FaMagnifyingGlass,
  accident_sketch: TbScribble,
  overview_intro: ClipboardList,
  overview_detail: ClipboardList,
  signature_a: FaSignature,
  signature_b: FaSignature,
  complete: BadgeCheck,
};

type WizardShellProps = {
  stepId: OngevalStepId;
  /** In chat-modal: vult het venster i.p.v. volledig scherm */
  embedded?: boolean;
  bannerMessage?: string;
  bannerDismissed?: boolean;
  onDismissBanner?: () => void;
  onBack: () => void;
  showBack?: boolean;
  onExit: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Effectieve UI-taal (B kiest een taal; anders NL). */
  lang?: OngevalLang;
  /** "Stap X van Y" label, i18n; default NL. */
  stepLabel?: (step: number, total: number) => string;
};

export function WizardShell({
  stepId,
  embedded = false,
  bannerMessage,
  bannerDismissed,
  onDismissBanner,
  onBack,
  showBack = true,
  onExit,
  children,
  footer,
  lang = "nl",
  stepLabel,
}: WizardShellProps) {
  const { step, total, fraction } = getProgressForStep(stepId);
  const title = getStepTitleLocalized(stepId, lang);
  const StepIcon = STEP_ICONS[stepId] ?? FilePenLine;
  const progressText = stepLabel
    ? stepLabel(step, total)
    : lang === "fr"
      ? `Étape ${step} sur ${total}`
      : lang === "en"
        ? `Step ${step} of ${total}`
        : `Stap ${step} van ${total}`;
  const backAria = lang === "fr" ? "Retour" : lang === "en" ? "Back" : "Terug";
  const exitAria =
    lang === "fr" ? "Fermer" : lang === "en" ? "Close" : "Afsluiten";
  const showBanner = Boolean(
    bannerMessage && !bannerDismissed && onDismissBanner,
  );

  return (
    <div
      className={cn(
        "flex flex-col bg-white",
        embedded ? "h-full min-h-0 max-h-full" : "min-h-[100dvh]",
      )}
    >
      <header className="sticky top-0 z-40 safe-top shrink-0 border-b border-white/15 bg-gradient-to-b from-[#2799D7] to-[#2389C4] text-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="flex h-[52px] min-h-[52px] items-center px-1 pr-safe">
          {showBack ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors hover:bg-white/12 active:bg-white/18"
              aria-label={backAria}
            >
              <ArrowLeft className="size-6" strokeWidth={1.75} />
            </button>
          ) : (
            <div className="h-11 w-11 shrink-0" aria-hidden />
          )}
          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 px-1">
            <StepIcon
              aria-hidden
              className="size-[22px] shrink-0 text-white"
              strokeWidth={2}
            />
            <h1 className="font-heading min-w-0 truncate text-center text-[16px] font-semibold leading-tight tracking-tight">
              {title}
            </h1>
          </div>
          <button
            type="button"
            onClick={onExit}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors hover:bg-[#FCA5A5]/35 hover:text-white active:bg-[#F87171]/55"
            aria-label={exitAria}
          >
            <LogOut className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="relative mx-3 mb-1 h-[3px] overflow-hidden rounded-full bg-white/20">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.35)] transition-[width] duration-300 ease-out"
            style={{ width: `${Math.min(100, fraction * 100)}%` }}
          />
        </div>
        <p className="px-3 pb-2.5 text-right text-[11px] font-medium tabular-nums tracking-wide text-white/85">
          {progressText}
        </p>
      </header>

      {showBanner && bannerMessage ? (
        <InfoBanner
          message={bannerMessage}
          visible
          onDismiss={onDismissBanner!}
        />
      ) : null}

      <main
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain",
          footer ? "pb-[env(safe-area-inset-bottom)]" : "pb-safe",
        )}
      >
        {children}
      </main>

      {footer ? (
        <div className="sticky bottom-0 z-30 shrink-0 border-t border-[#2799D7]/10 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_32px_rgba(11,20,26,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function WizardFooterButton({
  label,
  onClick,
  disabled,
  variant = "primary",
}: {
  label: string;
  onClick: () => void | Promise<void>;
  disabled?: boolean;
  variant?: "primary" | "dark";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => void onClick()}
      className={cn(
        "flex min-h-14 w-full items-center justify-center px-4 text-[16px] font-semibold tracking-tight transition-[opacity,transform] active:scale-[0.998] disabled:opacity-40",
        variant === "primary"
          ? "bg-[#2799D7] text-white shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)] hover:bg-[#2389C4] active:bg-[#1e7bb0]"
          : "border-t border-black/[0.06] bg-[#F0F4F8] text-[#163247] hover:bg-[#E8EEF3] active:bg-[#E2E9EF]",
      )}
    >
      {label}
    </button>
  );
}

export function WizardCheckButton({
  onClick,
  disabled,
  "aria-label": ariaLabel,
}: {
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-40"
      aria-label={ariaLabel ?? "Bevestigen"}
    >
      <Check className="size-6" strokeWidth={2} />
    </button>
  );
}
