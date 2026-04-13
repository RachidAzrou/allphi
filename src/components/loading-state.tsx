"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Car } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

const CAR_WRAPPER_PX = 56;
const TRACK_EDGE_PAD_PX = 12;

/** Afstand voor translateX: baanbreedte minus padding en icoon. */
function useCarTravelPx(trackRef: RefObject<HTMLDivElement | null>) {
  const [travelPx, setTravelPx] = useState(0);

  useLayoutEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const PAD = TRACK_EDGE_PAD_PX;
    const CAR = CAR_WRAPPER_PX;

    const update = () => {
      const w = el.clientWidth;
      setTravelPx(Math.max(0, w - CAR - PAD * 2));
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return travelPx;
}

export function LoadingState({
  message = "We halen je laatste berichten op…",
}: LoadingStateProps) {
  const reduceMotion = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const travelPx = useCarTravelPx(trackRef);

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center py-20 px-6 sm:py-24"
    >
      <div
        ref={trackRef}
        className="relative mb-8 h-32 w-full max-w-[min(100%,22rem)] shrink-0 px-3 sm:max-w-[min(100%,24rem)]"
      >
        <div
          className="pointer-events-none absolute inset-x-0 top-1/2 h-24 -translate-y-1/2 rounded-[100%] bg-[#2799D7]/[0.08] blur-3xl"
          aria-hidden
        />

        {/* Baan: vlak + randen */}
        <div
          className="absolute bottom-5 left-2 right-2 h-4 rounded-full bg-gradient-to-b from-[#dce8f4] to-[#c9d9ea] shadow-[inset_0_1px_3px_rgba(255,255,255,0.7),0_2px_4px_rgba(11,20,26,0.09)] ring-1 ring-[#163247]/10"
          aria-hidden
        />
        {/* Middenstreep (gestippeld) — midden van h-4 baan boven bottom-5 */}
        <div
          className="absolute bottom-[calc(1.25rem+0.5rem)] left-8 right-8 h-px overflow-hidden rounded-full opacity-75"
          aria-hidden
        >
          <div
            className="h-full w-[200%] bg-[length:14px_1px] bg-repeat-x opacity-90"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, #2799D7 0px, #2799D7 7px, transparent 7px, transparent 14px)",
            }}
          />
        </div>

        {reduceMotion ? (
          <div className="absolute bottom-3 left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center">
            <Car
              className="h-10 w-10 text-[#2799D7] drop-shadow-[0_2px_4px_rgba(11,20,26,0.12)]"
              strokeWidth={1.85}
              aria-hidden
            />
          </div>
        ) : (
          <motion.div
            className="absolute bottom-3 left-3 flex h-14 w-14 items-center justify-center will-change-transform"
            initial={false}
            animate={travelPx > 0 ? { x: [0, travelPx] } : { x: 0 }}
            transition={{
              duration: 2.6,
              repeat: Infinity,
              repeatDelay: 0.15,
              ease: "linear",
              repeatType: "loop",
            }}
          >
            <Car
              className="h-10 w-10 text-[#2799D7] drop-shadow-[0_2px_4px_rgba(11,20,26,0.14)]"
              strokeWidth={1.85}
              aria-hidden
            />
          </motion.div>
        )}
      </div>
      <p className="max-w-[24rem] text-center text-base font-medium leading-snug text-[#163247]/90 sm:text-lg">
        {message}
      </p>
    </div>
  );
}
