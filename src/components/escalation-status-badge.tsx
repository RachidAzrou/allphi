import { CheckCircle2, CircleDot, MailOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  fleetEscalationBadgeClass,
  fleetEscalationLabelNl,
  normalizeFleetEscalationStatus,
} from "@/lib/fleet/escalation-status";

const iconClass = "shrink-0 opacity-[0.92] [stroke-width:2.25]";

/**
 * Duidelijke status-pill voor fleet-escalaties (Nieuw / Open / Afgehandeld) met icoon.
 */
export function EscalationStatusBadge({
  status,
  className,
  size = "default",
}: {
  status: string | null | undefined;
  className?: string;
  size?: "default" | "compact";
}) {
  const n = normalizeFleetEscalationStatus(status);
  const label = fleetEscalationLabelNl(status);
  const Icon = n === "unread" ? CircleDot : n === "open" ? MailOpen : CheckCircle2;
  return (
    <span
      className={cn(
        "inline-flex w-fit max-w-full items-center gap-1.5 rounded-full font-semibold tracking-wide",
        size === "compact" ? "min-h-6 px-2 py-0.5 text-[10px] uppercase" : "min-h-7 px-2.5 py-1 text-[11px] uppercase",
        fleetEscalationBadgeClass(status),
        className,
      )}
    >
      <Icon className={cn(size === "compact" ? "size-3" : "size-3.5", iconClass)} aria-hidden />
      <span className="truncate">{label}</span>
    </span>
  );
}
