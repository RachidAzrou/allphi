"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type SignaturePadProps = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
};

export function SignaturePad({ value, onChange, className }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasStroke, setHasStroke] = useState(false);

  const resizeCanvas = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const parent = c.parentElement;
    if (!parent) return;
    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
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
    if (value && !hasStroke) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
      };
      img.src = value;
    }
  }, [value, hasStroke]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, [resizeCanvas]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    setHasStroke(true);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    drawing.current = false;
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    const c = canvasRef.current;
    if (c) {
      onChange(c.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHasStroke(false);
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
