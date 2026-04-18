"use client";

import { useCallback, useRef } from "react";
import Image from "next/image";
import type { ImpactPoint } from "@/types/ongeval";
import { cn } from "@/lib/utils";

type ImpactDiagramProps = {
  label: string;
  value: ImpactPoint | null;
  onChange: (p: ImpactPoint) => void;
  /** Behouden voor compat — niet meer gebruikt voor styling. */
  party: "A" | "B";
  readOnly?: boolean;
  /** Hulptekst onder het diagram — al vertaald aangeleverd. */
  hint?: string;
};

/**
 * Voertuigselectie + raakpunt: toont de drie standaard EAB-silhouetten (motor,
 * auto, vrachtwagen) zodat de gebruiker tikt op het type voertuig én de exacte
 * impactzone. Coördinaten worden genormaliseerd (0–1) opgeslagen, zodat de
 * marker correct schaalt in het overzicht én gestempeld kan worden op de PDF.
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

  // De afbeelding bevat in volgorde: motor, auto, vrachtwagen. We tonen de
  // gekleurde rand rond het diagram in de partij-kleur zodat het visueel
  // onderscheidbaar blijft welke partij dit is.
  const accent = party === "A" ? "#2799D7" : "#D9A227";

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
          "relative aspect-[1024/797] w-full touch-none select-none overflow-hidden rounded-2xl border bg-white",
          readOnly
            ? "max-w-[220px] shadow-[0_1px_4px_rgba(11,20,26,0.08)]"
            : "max-w-[420px] cursor-crosshair shadow-[0_2px_16px_rgba(39,153,215,0.12)]",
        )}
        style={{ borderColor: `${accent}55` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        role="img"
        aria-label={
          readOnly
            ? "Raakpunt overzicht"
            : "Tik op het voertuig en de zone waar de aanrijding plaatsvond"
        }
      >
        <Image
          src="/impact-vehicles.png"
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="pointer-events-none object-contain p-2"
          priority={!readOnly}
        />
        {value ? (
          <div
            className="pointer-events-none absolute"
            style={{
              left: `${value.x * 100}%`,
              top: `${value.y * 100}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <svg width="36" height="50" viewBox="0 0 36 50" aria-hidden>
              <defs>
                <filter id={`arrowShadow-${party}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodColor="#000" floodOpacity="0.4" />
                </filter>
              </defs>
              <g filter={`url(#arrowShadow-${party})`}>
                <path
                  d="M18 50 L 6 26 L 13 26 L 13 2 L 23 2 L 23 26 L 30 26 Z"
                  fill="#E11D2E"
                  stroke="#7A0A15"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </g>
            </svg>
          </div>
        ) : null}
      </div>
      {!readOnly ? (
        <p className="max-w-md text-center text-[13px] leading-snug text-[#5F7382]">
          {hint ??
            "Kies het voertuigtype (motor, auto of vrachtwagen) en tik of sleep om aan te duiden waar je voertuig werd geraakt. De rode pijl wijst naar de eerste contactzone."}
        </p>
      ) : null}
    </div>
  );
}
