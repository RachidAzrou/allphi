"use client";

import { motion, useReducedMotion } from "framer-motion";
import Image from "next/image";
import { useEffect, useState } from "react";

type LoadingStateContext = "chat" | "documenten" | "ongeval";

interface LoadingStateProps {
  /** @deprecated Use `subtitle` instead. */
  message?: string;
  subtitle?: string;
  context?: LoadingStateContext;
}

export function LoadingState({
  message,
  subtitle,
  context = "chat",
}: LoadingStateProps) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const canAnimate = mounted && !reduceMotion;
  const resolvedSubtitle =
    subtitle ??
    message ??
    (context === "documenten"
      ? "We halen je documenten op…"
      : context === "ongeval"
        ? "We halen je dossiergegevens op…"
        : "We halen je laatste berichten op…");

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[60vh] w-full max-w-full flex-col items-center justify-center px-safe py-0"
    >
      <div className="flex w-full max-w-[24rem] flex-col items-center gap-6">
        <div className="relative flex min-h-[11rem] w-full items-center justify-center overflow-visible">
          <div className="pointer-events-none absolute left-1/2 top-1/2 h-48 w-[min(100%,26rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-primary/10 blur-3xl" />
          <motion.div
            className="relative flex items-center justify-center"
            initial={{ scale: 1 }}
            animate={canAnimate ? { scale: [0.72, 1.08, 0.72] } : undefined}
            transition={
              canAnimate
                ? { duration: 1.35, ease: "easeInOut", repeat: Infinity }
                : undefined
            }
            style={{ willChange: canAnimate ? ("transform" as const) : undefined }}
          >
            <Image
              src="/icons/allphi-logo-transparent.png"
              alt=""
              width={220}
              height={220}
              className="h-28 w-28 object-contain sm:h-36 sm:w-36"
              priority
            />
          </motion.div>
        </div>

        <p className="w-full text-center text-base font-medium leading-snug text-foreground/90 sm:text-lg">
          {resolvedSubtitle}
        </p>
      </div>
    </div>
  );
}
