"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type SignaturePadProps = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
};

type Point = { x: number; y: number };
type Stroke = Point[];

/**
 * Canvas-gebaseerd handtekeningveld. Slaat tekening op als PNG dataURL in `value`,
 * en houdt intern de individuele strokes bij zodat de "undo"-knop enkel de
 * laatste lijn verwijdert i.p.v. alles te wissen.
 *
 * Belangrijk voor de resize bug-fix: `value` mag NIET in de deps van de
 * resize-effect staan, anders wordt bij elke stroke de canvas opnieuw
 * gedimensioneerd en wist het canvas (native gedrag bij canvas.width/height).
 */
export function SignaturePad({ value, onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastValueRef = useRef<string | null>(null);
  /** Geschiedenis van afgewerkte strokes (puntenreeksen in CSS-pixels). */
  const strokesRef = useRef<Stroke[]>([]);
  /** Stroke die op dit moment getekend wordt. */
  const currentStrokeRef = useRef<Stroke>([]);
  const [dimensioned, setDimensioned] = useState(false);
  const [strokeCount, setStrokeCount] = useState(0);

  const drawImageOnCanvas = useCallback((dataUrl: string | null) => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const cssW = c.clientWidth;
    const cssH = c.clientHeight;
    ctx.clearRect(0, 0, cssW, cssH);
    if (!dataUrl) return;
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, cssW, cssH);
    };
    img.src = dataUrl;
  }, []);

  const dimension = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    if (!parent) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    if (w === 0 || h === 0) return;
    c.width = Math.floor(w * dpr);
    c.height = Math.floor(h * dpr);
    c.style.width = `${w}px`;
    c.style.height = `${h}px`;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111";
    ctx.lineWidth = 2.25;
  }, []);

  /** Tekent één stroke (≥ 1 punt) op het canvas. */
  const drawStroke = useCallback((stroke: Stroke) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || stroke.length === 0) return;
    ctx.beginPath();
    ctx.moveTo(stroke[0].x, stroke[0].y);
    if (stroke.length === 1) {
      // Tap zonder bewegen → klein puntje zodat de gebruiker visueel feedback krijgt.
      ctx.lineTo(stroke[0].x + 0.01, stroke[0].y + 0.01);
    } else {
      for (let i = 1; i < stroke.length; i++) {
        ctx.lineTo(stroke[i].x, stroke[i].y);
      }
    }
    ctx.stroke();
  }, []);

  /** Wist canvas en hertekent alle bewaarde strokes. */
  const repaintStrokes = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    for (const s of strokesRef.current) drawStroke(s);
  }, [drawStroke]);

  useEffect(() => {
    dimension();
    setDimensioned(true);
    const onResize = () => {
      dimension();
      // Bij een resize hertekenen we strokes uit de history (scherpste resultaat).
      // Geen history (bv. herladen vanuit `value`) → val terug op de PNG-snapshot.
      if (strokesRef.current.length > 0) {
        repaintStrokes();
      } else {
        drawImageOnCanvas(lastValueRef.current);
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dimensioned) return;
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;
    // Externe wijziging (bv. parent zet null of laadt een PNG): stroke-history
    // matcht niet meer met de pixels op canvas, dus wis ze.
    strokesRef.current = [];
    setStrokeCount(0);
    drawImageOnCanvas(value);
  }, [value, dimensioned, drawImageOnCanvas]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    currentStrokeRef.current = [p];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);
    currentStrokeRef.current.push(p);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const stroke = currentStrokeRef.current;
    currentStrokeRef.current = [];
    if (stroke.length > 0) {
      strokesRef.current = [...strokesRef.current, stroke];
      setStrokeCount(strokesRef.current.length);
    }
    const c = canvasRef.current;
    if (c) {
      const dataUrl = c.toDataURL("image/png");
      lastValueRef.current = dataUrl;
      onChange(dataUrl);
    }
  };

  /**
   * Verwijdert de laatste getrokken lijn uit de history en hertekent.
   * Fallback: als er geen stroke-history is (bv. handtekening werd herladen
   * uit een opgeslagen PNG), wissen we het volledige canvas.
   */
  const undoLast = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    if (strokesRef.current.length > 0) {
      strokesRef.current = strokesRef.current.slice(0, -1);
      setStrokeCount(strokesRef.current.length);
      repaintStrokes();
      if (strokesRef.current.length === 0) {
        lastValueRef.current = null;
        onChange(null);
      } else {
        const dataUrl = c.toDataURL("image/png");
        lastValueRef.current = dataUrl;
        onChange(dataUrl);
      }
      return;
    }

    // Geen history beschikbaar → wis volledig.
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    lastValueRef.current = null;
    onChange(null);
  };

  const hasContent = strokeCount > 0 || Boolean(value);

  return (
    <div
      className={cn(
        "relative flex min-h-[220px] flex-1 flex-col rounded-2xl border border-primary/20 bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className="min-h-[220px] w-full flex-1 touch-none cursor-crosshair rounded-2xl"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
      />
      <button
        type="button"
        onClick={undoLast}
        disabled={!hasContent}
        className="app-surface absolute bottom-3 left-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-foreground shadow-md ring-1 ring-border/70 transition-opacity hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Laatste lijn ongedaan maken"
        title="Laatste lijn ongedaan maken"
      >
        <RotateCcw className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
