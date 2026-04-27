import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    console.error(
      "Missing env: NEXT_PUBLIC_SUPABASE_URL and/or NEXT_PUBLIC_SUPABASE_ANON_KEY. Auth middleware is disabled.",
    );
    return supabaseResponse;
  }

  const supabase = createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAuthCallback = request.nextUrl.pathname === "/auth/callback";
  const isPublicAuthApi = request.nextUrl.pathname.startsWith("/api/auth/");
  const isGuestJoinFlow =
    request.nextUrl.pathname === "/ongeval/join" ||
    (request.nextUrl.pathname.startsWith("/ongeval/") &&
      request.nextUrl.searchParams.has("s")) ||
    request.nextUrl.pathname.includes("/api/ongeval/") ||
    request.nextUrl.pathname.startsWith("/api/ongeval/");
  const isPublicAsset =
    request.nextUrl.pathname.startsWith("/_next") ||
    request.nextUrl.pathname.startsWith("/manifest") ||
    request.nextUrl.pathname.includes(".");

  if (isPublicAsset || isAuthCallback || isPublicAuthApi || isGuestJoinFlow) {
    return supabaseResponse;
  }

  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    let role: string | null = null;
    try {
      const { data: medewerker } = await supabase
        .from("medewerkers")
        .select("role, rol")
        .ilike("emailadres", user.email ?? "")
        .maybeSingle();
      role =
        (medewerker as { role?: string | null; rol?: string | null } | null)?.role ??
        (medewerker as { role?: string | null; rol?: string | null } | null)?.rol ??
        null;
    } catch (e) {
      console.error("[middleware] role lookup failed", e);
      role = null;
    }

    const isFleet = role === "fleet_manager" || role === "management";
    const url = request.nextUrl.clone();
    url.pathname = isFleet ? "/fleet-manager" : "/chat";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
