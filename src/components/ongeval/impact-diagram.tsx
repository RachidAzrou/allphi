"use client";

import { useCallback, useRef } from "react";
import type { ImpactPoint } from "@/types/ongeval";
import { cn } from "@/lib/utils";

type ImpactDiagramProps = {
  label: string;
  value: ImpactPoint | null;
  onChange: (p: ImpactPoint) => void;
  party: "A" | "B";
};

/** Top-down car silhouette; marker stored as 0–1 in the diagram box. */
export function ImpactDiagram({
  label,
  value,
  onChange,
  party,
}: ImpactDiagramProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const setFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      const nx = Math.min(1, Math.max(0, x));
      const ny = Math.min(1, Math.max(0, y));
      onChange({ x: nx, y: ny });
    },
    [onChange],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setFromClient(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    setFromClient(e.clientX, e.clientY);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const carFill = party === "A" ? "#2799D7" : "#6B9BC4";

  return (
    <div className="flex flex-col items-center gap-3 px-4 py-4">
      <p className="text-center text-[15px] font-medium text-[#163247]">
        {label}
      </p>
      <div
        ref={boxRef}
        className={cn(
          "relative aspect-[3/5] w-full max-w-[280px] touch-none select-none rounded-2xl border border-[#2799D7]/10 bg-gradient-to-b from-[#F7F9FC] to-white p-4 shadow-[0_2px_16px_rgba(39,153,215,0.08)]",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label="Raakpunt op het voertuig aanduiden"
      >
        <svg
          viewBox="0 0 100 180"
          className="pointer-events-none h-full w-full drop-shadow-sm"
          aria-hidden
        >
          <rect
            x="18"
            y="8"
            width="64"
            height="164"
            rx="14"
            fill={carFill}
            opacity={0.92}
          />
          <rect
            x="28"
            y="22"
            width="44"
            height="36"
            rx="6"
            fill="white"
            opacity={0.35}
          />
          <rect
            x="28"
            y="122"
            width="44"
            height="36"
            rx="6"
            fill="white"
            opacity={0.35}
          />
          <circle cx="22" cy="48" r="7" fill="#222" />
          <circle cx="78" cy="48" r="7" fill="#222" />
          <circle cx="22" cy="132" r="7" fill="#222" />
          <circle cx="78" cy="132" r="7" fill="#222" />
        </svg>
        {value ? (
          <div
            className="pointer-events-none absolute h-0 w-0"
            style={{
              left: `${value.x * 100}%`,
              top: `${value.y * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="flex h-10 w-10 -translate-x-1/2 -translate-y-full items-end justify-center">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                className="text-[#163247] drop-shadow-sm"
              >
                <path
                  fill="currentColor"
                  d="M12 2L4 14h16L12 2zm0 4l4.5 6h-9L12 6z"
                />
              </svg>
            </div>
          </div>
        ) : null}
      </div>
      <p className="max-w-sm text-center text-[13px] leading-snug text-[#5F7382]">
        Tik of sleep om het raakpunt aan te duiden. De pijl wijst naar de
        eerste contactzone.
      </p>
    </div>
  );
}
