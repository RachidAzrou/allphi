import { requireFleetManagerAccess } from "@/lib/auth/require-fleet-manager";
import { FleetManagerChargingClient } from "./charging-client";

export default async function FleetManagerLaadkostenPage() {
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
    <FleetManagerChargingClient userEmail={auth.userEmail} userDisplayName={auth.userDisplayName} />
  );
}

