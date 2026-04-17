"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type SignaturePadProps = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
};

/**
 * Canvas-gebaseerd handtekeningveld. Slaat tekening op als PNG dataURL in `value`.
 *
 * Belangrijk voor de bug-fix: we mogen `value` NIET in de deps van de
 * resize-effect zetten, anders wordt bij elke stroke de canvas opnieuw
 * gedimensioneerd en wist de canvas (native gedrag bij canvas.width/height).
 */
export function SignaturePad({ value, onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastValueRef = useRef<string | null>(null);
  const [dimensioned, setDimensioned] = useState(false);

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

  useEffect(() => {
    dimension();
    setDimensioned(true);
    const onResize = () => {
      dimension();
      drawImageOnCanvas(lastValueRef.current);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dimensioned) return;
    if (lastValueRef.current === value) return;
    lastValueRef.current = value;
    drawImageOnCanvas(value);
  }, [value, dimensioned, drawImageOnCanvas]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
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
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
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
    const c = canvasRef.current;
    if (c) {
      const dataUrl = c.toDataURL("image/png");
      lastValueRef.current = dataUrl;
      onChange(dataUrl);
    }
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    lastValueRef.current = null;
    onChange(null);
  };

  return (
    <div
      className={cn(
        "relative flex min-h-[220px] flex-1 flex-col rounded-2xl border border-[#2799D7]/18 bg-[#FAFCFE] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
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
        onClick={clear}
        className="absolute bottom-3 left-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 p-2 text-[#163247] shadow-md hover:bg-white"
        aria-label="Wissen"
      >
        <RotateCcw className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
