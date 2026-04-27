import { createServiceRoleClient } from "@/lib/supabase/service-role";

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function escalateFleetQuestion(params: {
  escalationId: string;
  userEmail: string;
  question: string;
  escalationReason?: string | null;
  appOrigin?: string | null;
  conversationId?: string | null;
}): Promise<{ ok: true; simulated: boolean } | { ok: false; error: string }> {
  const svc = createServiceRoleClient();
  if (!svc) return { ok: false, error: "service_role_missing" };

  // Reserved for future use (e.g. deep links). Intentionally not included in the stored body.
  void params.appOrigin;
  void params.conversationId;

  const text = [
    "Beste,",
    "",
    "Onderstaande vraag werd doorgestuurd vanuit Fleet Companion.",
    "",
    `Medewerker: ${params.userEmail}`,
    "",
    "Vraag:",
    params.question.trim(),
    "",
    params.escalationReason ? `Reden (systeem):\n${params.escalationReason.trim()}\n` : null,
    "",
    "Met vriendelijke groet,",
    "AllPhi Fleet Companion",
  ]
    .filter((l): l is string => Boolean(l))
    .join("\n");

  const html = `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.5;color:#163247">
<p>${htmlEscape("Beste,")}</p>
<p>${htmlEscape("Onderstaande vraag werd doorgestuurd vanuit Fleet Companion.")}</p>
<p><b>${htmlEscape("Medewerker:")}</b> ${htmlEscape(params.userEmail)}</p>
<p><b>${htmlEscape("Vraag:")}</b><br/>${htmlEscape(params.question.trim())}</p>
${params.escalationReason ? `<p><b>${htmlEscape("Reden (systeem):")}</b><br/>${htmlEscape(params.escalationReason.trim())}</p>` : ""}
<p>${htmlEscape("Met vriendelijke groet,")}<br/>${htmlEscape("AllPhi Fleet Companion")}</p>
</body></html>`;

  await svc
    .from("fleet_escalations")
    .update({
      assignee_email: null,
      body: text,
      error: null,
    })
    .eq("id", params.escalationId);

  // Email sending is intentionally removed: fleet managers handle escalations
  // in-app via the fleetmanager inbox.
  return { ok: true, simulated: true };
}

