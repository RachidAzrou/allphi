import { Suspense } from "react";
import { LoadingState } from "@/components/loading-state";
import { WagenBestellenIndexClient } from "./wagen-bestellen-client";

export default function WagenBestellenIndexPage() {
  return (
    <Suspense fallback={<LoadingState subtitle="Even laden…" />}>
      <WagenBestellenIndexClient />
    </Suspense>
  );
}

