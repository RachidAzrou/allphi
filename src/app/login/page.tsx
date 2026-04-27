"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { AllphiLoader } from "@/components/allphi-loader";

const LoginForm = dynamic(() => import("./login-form"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center">
      <AllphiLoader size={24} />
    </div>
  ),
});

export default function LoginPage() {
  return (
    <div className="app-canvas safe-top flex min-h-dvh flex-col">
      <div className="flex w-full flex-1 flex-col items-center justify-center px-safe py-12">
        <Suspense
          fallback={
            <div className="flex items-center justify-center">
              <AllphiLoader size={24} />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
      </div>

      <div className="safe-bottom py-4 text-center">
        <p className="text-xs text-muted-foreground/70">Fleet Companion</p>
      </div>
    </div>
  );
}
