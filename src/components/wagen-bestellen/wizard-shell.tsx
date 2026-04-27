"use client";

import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function WizardShell({
  title,
  subtitle,
  onRequestClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onRequestClose?: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[46rem] px-4 pb-10 pt-5">
      <header className="relative space-y-1.5">
        {onRequestClose ? (
          <button
            type="button"
            onClick={onRequestClose}
            className="app-surface absolute right-0 top-0 inline-flex min-h-10 min-w-10 items-center justify-center rounded-full text-muted-foreground shadow-sm ring-1 ring-border/70 transition-colors hover:bg-card active:bg-card"
            aria-label="Sluiten"
          >
            <X className="size-5" strokeWidth={1.75} />
          </button>
        ) : null}
        <h1 className="font-heading text-[22px] font-semibold leading-tight text-foreground">
          {title}
        </h1>
        {subtitle ? (
          <p className="text-[13.5px] leading-relaxed text-muted-foreground">{subtitle}</p>
        ) : null}
      </header>

      <section className={cn("mt-5 space-y-4")}>{children}</section>

      {footer ? <footer className="mt-8">{footer}</footer> : null}
    </main>
  );
}

