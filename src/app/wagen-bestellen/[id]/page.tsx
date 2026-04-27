import { Suspense } from "react";
import { LoadingState } from "@/components/loading-state";
import { WagenBestellenWizardClient } from "./wizard-client";

export default async function WagenBestellenWizardPage() {
  return (
    <Suspense fallback={<LoadingState subtitle="Even laden…" />}>
      <WagenBestellenWizardClient />
    </Suspense>
  );
}

