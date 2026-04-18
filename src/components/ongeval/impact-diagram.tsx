"use client";

import { useCallback, useRef } from "react";
import type { ImpactPoint } from "@/types/ongeval";
import { cn } from "@/lib/utils";

type ImpactDiagramProps = {
  label: string;
  value: ImpactPoint | null;
  onChange: (p: ImpactPoint) => void;
  party: "A" | "B";
  readOnly?: boolean;
  /** Hulptekst onder het diagram — al vertaald aangeleverd. */
  hint?: string;
};

/**
 * Top-down silhouet van een auto om het raakpunt aan te duiden. Waarde wordt
 * genormaliseerd (0–1) opgeslagen zodat de marker ook klopt bij een andere
 * container-grootte (bv. in het overzicht).
 */
export function ImpactDiagram({
  label,
  value,
  onChange,
  party,
  readOnly = false,
  hint,
}: ImpactDiagramProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const setFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (readOnly) return;
      const el = boxRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (clientX - r.left) / r.width;
      const y = (clientY - r.top) / r.height;
      const nx = Math.min(1, Math.max(0, x));
      const ny = Math.min(1, Math.max(0, y));
      onChange({ x: nx, y: ny });
    },
    [onChange, readOnly],
  );

  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setFromClient(e.clientX, e.clientY);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (readOnly) return;
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

  // Kleurpalet per partij. Body, ruiten en accenten.
  const palette = party === "A"
    ? {
        body: "#2E7FD6", // helderblauw
        bodyDark: "#1C5FA8",
        glass: "#BDE1FB",
        accent: "#FFFFFF",
      }
    : {
        body: "#F7C948", // warmgeel
        bodyDark: "#C69413",
        glass: "#FDF1C6",
        accent: "#1A1A1A",
      };

  return (
    <div className={cn("flex flex-col items-center gap-3", !readOnly && "px-4 py-4") }>
      {label ? (
        <p className="text-center text-[15px] font-medium text-[#163247]">
          {label}
        </p>
      ) : null}
      <div
        ref={boxRef}
        className={cn(
          "relative aspect-[3/5] w-full touch-none select-none rounded-2xl border border-[#2799D7]/10 p-2 shadow-[0_2px_16px_rgba(39,153,215,0.08)]",
          readOnly
            ? "max-w-[160px] bg-white"
            : "max-w-[280px] cursor-crosshair bg-gradient-to-b from-[#F7F9FC] to-white p-4",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={readOnly ? "Raakpunt overzicht" : "Raakpunt op het voertuig aanduiden"}
      >
        <svg
          viewBox="0 0 100 180"
          className="pointer-events-none h-full w-full drop-shadow-sm"
          aria-hidden
        >
          <defs>
            <linearGradient id={`carBody-${party}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={palette.body} />
              <stop offset="100%" stopColor={palette.bodyDark} />
            </linearGradient>
          </defs>
          {/* Body — getekend als silhouet met neusjes en afgeronde kont. */}
          <path
            d="M50 4
               C 30 4, 20 14, 18 30
               L 18 150
               C 20 166, 30 176, 50 176
               C 70 176, 80 166, 82 150
               L 82 30
               C 80 14, 70 4, 50 4 Z"
            fill={`url(#carBody-${party})`}
            stroke={palette.bodyDark}
            strokeWidth="1"
          />
          {/* Voorruit */}
          <path
            d="M28 30 L 72 30 L 68 54 L 32 54 Z"
            fill={palette.glass}
            opacity={0.85}
          />
          {/* Achterruit */}
          <path
            d="M32 126 L 68 126 L 72 150 L 28 150 Z"
            fill={palette.glass}
            opacity={0.85}
          />
          {/* Motorkap-accent */}
          <rect x="30" y="10" width="40" height="6" rx="2" fill={palette.bodyDark} opacity={0.35} />
          {/* Dak */}
          <rect x="34" y="56" width="32" height="68" rx="4" fill={palette.accent} opacity={0.15} />
          {/* Zijspiegels */}
          <circle cx="18" cy="40" r="4" fill={palette.bodyDark} />
          <circle cx="82" cy="40" r="4" fill={palette.bodyDark} />
          {/* Wielen */}
          <rect x="12" y="36" width="10" height="22" rx="3" fill="#222" />
          <rect x="78" y="36" width="10" height="22" rx="3" fill="#222" />
          <rect x="12" y="122" width="10" height="22" rx="3" fill="#222" />
          <rect x="78" y="122" width="10" height="22" rx="3" fill="#222" />
          {/* Koplampen & achterlichten */}
          <rect x="26" y="8" width="10" height="4" rx="1" fill="#FFF7C0" />
          <rect x="64" y="8" width="10" height="4" rx="1" fill="#FFF7C0" />
          <rect x="26" y="168" width="10" height="4" rx="1" fill="#C43838" />
          <rect x="64" y="168" width="10" height="4" rx="1" fill="#C43838" />
        </svg>
        {value ? (
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${value.x * 100}%`,
              top: `${value.y * 100}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <svg width="34" height="46" viewBox="0 0 34 46" aria-hidden>
              <defs>
                <filter id={`arrowShadow-${party}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#000" floodOpacity="0.35" />
                </filter>
              </defs>
              <g filter={`url(#arrowShadow-${party})`}>
                {/* Rode, duidelijk richtinggevoelige pijl die naar het raakpunt wijst. */}
                <path
                  d="M17 46 L 7 26 L 13 26 L 13 2 L 21 2 L 21 26 L 27 26 Z"
                  fill="#E11D2E"
                  stroke="#7A0A15"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </div>
        ) : null}
      </div>
      {!readOnly ? (
        <p className="max-w-sm text-center text-[13px] leading-snug text-[#5F7382]">
          {hint ??
            "Tik of sleep om het raakpunt aan te duiden. De rode pijl wijst naar de eerste contactzone."}
        </p>
      ) : null}
    </div>
  );
}
