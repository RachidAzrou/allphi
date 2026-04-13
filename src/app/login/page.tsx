"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const LoginForm = dynamic(() => import("./login-form"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-[#2799D7] animate-spin" />
    </div>
  ),
});

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#F7F9FC] safe-top">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-[#2799D7] animate-spin" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      <div className="safe-bottom py-4 text-center">
        <p className="text-xs text-[#5F7382]/60">Fleet Companion</p>
      </div>
    </div>
  );
}
