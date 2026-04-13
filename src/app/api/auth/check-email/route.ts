import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = body?.email?.trim()?.toLowerCase();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ exists: false });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient(supabaseUrl, supabaseKey);

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
