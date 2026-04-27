import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function normName(s: unknown): string {
  if (typeof s !== "string") return "";
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.trim()?.toLowerCase();
    const naamIn = body?.naam;
    const voornaamIn = body?.voornaam;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ exists: false });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error(
        "[check-email] Missing env: NEXT_PUBLIC_SUPABASE_URL and/or (SUPABASE_SERVICE_ROLE_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY)",
      );
      return NextResponse.json(
        { exists: false, error: "missing_env" },
        { status: 500 },
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const wantNameMatch =
      typeof naamIn === "string" &&
      typeof voornaamIn === "string" &&
      naamIn.trim().length > 0 &&
      voornaamIn.trim().length > 0;

    if (wantNameMatch) {
      const { data, error } = await supabase
        .from("medewerkers")
        .select("id, naam, voornaam")
        .eq("emailadres", email)
        .maybeSingle();

      if (error) {
        console.error("[check-email] Supabase error:", error.message);
        return NextResponse.json(
          { exists: false, error: "db_error" },
          { status: 500 }
        );
      }

      if (!data) {
        return NextResponse.json({ exists: false });
      }

      const match =
        normName(data.naam) === normName(naamIn) &&
        normName(data.voornaam) === normName(voornaamIn);

      return NextResponse.json({ exists: match });
    }

    const { data, error } = await supabase
      .from("medewerkers")
      .select("id")
      .eq("emailadres", email)
      .maybeSingle();

    if (error) {
      console.error("[check-email] Supabase error:", error.message);
      return NextResponse.json(
        { exists: false, error: "db_error" },
        { status: 500 }
      );
    }

    return NextResponse.json({ exists: data !== null });
  } catch (err) {
    console.error("[check-email] Error:", err);
    return NextResponse.json(
      { exists: false, error: "server_error" },
      { status: 500 }
    );
  }
}
