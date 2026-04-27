import { createClient } from "@supabase/supabase-js";

const email = "fleetmanager@allphi.be";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const password = process.env.FLEETMANAGER_PASSWORD;

if (!url) throw new Error("Missing env: NEXT_PUBLIC_SUPABASE_URL");
if (!serviceRoleKey) throw new Error("Missing env: SUPABASE_SERVICE_ROLE_KEY");
if (!password) throw new Error("Missing env: FLEETMANAGER_PASSWORD");

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: existingUsers, error: listError } =
    await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const existing = existingUsers?.users?.find(
    (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
  );

  const userId = existing?.id;

  if (!userId) {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) throw error;
    if (!data?.user?.id) throw new Error("User creation returned no user id");
    console.log(`Created auth user: ${email} (${data.user.id})`);
  } else {
    console.log(`Auth user already exists: ${email} (${userId})`);
  }

  // Best-effort: create/update medewerker row used by RLS helper `current_medewerker_id()`.
  // This table predates migrations in this repo, so we keep this resilient.
  const { data: existingMedewerker, error: medewerkerSelectError } =
    await supabase
      .from("medewerkers")
      .select("id,emailadres,role,rol")
      .ilike("emailadres", email)
      .maybeSingle();

  // If the table/columns don't exist in this environment, just stop here.
  if (medewerkerSelectError) {
    console.warn(
      `Could not select from public.medewerkers (skipping medewerker upsert): ${medewerkerSelectError.message}`,
    );
    return;
  }

  if (existingMedewerker?.id) {
    const { error: medewerkerUpdateError } = await supabase
      .from("medewerkers")
      .update({ role: "fleet_manager", rol: "fleet_manager" })
      .eq("id", existingMedewerker.id);

    if (medewerkerUpdateError) {
      console.warn(
        `Could not update public.medewerkers role (skipping): ${medewerkerUpdateError.message}`,
      );
    } else {
      console.log(
        `Updated medewerker role to fleet_manager (medewerker_id=${existingMedewerker.id})`,
      );
    }

    return;
  }

  const { data: insertedMedewerker, error: medewerkerInsertError } =
    await supabase
      .from("medewerkers")
      .insert({
        emailadres: email,
        voornaam: "Fleet",
        naam: "Manager",
        role: "fleet_manager",
        rol: "fleet_manager",
      })
      .select("id,emailadres,role,rol")
      .single();

  if (medewerkerInsertError) {
    console.warn(
      `Could not insert into public.medewerkers (skipping): ${medewerkerInsertError.message}`,
    );
    return;
  }

  console.log(
    `Inserted medewerker row (medewerker_id=${insertedMedewerker.id}, role=${insertedMedewerker.role ?? insertedMedewerker.rol})`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

