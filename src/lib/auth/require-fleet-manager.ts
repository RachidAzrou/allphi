import { createClient } from "@/lib/supabase/server";

type MedewerkerRole = "medewerker" | "fleet_manager" | "management";

export async function requireFleetManagerAccess(): Promise<
  | {
      ok: true;
      userEmail: string;
      userDisplayName: string;
    }
  | { ok: false; status: 401 | 403; title: string; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return { ok: false, status: 401, title: "Fleet manager", message: "Niet geautoriseerd." };
  }

  const { data: medewerker } = await supabase
    .from("medewerkers")
    .select("role, rol, voornaam, naam")
    .ilike("emailadres", user.email)
    .maybeSingle();

  const role = (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null } | null)
    ? (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null }).role ??
      (medewerker as { role?: MedewerkerRole | null; rol?: MedewerkerRole | null }).rol ??
      "medewerker"
    : "medewerker";

  const allowed = role === "fleet_manager" || role === "management";
  if (!allowed) {
    return { ok: false, status: 403, title: "Fleet manager", message: "Forbidden." };
  }

  const displayName =
    [medewerker?.voornaam, medewerker?.naam].filter(Boolean).join(" ").trim() || user.email;

  return { ok: true, userEmail: user.email, userDisplayName: displayName };
}

