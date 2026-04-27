import { requireFleetManagerAccess } from "@/lib/auth/require-fleet-manager";
import { FleetManagerDocumentsClient } from "./documents-client";

export default async function FleetManagerDocumentenPage() {
  const auth = await requireFleetManagerAccess();
  if (!auth.ok) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">{auth.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{auth.message}</p>
      </div>
    );
  }

  return (
    <FleetManagerDocumentsClient userEmail={auth.userEmail} userDisplayName={auth.userDisplayName} />
  );
}

