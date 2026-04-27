import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { escalateFleetQuestion } from "@/lib/fleet/escalate-question";
import OpenAI from "openai";

function topicFromQuestion(question: string): string {
  const oneLine = String(question ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!oneLine) return "Vraag";
  // keep it short and scannable
  const max = 72;
  const clipped = oneLine.length > max ? `${oneLine.slice(0, max - 1).trimEnd()}…` : oneLine;
  return clipped;
}

async function aiTopicFromContext(params: {
  question: string;
  reason?: string | null;
}): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const system =
    "Je maakt een korte Nederlandse onderwerpregel voor een doorgestuurde vraag aan de fleet manager.\n" +
    "Regels:\n" +
    "- 3 tot 7 woorden.\n" +
    "- Geen aanhalingstekens.\n" +
    "- Geen punt op het einde.\n" +
    "- Gebruik domeinwoorden als relevant (bv. reizen, tank/laadkosten, inlevering wagen, schade/ongeval, bandenwissel, verzekering, bestelprocedure).\n" +
    "- Als het over meerdere dingen gaat: kies het belangrijkste.\n" +
    'Antwoord als JSON: {"topic": "<onderwerp>"}';

  const user =
    `Vraag:\n${params.question.trim()}\n\n` +
    (params.reason?.trim() ? `Reden (systeem):\n${params.reason.trim()}\n` : "");

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as { topic?: unknown };
    const topic = typeof parsed.topic === "string" ? parsed.topic.trim() : "";
    if (!topic) return null;

    const oneLine = topic.replace(/\s+/g, " ").trim();
    const clipped = oneLine.length > 60 ? `${oneLine.slice(0, 59).trimEnd()}…` : oneLine;
    return clipped;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      return NextResponse.json({ error: "Niet geautoriseerd" }, { status: 401 });
    }

    const body = await request.json();
    const { userMessageId, assistantMessageId, question, reason } = body as {
      userMessageId?: string;
      /** Assistant bubble that holds pendingEscalation; used to clear metadata. */
      assistantMessageId?: string;
      question?: string;
      reason?: string;
    };

    if (!userMessageId || !question) {
      return NextResponse.json(
        { error: "userMessageId en question zijn verplicht" },
        { status: 400 },
      );
    }

    // Load trigger message. Clients may still send the assistant message id; we then
    // anchor the escalation on the medewerker's preceding user message so inbox/thread
    // show the typed question, not the assistant boilerplate.
    const { data: triggerRow, error: msgErr } = await supabase
      .from("chat_messages")
      .select("id, role, conversation_id, created_at")
      .eq("id", userMessageId)
      .maybeSingle();

    if (msgErr) throw msgErr;
    if (!triggerRow?.conversation_id) {
      return NextResponse.json(
        { error: "Bericht niet gevonden" },
        { status: 404 },
      );
    }
    const conversationId = triggerRow.conversation_id as string;
    const role = String(triggerRow.role ?? "").toLowerCase();

    let anchorUserMessageId: string;
    let assistantMessageIdForMeta: string | null = (assistantMessageId ?? "").trim() || null;

    if (role === "user") {
      anchorUserMessageId = userMessageId;
      if (!assistantMessageIdForMeta) {
        const { data: nextAsst } = await supabase
          .from("chat_messages")
          .select("id")
          .eq("conversation_id", conversationId)
          .eq("role", "assistant")
          .gt("created_at", triggerRow.created_at as string)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        assistantMessageIdForMeta = (nextAsst?.id as string) ?? null;
      }
    } else if (role === "assistant") {
      assistantMessageIdForMeta = assistantMessageIdForMeta ?? (triggerRow.id as string);
      const { data: prevUser } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("role", "user")
        .lt("created_at", triggerRow.created_at as string)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!prevUser?.id) {
        return NextResponse.json(
          { error: "Geen medewerker-bericht gevonden om te koppelen aan deze escalatie" },
          { status: 400 },
        );
      }
      anchorUserMessageId = prevUser.id as string;
    } else {
      return NextResponse.json(
        { error: "Ongeldig berichttype voor escalatie" },
        { status: 400 },
      );
    }

    const svc = createServiceRoleClient();
    if (!svc) {
      return NextResponse.json(
        { error: "Serveronfiguratie fout" },
        { status: 500 },
      );
    }

    const { data: medewerkerRow } = await svc
      .from("medewerkers")
      .select("voornaam, naam")
      .ilike("emailadres", user.email)
      .maybeSingle();
    const medewerkerNaam =
      [medewerkerRow?.voornaam, medewerkerRow?.naam].filter(Boolean).join(" ").trim() ||
      user.email;

    const onderwerp =
      (await aiTopicFromContext({ question, reason: reason || null })) ??
      topicFromQuestion(question);
    const subject = `Escalatie — ${medewerkerNaam} — ${onderwerp}`;

    // Create the escalation row.
    const { data: esc, error: escErr } = await svc
      .from("fleet_escalations")
      .insert({
        conversation_id: conversationId,
        user_message_id: anchorUserMessageId,
        status: "unread",
        assignee_email: null,
        subject,
        body: `Medewerker: ${user.email}\n\nVraag:\n${question.trim()}${
          reason ? `\n\nReden:\n${reason.trim()}` : ""
        }`,
        error: null,
      })
      .select("id")
      .single();

    if (escErr) throw escErr;

    // Send the escalation email.
    await escalateFleetQuestion({
      escalationId: esc.id,
      userEmail: user.email,
      question,
      escalationReason: reason || null,
      appOrigin: request.headers.get("origin"),
      conversationId,
    });

    // Best-effort: clear pendingEscalation from the assistant message metadata
    // so the button disappears the next time messages are reloaded.
    // We do a direct update instead of an RPC to avoid a dependency on a
    // specific DB function that may not exist yet.
    try {
      const clearId = assistantMessageIdForMeta;
      if (clearId) {
        const { data: metaRow } = await supabase
          .from("chat_messages")
          .select("metadata")
          .eq("id", clearId)
          .maybeSingle();
        const meta = metaRow?.metadata as Record<string, unknown> | null;
        if (meta?.pendingEscalation) {
          const { pendingEscalation: _removed, ...rest } = meta;
          await supabase
            .from("chat_messages")
            .update({ metadata: rest })
            .eq("id", clearId);
        }
      }
    } catch {
      // Non-critical — the button will just stay visible until next reload.
    }

    return NextResponse.json({ ok: true, escalationId: esc.id });
  } catch (error) {
    const errText =
      error instanceof Error
        ? `${error.name}: ${error.message}\n${error.stack ?? ""}`.trim()
        : (() => {
            try {
              return JSON.stringify(error);
            } catch {
              return String(error);
            }
          })();
    console.error(`POST /api/chat/escalate:\n${errText}`);
    const isDev = process.env.NODE_ENV !== "production";
    return NextResponse.json(
      {
        error: "Escalatie mislukt. Probeer opnieuw of neem contact op met je fleet manager.",
        ...(isDev ? { debug: errText } : {}),
      },
      { status: 500 },
    );
  }
}
