"use client";

import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({
  message = "Er is iets fout gegaan. Probeer het opnieuw.",
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertCircle className="w-6 h-6 text-[#DC2626]" />
      </div>
      <p className="text-sm text-[#5F7382] max-w-xs">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg
                     bg-[#E8F4FB] text-[#2799D7] text-sm font-medium
                     hover:bg-[#d4ecf7] active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Opnieuw proberen
        </button>
      )}
    </div>
  );
}
