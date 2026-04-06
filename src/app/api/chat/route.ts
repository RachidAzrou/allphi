import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectIntent } from "@/lib/intent/router";
import { handleIntent } from "@/lib/intent/handlers";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: "Niet geautoriseerd" },
        { status: 401 }
      );
    }

    const { message } = await request.json();

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Geen bericht ontvangen" },
        { status: 400 }
      );
    }

    const { data: medewerker } = await supabase
      .from("medewerkers")
      .select("voornaam")
      .eq("email", user.email)
      .maybeSingle();

    const intent = detectIntent(message);

    const result = await handleIntent(
      intent,
      user.email,
      medewerker?.voornaam
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      {
        intent: "unknown",
        message:
          "Er is een fout opgetreden. Probeer het opnieuw of neem contact op met support.",
      },
      { status: 500 }
    );
  }
}
