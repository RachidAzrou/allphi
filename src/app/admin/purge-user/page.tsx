import { createClient } from "@/lib/supabase/server";
import { PurgeUserClient } from "./purge-user-client";

export default async function PurgeUserPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Verwijder gebruiker</h1>
        <p className="mt-2 text-sm text-muted-foreground">Niet geautoriseerd.</p>
      </div>
    );
  }

  const { data: medewerker } = await supabase
    .from("medewerkers")
    .select("rol, voornaam, naam")
    .ilike("emailadres", user.email)
    .maybeSingle();
  const role = (medewerker as { rol?: string } | null)?.rol ?? "medewerker";
  const allowed = role === "fleet_manager" || role === "management";

  if (!allowed) {
    return (
      <div className="p-6">
        <h1 className="text-lg font-semibold">Verwijder gebruiker</h1>
        <p className="mt-2 text-sm text-muted-foreground">Forbidden.</p>
      </div>
    );
  }

  const userDisplayName =
    [medewerker?.voornaam, medewerker?.naam].filter(Boolean).join(" ").trim() ||
    user.email;

  return <PurgeUserClient userEmail={user.email} userDisplayName={userDisplayName} />;
}

