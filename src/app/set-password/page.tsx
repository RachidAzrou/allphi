"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const SetPasswordForm = dynamic(() => import("./set-password-form"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-[#2799D7] animate-spin" />
    </div>
  ),
});

export default function SetPasswordPage() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#2799D7] animate-spin" />
            </div>
          }
        >
          <SetPasswordForm />
        </Suspense>
      </div>

      <div className="text-center py-4">
        <p className="text-xs text-[#5F7382]/60">Fleet Companion</p>
      </div>
    </div>
  );
}
