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
      <div className="app-card flex h-12 w-12 items-center justify-center rounded-full mb-3">
        <MessageCircle className="h-6 w-6 text-primary" />
      </div>
      <h3 className="text-sm font-heading font-semibold text-foreground">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>
    </div>
  );
}
