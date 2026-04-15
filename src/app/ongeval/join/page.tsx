import { Suspense } from "react";
import { JoinClient } from "./join-client";

export default function OngevalJoinPage() {
  return (
    <Suspense>
      <JoinClient />
    </Suspense>
  );
}

