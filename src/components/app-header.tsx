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
    <header className="sticky top-0 z-50 bg-[#2799D7] text-white safe-top">
      <div className="flex items-center justify-between px-4 h-14">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-sm font-heading font-bold">φ</span>
          </div>
          <div>
            <h1 className="text-[15px] font-heading font-semibold leading-tight tracking-tight">
              Fleet Companion
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userEmail && (
            <span className="text-xs text-white/70 hidden sm:block max-w-[180px] truncate">
              {userEmail}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Uitloggen"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
