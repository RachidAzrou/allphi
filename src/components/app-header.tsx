"use client";

import { CircleUser, Lock, LogOut, Menu } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface AppHeaderProps {
  userEmail?: string;
  /** Volledige naam (voornaam + naam); anders wordt userEmail getoond. */
  userDisplayName?: string;
}

export function AppHeader({ userEmail, userDisplayName }: AppHeaderProps) {
  const router = useRouter();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const trimmedName = userDisplayName?.trim();
  const label = trimmedName || userEmail || "";
  const showEmailUnderName =
    Boolean(userEmail) && Boolean(trimmedName) && trimmedName !== userEmail;

  return (
    <header className="sticky top-0 z-50 safe-top border-b border-black/[0.08] bg-white/85 backdrop-blur-xl supports-[backdrop-filter]:bg-white/72">
      <div className="flex h-[52px] min-h-[52px] w-full items-center px-safe">
        {/* Balanceert het hamburgermenu rechts (zelfde breedte links en rechts) */}
        <div className="h-11 w-11 shrink-0" aria-hidden="true" />

        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2799D7] shadow-sm">
            <span className="text-sm font-heading font-bold text-white">φ</span>
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] font-semibold leading-tight tracking-[-0.01em] text-[#000000]">
              Fleet Companion
            </h1>
          </div>
        </div>

        <div className="flex w-11 shrink-0 justify-center">
          <Sheet>
            <SheetTrigger
              type="button"
              className="inline-flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-full text-[#3C3C43] transition-colors hover:bg-black/[0.05] active:bg-black/[0.08]"
              aria-label="Menu openen"
            >
              <Menu className="h-[22px] w-[22px]" strokeWidth={1.75} />
            </SheetTrigger>
            <SheetContent
              side="right"
              className="gap-0 border-l border-[#2799D7]/20 bg-[#F7F9FC] p-0 sm:max-w-sm"
            >
              <div className="border-b border-[#2799D7]/12 bg-white px-4 py-5 pr-11">
                <SheetTitle className="mb-4 font-heading text-sm font-semibold text-[#2799D7]">
                  Account
                </SheetTitle>
                <div className="flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F4FB] text-[#2799D7]"
                    aria-hidden={true}
                  >
                    <CircleUser className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium leading-snug text-[#163247]">
                      {label || "—"}
                    </p>
                    {showEmailUnderName ? (
                      <p className="mt-1 break-all text-[13px] leading-snug text-[#5F7382]">
                        {userEmail}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#2799D7]/10 bg-[#F7F9FC] p-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-10 w-full justify-start gap-3 rounded-lg px-3 text-[14px] font-medium text-[#163247] hover:bg-[#E8F4FB]"
                  onClick={() => router.push("/set-password?wijzigen=1")}
                >
                  <Lock className="size-4 shrink-0 text-[#2799D7]" strokeWidth={1.75} />
                  Wachtwoord wijzigen
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-10 w-full gap-2 rounded-lg border-[#2799D7]/30 bg-white text-[14px] font-medium text-[#163247] hover:border-red-200 hover:bg-red-50 hover:text-red-950 hover:[&_svg]:text-red-600"
                  onClick={handleLogout}
                >
                  <LogOut
                    className="size-4 text-[#2799D7] transition-colors"
                    strokeWidth={1.75}
                  />
                  Uitloggen
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
