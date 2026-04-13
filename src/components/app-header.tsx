"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface AppHeaderProps {
  userEmail?: string;
}

export function AppHeader({ userEmail }: AppHeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 safe-top border-b border-black/[0.08] bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/72">
      <div className="flex h-[52px] min-h-[52px] w-full items-center px-safe sm:justify-between">
        {/* Balanceert de uitlogknop op mobiel zodat titel optisch gecentreerd is */}
        <div className="w-11 shrink-0 sm:hidden" aria-hidden="true" />

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:flex-initial sm:justify-start">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2799D7] shadow-sm">
            <span className="text-sm font-heading font-bold text-white">φ</span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[#000000]">
              Fleet Companion
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {userEmail && (
            <span className="text-[13px] text-[#8E8E93] hidden sm:block max-w-[160px] truncate px-1">
              {userEmail}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-full text-[#8E8E93] touch-manipulation hover:bg-black/[0.05] active:bg-black/[0.08] transition-colors"
            aria-label="Uitloggen"
          >
            <LogOut className="w-[22px] h-[22px]" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </header>
  );
}
