import { Suspense } from "react";
import { DocumentPreviewClient } from "./preview-client";

export default function DocumentPreviewPage() {
  return (
    <Suspense fallback={null}>
      <DocumentPreviewClient />
    </Suspense>
  );
}

