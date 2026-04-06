"use client";

import { MessageCircle } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export function EmptyState({
  title = "Nog geen berichten",
  description = "Stel een vraag of kies een snelle actie hierboven.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="w-12 h-12 rounded-full bg-[#E8F4FB] flex items-center justify-center mb-3">
        <MessageCircle className="w-6 h-6 text-[#2799D7]" />
      </div>
      <h3 className="text-sm font-heading font-semibold text-[#163247]">
        {title}
      </h3>
      <p className="text-sm text-[#5F7382] mt-1 max-w-xs">{description}</p>
    </div>
  );
}
