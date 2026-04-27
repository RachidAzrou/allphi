"use client";

import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = "draft" | "submitted" | "approved" | "rejected" | "ordered" | "delivered";

function Step({
  title,
  subtitle,
  done,
  error,
}: {
  title: string;
  subtitle?: string;
  done?: boolean;
  error?: boolean;
}) {
  const Icon = error ? XCircle : done ? CheckCircle2 : Clock;
  const color = error ? "text-destructive" : done ? "text-primary" : "text-muted-foreground";
  return (
    <div className="flex items-start gap-3">
      <div className={cn("mt-0.5 rounded-full bg-muted p-1.5", done && "bg-primary/10")}>
        <Icon className={cn("size-4", color)} strokeWidth={2.25} aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-foreground">{title}</p>
        {subtitle ? (
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
    </div>
  );
}

export function ApprovalTimeline({
  status,
  fleetApprovedAt,
  managementApprovedAt,
  note,
}: {
  status: Status;
  fleetApprovedAt?: string | null;
  managementApprovedAt?: string | null;
  note?: string | null;
}) {
  const isRejected = status === "rejected";
  const isSubmitted = status !== "draft";
  const fleetDone = Boolean(fleetApprovedAt) || status === "approved" || status === "ordered" || status === "delivered";
  const mgmtDone = Boolean(managementApprovedAt) || status === "approved" || status === "ordered" || status === "delivered";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <p className="text-[14px] font-semibold text-foreground">Status</p>
      <div className="mt-3 space-y-3">
        <Step
          title="Ingediend"
          subtitle="Je bestelling is doorgestuurd voor goedkeuring."
          done={isSubmitted}
          error={isRejected}
        />
        <Step
          title="Goedkeuring Fleet"
          subtitle={fleetApprovedAt ? `Goedgekeurd op ${new Date(fleetApprovedAt).toLocaleString("nl-BE")}` : "Wacht op Fleet."}
          done={fleetDone}
          error={isRejected}
        />
        <Step
          title="Goedkeuring Management"
          subtitle={
            managementApprovedAt
              ? `Goedgekeurd op ${new Date(managementApprovedAt).toLocaleString("nl-BE")}`
              : "Wacht op Management."
          }
          done={mgmtDone}
          error={isRejected}
        />
        <Step
          title="Besteld & levering"
          subtitle="Na goedkeuring wordt de bestelling geplaatst en opgevolgd tot levering."
          done={status === "ordered" || status === "delivered"}
          error={isRejected}
        />
      </div>
      {note ? (
        <div className="mt-4 rounded-xl bg-muted px-3 py-2 text-[12.5px] text-muted-foreground">
          <span className="font-semibold text-foreground">Opmerking:</span> {note}
        </div>
      ) : null}
    </div>
  );
}

