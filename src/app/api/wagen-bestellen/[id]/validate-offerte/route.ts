import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Issue = { code: string; message: string };

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim()) {
    const n = Number(v.replace(",", ".").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.id || !user.email) {
    return NextResponse.json({ ok: false, error: "Niet geautoriseerd" }, { status: 401 });
  }

  const { data: order, error: orderErr } = await supabase
    .from("wagen_bestellingen")
    .select("id, user_id, payload")
    .eq("id", id)
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ ok: false, error: "Niet gevonden" }, { status: 404 });
  }

  // RLS should enforce this, but keep a guard.
  if (order.user_id !== user.id) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  const payload = (order.payload ?? {}) as Record<string, unknown>;
  const model = (payload["model"] ?? {}) as Record<string, unknown>;
  const merkModel = String(model["merkModel"] ?? "").trim();
  const catalogId = String(model["catalogId"] ?? "").trim();
  const offerTotalEur = num(model["offerTotalEur"]);

  const issues: Issue[] = [];
  if (!merkModel && !catalogId) {
    issues.push({
      code: "missing_model",
      message: "Kies een model (minstens merk + model) om te kunnen valideren.",
    });
  }
  if (!offerTotalEur || offerTotalEur <= 0) {
    issues.push({
      code: "missing_price",
      message: "Vul de totaalprijs van de offerte in (voor budget-check).",
    });
  }

  // Allowed options check (best effort).
  let modelAllowed = true;
  try {
    const { data: options } = await supabase
      .from("v_allowed_vehicle_options")
      .select("catalog_id, merk_model")
      .ilike("emailadres", user.email)
      .limit(250);

    const list = (options ?? []) as Array<{ catalog_id?: string | null; merk_model?: string | null }>;
    if (list.length > 0) {
      const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const wantCat = catalogId ? norm(catalogId) : "";
      const wantModel = merkModel ? norm(merkModel) : "";
      modelAllowed = list.some((o) => {
        const cat = norm(String(o.catalog_id ?? ""));
        const mm = norm(String(o.merk_model ?? ""));
        if (wantCat && cat && wantCat === cat) return true;
        if (wantModel && mm && mm.includes(wantModel)) return true;
        return false;
      });
    }
  } catch (e) {
    console.warn("[wagen-bestellen] allowed options check failed", e);
  }

  if (!modelAllowed) {
    issues.push({
      code: "model_not_allowed",
      message: "Dit model lijkt niet in je officiële keuzelijst te staan. Check je keuze of catalog-id.",
    });
  }

  // Budget / overspend check.
  let overspendAmountEur: number | null = null;
  let contributionAmountEur: number | null = null;

  if (offerTotalEur && offerTotalEur > 0) {
    const { data: fc } = await supabase
      .from("v_fleet_assistant_context")
      .select("optiebudget")
      .ilike("emailadres", user.email)
      .order("merk_model", { ascending: true })
      .order("nummerplaat", { ascending: true })
      .limit(1)
      .maybeSingle();

    const optiebudget = num((fc as { optiebudget?: unknown } | null)?.optiebudget) ?? null;
    if (optiebudget !== null) {
      overspendAmountEur = Math.max(0, offerTotalEur - optiebudget);
    }

    const { data: company } = await supabase
      .from("company_profile")
      .select("car_order_overspend_threshold_eur")
      .single();

    const threshold =
      num((company as { car_order_overspend_threshold_eur?: unknown } | null)?.car_order_overspend_threshold_eur) ??
      3000;

    if (overspendAmountEur !== null && overspendAmountEur > threshold) {
      contributionAmountEur = overspendAmountEur;
    } else {
      contributionAmountEur = 0;
    }
  }

  // Persist summary on the row for reporting.
  await supabase
    .from("wagen_bestellingen")
    .update({
      offer_validation: { validatedAt: new Date().toISOString(), issues, modelAllowed } as unknown as Record<
        string,
        unknown
      >,
      overspend_amount_eur: overspendAmountEur,
      personal_contribution_amount_eur: contributionAmountEur,
    })
    .eq("id", id);

  return NextResponse.json({
    ok: true,
    issues,
    overspendAmountEur,
    contributionAmountEur,
  });
}

