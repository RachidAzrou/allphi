import { requireFleetManagerAccess } from "@/lib/auth/require-fleet-manager";
import { FleetManagerEscalationDetailClient } from "./detail-client";

export default async function FleetManagerEscalationDetailPage() {
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
    <FleetManagerEscalationDetailClient
      userEmail={auth.userEmail}
      userDisplayName={auth.userDisplayName}
    />
  );
}

