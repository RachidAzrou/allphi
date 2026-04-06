"use client";

import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({
  message = "Even geduld...",
}: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <Loader2 className="w-8 h-8 text-[#2799D7] animate-spin" />
      <p className="mt-3 text-sm text-[#5F7382]">{message}</p>
    </div>
  );
}
