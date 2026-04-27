"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

type SignaturePadProps = {
  value: string | null;
  onChange: (dataUrl: string | null) => void;
  className?: string;
  disabled?: boolean;
  /**
   * Tooling for accident sketch: "pen" draws, others place a stamp.
   * Defaults to "pen" (signature behavior).
   */
  tool?: "select" | "pen" | "eraser" | "car" | "bike" | "road" | "arrow" | "text";
  /** Rotation for the next placed stamp (degrees). */
  stampRotationDeg?: number;
  /**
   * Rotates the currently selected stamp (if any).
   * This is edge-triggered using `rotateSelectedToken`.
   */
  rotateSelectedByDeg?: number;
  rotateSelectedToken?: number;

  /** Optional: observe which element is selected. */
  onSelectedElementChange?: (el: SelectedElementInfo | null) => void;
  /**
   * Apply arbitrary edits (size/rotation/stretch/text size) to the selected element.
   * Edge-triggered using `updateSelectedToken`.
   */
  updateSelected?: Partial<SelectedElementUpdate>;
  updateSelectedToken?: number;

  /** Clears the entire canvas/history (edge-triggered). */
  clearToken?: number;
};

type Point = { x: number; y: number };
type Stroke = Point[];
type StampId = Exclude<
  NonNullable<SignaturePadProps["tool"]>,
  "select" | "pen" | "eraser" | "text"
>;
type Stamp = {
  id: StampId;
  x: number;
  y: number;
  size: number;
  rotationDeg: number;
  /** Non-uniform scaling (used for roads). */
  scaleX: number;
  scaleY: number;
};
type TextBox = {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  rotationDeg: number;
};
type Element =
  | { type: "stroke"; stroke: Stroke }
  | { type: "stamp"; stamp: Stamp }
  | { type: "text"; text: TextBox };

export type SelectedElementInfo =
  | {
      kind: "stamp";
      stampId: StampId;
      size: number;
      rotationDeg: number;
      scaleX: number;
      scaleY: number;
    }
  | { kind: "text"; fontSize: number; rotationDeg: number; text: string }
  | { kind: "stroke" };

export type SelectedElementUpdate =
  | {
      kind: "stamp";
      size?: number;
      rotationDeg?: number;
      scaleX?: number;
      scaleY?: number;
    }
  | { kind: "text"; fontSize?: number; rotationDeg?: number; text?: string };

// prettier, recognizable stamps. Paths are in a 24x24 coordinate space.
const STAMP_PATHS: Partial<Record<Exclude<StampId, "road">, { path: string; fill?: string; stroke?: string }>> =
  {
    car: {
      // compact car silhouette (filled)
      path: "M7.6 10.4 9.2 7.6c.3-.6.9-1 1.6-1h2.4c.7 0 1.3.4 1.6 1l1.6 2.8c.3.5.8.8 1.4.8h.7c.8 0 1.5.7 1.5 1.5v4.6c0 .8-.7 1.5-1.5 1.5h-.7a2.1 2.1 0 0 1-4.1 0H8.3a2.1 2.1 0 0 1-4.1 0H3.5c-.8 0-1.5-.7-1.5-1.5v-4.6c0-.8.7-1.5 1.5-1.5h.7c.6 0 1.1-.3 1.4-.8Zm3.5-2.2-1.3 2.3h6.4l-1.3-2.3c-.1-.2-.3-.3-.5-.3h-2.4c-.2 0-.4.1-.5.3Z",
      fill: "#111",
    },
    bike: {
      // bicycle outline (stroke)
      path: "M7 18a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm10 0a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Zm-7-9h3l1.3 2.6h2.4M10 9l3.2 6.4M6.4 16l3.6-7M14.5 11.6 17 16",
      stroke: "#111",
    },
    arrow: {
      // bold direction arrow (filled)
      path: "M4 12h10.6L11 8.4 12.4 7 20 12l-7.6 5L11 15.6 14.6 12H4v0Z",
      fill: "#111",
    },
  };

/**
 * Canvas-gebaseerd handtekeningveld. Slaat tekening op als PNG dataURL in `value`,
 * en houdt intern de individuele strokes bij zodat de "undo"-knop enkel de
 * laatste lijn verwijdert i.p.v. alles te wissen.
 *
 * Belangrijk voor de resize bug-fix: `value` mag NIET in de deps van de
 * resize-effect staan, anders wordt bij elke stroke de canvas opnieuw
 * gedimensioneerd en wist het canvas (native gedrag bij canvas.width/height).
 */
