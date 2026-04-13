import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "not_authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const password = body?.password;

    if (!password || typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "invalid_password" },
        { status: 400 }
      );
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      console.error("[set-password] SUPABASE_SERVICE_ROLE_KEY is not set");
      return NextResponse.json(
        { error: "server_config_error" },
        { status: 500 }
      );
    }

    const adminClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey
    );

    const { error } = await adminClient.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
    });

    if (error) {
      console.error("[set-password] Admin updateUser error:", error.message);
      return NextResponse.json(
        { error: "update_failed" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[set-password] Error:", err);
    return NextResponse.json(
      { error: "server_error" },
      { status: 500 }
    );
  }
}
