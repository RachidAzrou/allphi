"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FaCarRear } from "react-icons/fa6";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({
  message = "We halen je laatste berichten op…",
}: LoadingStateProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex w-full max-w-full flex-col items-center justify-center py-20 px-safe sm:py-24"
    >
      <div className="flex w-full max-w-[24rem] flex-col items-center gap-6">
        <div className="relative flex min-h-[11rem] w-full items-center justify-center overflow-visible">
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-32 w-[min(100%,20rem)] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-[100%] bg-[#2799D7]/[0.1] blur-3xl"
            aria-hidden
          />

          <div className="relative flex w-full items-center justify-center">
            {reduceMotion ? (
              <div className="flex h-36 w-36 shrink-0 items-center justify-center sm:h-40 sm:w-40">
                <FaCarRear
                  className="h-28 w-28 text-[#2799D7] drop-shadow-[0_8px_24px_rgba(11,20,26,0.2)] sm:h-32 sm:w-32"
                  aria-hidden
                />
              </div>
            ) : (
              <motion.div
                className="flex h-36 w-36 shrink-0 items-center justify-center will-change-transform sm:h-40 sm:w-40"
                style={{ transformOrigin: "50% 100%" }}
                initial={{ scale: 0.22, y: -26, opacity: 0.5 }}
                animate={{
                  /* Ver weg → naar ons: klein + hoger (horizon) → groot + vooraan */
                  scale: [0.22, 1, 0.22],
                  y: [-26, 0, -26],
                  opacity: [0.52, 1, 0.52],
                }}
                transition={{
                  duration: 5.25,
                  repeat: Infinity,
                  ease: "easeInOut",
                  times: [0, 0.58, 1],
                }}
              >
                <FaCarRear
                  className="pointer-events-none block h-28 w-28 shrink-0 text-[#2799D7] drop-shadow-[0_10px_28px_rgba(11,20,26,0.25)] sm:h-32 sm:w-32"
                  aria-hidden
                />
              </motion.div>
            )}
          </div>
        </div>

        <p className="w-full text-center text-base font-medium leading-snug text-[#163247]/90 sm:text-lg">
          {message}
        </p>
      </div>
    </div>
  );
}