export function SignaturePad({
  value,
  onChange,
  className,
  disabled = false,
  tool = "pen",
  stampRotationDeg = 0,
  rotateSelectedByDeg = 0,
  rotateSelectedToken = 0,
  onSelectedElementChange,
  updateSelected,
  updateSelectedToken = 0,
  clearToken = 0,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const lastValueRef = useRef<string | null>(null);
  /** Geschiedenis van elementen (strokes + stamps) in CSS-pixels. */
  const elementsRef = useRef<Element[]>([]);
  /** Stroke die op dit moment getekend wordt. */
  const currentStrokeRef = useRef<Stroke>([]);
  const [dimensioned, setDimensioned] = useState(false);
  const [elementCount, setElementCount] = useState(0);
  const [selectedElementKey, setSelectedElementKey] = useState<number | null>(null);
  const draggingElementRef = useRef<{
    elementKey: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const rotateTokenRef = useRef(0);
  const updateTokenRef = useRef(0);
  const clearTokenRef = useRef(0);

  const emitSelection = useCallback(
    (key: number | null) => {
      if (!onSelectedElementChange) return;
      if (!key) {
        onSelectedElementChange(null);
        return;
      }
      const idx = key - 1;
      const el = elementsRef.current[idx];
      if (!el) {
        onSelectedElementChange(null);
        return;
      }
      if (el.type === "stamp") {
        onSelectedElementChange({
          kind: "stamp",
          stampId: el.stamp.id,
          size: el.stamp.size,
          rotationDeg: el.stamp.rotationDeg,
          scaleX: el.stamp.scaleX,
          scaleY: el.stamp.scaleY,
        });
      } else if (el.type === "text") {
        onSelectedElementChange({
          kind: "text",
          fontSize: el.text.fontSize,
          rotationDeg: el.text.rotationDeg,
          text: el.text.text,
        });
      } else {
        onSelectedElementChange({ kind: "stroke" });
      }
    },
    [onSelectedElementChange],
  );

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

  const drawStamp = useCallback((stamp: Stamp) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.translate(stamp.x, stamp.y);
    ctx.rotate((stamp.rotationDeg * Math.PI) / 180);

    if (stamp.id === "road") {
      // A clean "road segment": asphalt pill + borders + dashed center line.
      const w = stamp.size * 1.6 * stamp.scaleX;
      const h = stamp.size * 0.9 * stamp.scaleY;
      const r = Math.min(h * 0.45, 18);

      const x = -w / 2;
      const y = -h / 2;
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();

      ctx.fillStyle = "#1f2937"; // slate-800
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(17,24,39,0.55)";
      ctx.stroke();

      // side lines
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255,255,255,0.78)";
      ctx.beginPath();
      ctx.moveTo(x + 10, y + 8);
      ctx.lineTo(x + w - 10, y + 8);
      ctx.moveTo(x + 10, y + h - 8);
      ctx.lineTo(x + w - 10, y + h - 8);
      ctx.stroke();

      // center dashed line
      ctx.setLineDash([8, 7]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(251,191,36,0.95)"; // amber-400
      ctx.beginPath();
      ctx.moveTo(x + 12, y + h / 2);
      ctx.lineTo(x + w - 12, y + h / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      return;
    }

    const cfg = STAMP_PATHS[stamp.id];
    if (!cfg) {
      ctx.restore();
      return;
    }
    const p = new Path2D(cfg.path);
    const s = stamp.size / 24;
    ctx.scale(s * stamp.scaleX, s * stamp.scaleY);
    if (cfg.fill) {
      ctx.fillStyle = cfg.fill;
      ctx.fill(p);
    }
    if (cfg.stroke) {
      ctx.strokeStyle = cfg.stroke;
      ctx.lineWidth = 2.1;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke(p);
    }
    ctx.restore();
  }, []);

  const drawText = useCallback((tb: TextBox) => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.save();
    ctx.translate(tb.x, tb.y);
    ctx.rotate((tb.rotationDeg * Math.PI) / 180);
    ctx.font = `600 ${tb.fontSize}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#111";
    // background pill for readability
    const m = ctx.measureText(tb.text);
    const w = m.width + tb.fontSize * 0.9;
    const h = tb.fontSize * 1.35;
    const r = Math.min(h / 2, 14);
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(17,24,39,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-w / 2 + r, -h / 2);
    ctx.arcTo(w / 2, -h / 2, w / 2, h / 2, r);
    ctx.arcTo(w / 2, h / 2, -w / 2, h / 2, r);
    ctx.arcTo(-w / 2, h / 2, -w / 2, -h / 2, r);
    ctx.arcTo(-w / 2, -h / 2, w / 2, -h / 2, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#111";
    ctx.fillText(tb.text, -m.width / 2, 0);
    ctx.restore();
  }, []);

  /** Wist canvas en hertekent alle bewaarde elementen. */
  const repaintElements = useCallback(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    for (const el of elementsRef.current) {
      if (el.type === "stroke") drawStroke(el.stroke);
      else if (el.type === "stamp") drawStamp(el.stamp);
      else drawText(el.text);
    }
  }, [drawStroke, drawStamp, drawText]);

  useEffect(() => {
    dimension();
    setDimensioned(true);
    const onResize = () => {
      dimension();
      // Bij een resize hertekenen we elementen uit de history (scherpste resultaat).
      // Geen history (bv. herladen vanuit `value`) → val terug op de PNG-snapshot.
      if (elementsRef.current.length > 0) {
        repaintElements();
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
    // Externe wijziging (bv. parent zet null of laadt een PNG): element-history
    // matcht niet meer met de pixels op canvas, dus wis ze.
    elementsRef.current = [];
    setElementCount(0);
    setSelectedElementKey(null);
    emitSelection(null);
    drawImageOnCanvas(value);
  }, [value, dimensioned, drawImageOnCanvas, emitSelection]);

  const getPos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const c = canvasRef.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const toKey = (idx: number) => idx + 1;
  const fromKey = (k: number) => k - 1;

  const findElementAtPoint = useCallback(
    (p: Point): number | null => {
      // Search top-most first (later elements are on top).
      for (let i = elementsRef.current.length - 1; i >= 0; i--) {
        const el = elementsRef.current[i];
        if (el.type === "stamp") {
          const s = el.stamp;
          const r = Math.max(18, s.size * 0.65);
          const dx = p.x - s.x;
          const dy = p.y - s.y;
          if (dx * dx + dy * dy <= r * r) return toKey(i);
        } else if (el.type === "text") {
          const tb = el.text;
          const r = Math.max(22, tb.fontSize * 1.4);
          const dx = p.x - tb.x;
          const dy = p.y - tb.y;
          if (dx * dx + dy * dy <= r * r) return toKey(i);
        }
      }
      return null;
    },
    [],
  );

  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const p = getPos(e);

    if (tool !== "pen") {
      // First: if user taps an existing element, select and allow dragging.
      const hit = findElementAtPoint(p);
      if (hit !== null) {
        const idx = fromKey(hit);
        const el = elementsRef.current[idx];
        if (el?.type === "stamp") {
          setSelectedElementKey(hit);
          emitSelection(hit);
          draggingElementRef.current = {
            elementKey: hit,
            offsetX: p.x - el.stamp.x,
            offsetY: p.y - el.stamp.y,
          };
        } else if (el?.type === "text") {
          setSelectedElementKey(hit);
          emitSelection(hit);
          draggingElementRef.current = {
            elementKey: hit,
            offsetX: p.x - el.text.x,
            offsetY: p.y - el.text.y,
          };
        }
        canvasRef.current?.setPointerCapture(e.pointerId);
        return;
      }

      if (tool === "select") return;

      if (tool === "text") {
        const raw = window.prompt("Text");
        const text = (raw ?? "").trim();
        if (!text) return;
        const c = canvasRef.current;
        const fontSize = Math.min(22, Math.max(14, Math.round((c?.clientWidth ?? 400) * 0.02)));
        const tb: TextBox = {
          text,
          x: p.x,
          y: p.y,
          fontSize,
          rotationDeg: stampRotationDeg,
        };
        elementsRef.current = [...elementsRef.current, { type: "text", text: tb }];
        setElementCount(elementsRef.current.length);
        const key = toKey(elementsRef.current.length - 1);
        setSelectedElementKey(key);
        emitSelection(key);
        repaintElements();
        const dataUrl = canvasRef.current?.toDataURL("image/png") ?? null;
        lastValueRef.current = dataUrl;
        onChange(dataUrl);
        return;
      }

      const stampId = tool as StampId;
      const c = canvasRef.current;
      const size = Math.min(64, Math.max(32, Math.round((c?.clientWidth ?? 400) * 0.07)));
      const stamp: Stamp = {
        id: stampId,
        x: p.x,
        y: p.y,
        size,
        rotationDeg: stampRotationDeg,
        scaleX: 1,
        scaleY: 1,
      };
      elementsRef.current = [...elementsRef.current, { type: "stamp", stamp }];
      setElementCount(elementsRef.current.length);
      const key = toKey(elementsRef.current.length - 1);
      setSelectedElementKey(key);
      emitSelection(key);
      repaintElements();
      const dataUrl = canvasRef.current?.toDataURL("image/png") ?? null;
      lastValueRef.current = dataUrl;
      onChange(dataUrl);
      return;
    }

    canvasRef.current?.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    currentStrokeRef.current = [p];
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    if (draggingElementRef.current) {
      e.preventDefault();
      const drag = draggingElementRef.current;
      const idx = fromKey(drag.elementKey);
      const el = elementsRef.current[idx];
      if (!el || el.type === "stroke") return;
      const p = getPos(e);
      const next = [...elementsRef.current];
      if (el.type === "stamp") {
        const nextStamp: Stamp = {
          ...el.stamp,
          x: p.x - drag.offsetX,
          y: p.y - drag.offsetY,
        };
        next[idx] = { type: "stamp", stamp: nextStamp };
      } else {
        const nextText: TextBox = {
          ...el.text,
          x: p.x - drag.offsetX,
          y: p.y - drag.offsetY,
        };
        next[idx] = { type: "text", text: nextText };
      }
      elementsRef.current = next;
      repaintElements();
      emitSelection(drag.elementKey);
      return;
    }
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
    if (disabled) return;
    if (draggingElementRef.current) {
      draggingElementRef.current = null;
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      const c = canvasRef.current;
      const dataUrl = c?.toDataURL("image/png") ?? null;
      lastValueRef.current = dataUrl;
      onChange(dataUrl);
      return;
    }
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
      elementsRef.current = [...elementsRef.current, { type: "stroke", stroke }];
      setElementCount(elementsRef.current.length);
    }
    const c = canvasRef.current;
    if (c) {
      const dataUrl = c.toDataURL("image/png");
      lastValueRef.current = dataUrl;
      onChange(dataUrl);
    }
  };

  useEffect(() => {
    if (clearTokenRef.current === clearToken) return;
    clearTokenRef.current = clearToken;
    elementsRef.current = [];
    setElementCount(0);
    setSelectedElementKey(null);
    emitSelection(null);
    const c = canvasRef.current;
    if (c) {
      const ctx = c.getContext("2d");
      ctx?.clearRect(0, 0, c.clientWidth, c.clientHeight);
    }
    lastValueRef.current = null;
    onChange(null);
  }, [clearToken, emitSelection, onChange]);

  useEffect(() => {
    // Edge-trigger rotate selected stamp.
    if (rotateTokenRef.current === rotateSelectedToken) return;
    rotateTokenRef.current = rotateSelectedToken;
    if (!selectedElementKey) return;
    const idx = fromKey(selectedElementKey);
    const el = elementsRef.current[idx];
    const next = [...elementsRef.current];
    if (!el || el.type === "stroke") return;
    if (el.type === "stamp") {
      const nextStamp: Stamp = {
        ...el.stamp,
        rotationDeg: ((el.stamp.rotationDeg + rotateSelectedByDeg) % 360 + 360) % 360,
      };
      next[idx] = { type: "stamp", stamp: nextStamp };
    } else {
      const nextText: TextBox = {
        ...el.text,
        rotationDeg: ((el.text.rotationDeg + rotateSelectedByDeg) % 360 + 360) % 360,
      };
      next[idx] = { type: "text", text: nextText };
    }
    elementsRef.current = next;
    repaintElements();
    const c = canvasRef.current;
    const dataUrl = c?.toDataURL("image/png") ?? null;
    lastValueRef.current = dataUrl;
    onChange(dataUrl);
  }, [
    rotateSelectedByDeg,
    rotateSelectedToken,
    selectedElementKey,
    onChange,
    repaintElements,
  ]);

  useEffect(() => {
    if (updateTokenRef.current === updateSelectedToken) return;
    updateTokenRef.current = updateSelectedToken;
    if (!updateSelected) return;
    if (!selectedElementKey) return;
    const idx = selectedElementKey - 1;
    const el = elementsRef.current[idx];
    if (!el || el.type === "stroke") return;
    const next = [...elementsRef.current];
    if (el.type === "stamp" && updateSelected.kind === "stamp") {
      const s = el.stamp;
      next[idx] = {
        type: "stamp",
        stamp: {
          ...s,
          size: updateSelected.size ?? s.size,
          rotationDeg: updateSelected.rotationDeg ?? s.rotationDeg,
          scaleX: updateSelected.scaleX ?? s.scaleX,
          scaleY: updateSelected.scaleY ?? s.scaleY,
        },
      };
    } else if (el.type === "text" && updateSelected.kind === "text") {
      const tbox = el.text;
      next[idx] = {
        type: "text",
        text: {
          ...tbox,
          fontSize: updateSelected.fontSize ?? tbox.fontSize,
          rotationDeg: updateSelected.rotationDeg ?? tbox.rotationDeg,
          text: updateSelected.text ?? tbox.text,
        },
      };
    } else {
      return;
    }
    elementsRef.current = next;
    repaintElements();
    emitSelection(selectedElementKey);
    const c = canvasRef.current;
    const dataUrl = c?.toDataURL("image/png") ?? null;
    lastValueRef.current = dataUrl;
    onChange(dataUrl);
  }, [
    emitSelection,
    onChange,
    repaintElements,
    selectedElementKey,
    updateSelected,
    updateSelectedToken,
  ]);

  /**
   * Verwijdert de laatste getrokken lijn uit de history en hertekent.
   * Fallback: als er geen stroke-history is (bv. handtekening werd herladen
   * uit een opgeslagen PNG), wissen we het volledige canvas.
   */
  const undoLast = () => {
    if (disabled) return;
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;

    if (elementsRef.current.length > 0) {
      elementsRef.current = elementsRef.current.slice(0, -1);
      setElementCount(elementsRef.current.length);
      repaintElements();
      if (elementsRef.current.length === 0) {
        lastValueRef.current = null;
        onChange(null);
        setSelectedElementKey(null);
        emitSelection(null);
      } else {
        const dataUrl = c.toDataURL("image/png");
        lastValueRef.current = dataUrl;
        onChange(dataUrl);
        if (selectedElementKey && selectedElementKey > elementsRef.current.length) {
          setSelectedElementKey(null);
          emitSelection(null);
        }
      }
      return;
    }

    // Geen history beschikbaar → wis volledig.
    ctx.clearRect(0, 0, c.clientWidth, c.clientHeight);
    lastValueRef.current = null;
    onChange(null);
  };

  const hasContent = elementCount > 0 || Boolean(value);

  return (
    <div
      className={cn(
        "relative flex min-h-[220px] flex-1 flex-col rounded-2xl border border-primary/20 bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]",
        className,
      )}
    >
      <canvas
        ref={canvasRef}
        className={cn(
          "min-h-[220px] w-full flex-1 touch-none rounded-2xl",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-crosshair",
        )}
        onPointerDown={(e) => {
          if (tool === "eraser") {
            if (disabled) return;
            e.preventDefault();
            canvasRef.current?.setPointerCapture(e.pointerId);
            drawingRef.current = true;
            const ctx = canvasRef.current?.getContext("2d");
            if (!ctx) return;
            const p = getPos(e);
            currentStrokeRef.current = [p];
            ctx.save();
            ctx.globalCompositeOperation = "destination-out";
            ctx.lineWidth = 18;
            ctx.lineCap = "round";
            ctx.lineJoin = "round";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            return;
          }
          start(e);
        }}
        onPointerMove={(e) => {
          if (tool === "eraser") {
            if (disabled) return;
            if (!drawingRef.current) return;
            e.preventDefault();
            const ctx = canvasRef.current?.getContext("2d");
            if (!ctx) return;
            const p = getPos(e);
            currentStrokeRef.current.push(p);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            return;
          }
          move(e);
        }}
        onPointerUp={(e) => {
          if (tool === "eraser") {
            if (disabled) return;
            if (!drawingRef.current) return;
            drawingRef.current = false;
            try {
              canvasRef.current?.releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
            const ctx = canvasRef.current?.getContext("2d");
            ctx?.restore();
            // We don't have element history for erasing; snapshot to PNG.
            const c = canvasRef.current;
            const dataUrl = c?.toDataURL("image/png") ?? null;
            lastValueRef.current = dataUrl;
            onChange(dataUrl);
            return;
          }
          end(e);
        }}
        onPointerLeave={(e) => {
          if (tool === "eraser") {
            // Treat as pointer up to avoid stuck capture.
            (e.currentTarget as HTMLCanvasElement).dispatchEvent(
              new PointerEvent("pointerup", e.nativeEvent),
            );
            return;
          }
          end(e);
        }}
      />
      <button
        type="button"
        onClick={undoLast}
        disabled={!hasContent || disabled}
        className="app-surface absolute bottom-3 left-3 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full p-2 text-foreground shadow-md ring-1 ring-border/70 transition-opacity hover:bg-card disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Laatste lijn ongedaan maken"
        title="Laatste lijn ongedaan maken"
      >
        <RotateCcw className="size-5" strokeWidth={1.75} />
      </button>
    </div>
  );
}
