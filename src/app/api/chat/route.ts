import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectAccidentFallback, detectIntent } from "@/lib/intent/router";
import {
  handleIntent,
  handleAccidentReportFlowMessage,
  handleLeaseReturnInspectionFlowMessage,
  handleTireChangeFlowMessage,
} from "@/lib/intent/handlers";
import { generateOpenAIReply } from "@/lib/openai/fleet-chat";
import type { ChatResponse } from "@/types/chat";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { escalateFleetQuestion } from "@/lib/fleet/escalate-question";
import {
  CHAT_ATTACHMENTS_BUCKET,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENTS,
} from "@/lib/chat/attachment-limits";
import { uploadChatFilesForPrompt } from "@/lib/chat/process-uploads";
import { signStoredAttachments } from "@/lib/chat/sign-attachments";
import {
  getOrCreateConversationId,
  fetchLastAssistantMeta,
  insertAssistantMessage,
  insertUserMessage,
  type StoredChatAttachment,
} from "@/lib/queries/chat-history";

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

    const contentType = request.headers.get("content-type") ?? "";
    let userFacingContent: string;
    let effectiveMessage: string;
    const storedAttachments: StoredChatAttachment[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      const message = String(form.get("message") ?? "").trim();
      const rawFiles = form.getAll("files");
      const files = rawFiles.filter(
        (x): x is File => x instanceof File && x.size > 0
      );

      if (files.length > MAX_CHAT_ATTACHMENTS) {
        return NextResponse.json(
          { error: `Maximaal ${MAX_CHAT_ATTACHMENTS} bijlagen.` },
          { status: 400 }
        );
      }

      for (const f of files) {
        if (f.size > MAX_CHAT_ATTACHMENT_BYTES) {
          return NextResponse.json(
            { error: `Bestand te groot: ${f.name}` },
            { status: 400 }
          );
        }
      }

      if (!message && files.length === 0) {
        return NextResponse.json(
          { error: "Geen bericht ontvangen" },
          { status: 400 }
        );
      }

      const bucket = CHAT_ATTACHMENTS_BUCKET;
      const { stored, promptLines } = await uploadChatFilesForPrompt(supabase, {
        userId: user.id,
        files,
        bucket,
      });
      storedAttachments.push(...stored);

      userFacingContent = message;
      effectiveMessage =
        promptLines.length > 0
          ? `${message}\n\n[Bijlagen]\n${promptLines.join("\n")}`
          : message;
    } else {
      const body = await request.json();
      const message = body?.message;

      if (!message || typeof message !== "string") {
        return NextResponse.json(
          { error: "Geen bericht ontvangen" },
          { status: 400 }
        );
      }

      userFacingContent = message.trim();
      if (!userFacingContent) {
        return NextResponse.json(
          { error: "Geen bericht ontvangen" },
          { status: 400 }
        );
      }
      effectiveMessage = userFacingContent;
    }

    const conversationId = await getOrCreateConversationId(supabase, user.id);
    const userMessageId = await insertUserMessage(
      supabase,
      conversationId,
      userFacingContent,
      storedAttachments,
    );

    const persisted = {
      userMessageId,
      ...(storedAttachments.length > 0
        ? {
            attachments: await signStoredAttachments(
              supabase,
              storedAttachments,
            ),
          }
        : {}),
    };

    const { data: medewerker } = await supabase
      .from("medewerkers")
      .select("voornaam")
      .eq("emailadres", user.email)
      .maybeSingle();

    // Flow routing: if the last assistant message started a guided flow,
    // handle the next step before stateless intent detection.
    let result: ChatResponse | null = null;
    try {
      const lastMeta = await fetchLastAssistantMeta(supabase, conversationId);
      const flow = lastMeta?.flow ?? null;

      // If the user is in an active flow but asks a free-form question (contains "?"),
      // route to the AI instead of repeating the step — and preserve the flow state
      // so navigation commands still work on the next message.
      const isFlowNavCmd = /^(volgende|volgende stap|ga verder|verder|ok|oke|oké|ja|vorige|vorige stap|terug|ga terug|back|stop|annuleer|cancel|afbreken|reset|begin opnieuw|start)$/i.test(
        userFacingContent.trim()
      );
      if (flow && !isFlowNavCmd && userFacingContent.includes("?") && process.env.OPENAI_API_KEY) {
        const aiResult = await generateOpenAIReply({
          supabase,
          conversationId,
          userMessageId,
          userEmail: user.email,
          appOrigin: request.headers.get("origin"),
          userMessage: effectiveMessage,
          voornaam: medewerker?.voornaam,
          intent: "unknown",
        });
        result = {
          ...aiResult,
          message:
            aiResult.message +
            "\n\n---\n*Je zit nog in de procedure. Typ **Volgende** om verder te gaan, **Vorige** om een stap terug te gaan, of **Stop** om te annuleren.*",
          flow: {
            id: flow.id,
            step: flow.step,
            ...(flow.answers ? { answers: flow.answers } : {}),
          },
        };
      }

      if (flow?.id === "tire_change" && typeof flow.step === "number") {
        result = handleTireChangeFlowMessage({
          userMessage: userFacingContent,
          flow: {
            id: "tire_change",
            step: flow.step,
            answers: flow.answers ?? undefined,
          },
        });
      }
      if (
        !result &&
        flow?.id === "lease_return_inspection" &&
        typeof flow.step === "number"
      ) {
        result = handleLeaseReturnInspectionFlowMessage({
          userMessage: userFacingContent,
          flow: {
            id: "lease_return_inspection",
            step: flow.step,
            answers: flow.answers ?? undefined,
          },
        });
      }
      if (
        !result &&
        flow?.id === "accident_report" &&
        typeof flow.step === "number"
      ) {
        result = handleAccidentReportFlowMessage({
          userMessage: userFacingContent,
          flow: {
            id: "accident_report",
            step: flow.step,
            answers: flow.answers ?? undefined,
          },
        });
      }
    } catch (e) {
      console.error("Flow routing failed:", e);
      result = null;
    }

    if (!result) {
      // Intent alleen op wat de gebruiker typte — niet op [Bijlagen] / .pdf in URLs,
      // anders wordt "my_documents" getriggerd bij elke PDF-bijlage.
      let intent = detectIntent(userFacingContent);
      if (intent === "unknown" && detectAccidentFallback(userFacingContent)) {
        intent = "accident_report";
      }

      // Insurance certificate: if there's no active vehicle, auto-escalate to fleet manager inbox.
      if (intent === "insurance_certificate") {
        try {
          const { data: ctx } = await supabase
            .from("v_fleet_assistant_context")
            .select("merk_model, nummerplaat, vin")
            .ilike("emailadres", user.email)
            .order("merk_model", { ascending: true })
            .order("nummerplaat", { ascending: true })
            .limit(1)
            .maybeSingle();

          const hasVehicle = Boolean(
            (ctx as any)?.vin?.trim?.() ||
              (ctx as any)?.nummerplaat?.trim?.() ||
              (ctx as any)?.merk_model?.trim?.(),
          );

          if (!hasVehicle) {
            const svc = createServiceRoleClient();
            if (svc) {
              const { data: esc, error: escErr } = await svc
                .from("fleet_escalations")
                .insert({
                  conversation_id: conversationId,
                  user_message_id: userMessageId,
                  status: "unread",
                  assignee_email: null,
                  subject: null,
                  body: null,
                  error: null,
                })
                .select("id")
                .single();
              if (escErr) throw escErr;

              await escalateFleetQuestion({
                escalationId: esc.id,
                userEmail: user.email,
                question:
                  "Verzekeringsattest aanvraag — geen actief leasevoertuig gevonden voor dit profiel.",
                escalationReason: "Geen actief leasevoertuig gekoppeld aan profiel.",
                conversationId,
                appOrigin: request.headers.get("origin"),
              });
            }
          }
        } catch (e) {
          console.error("Insurance certificate escalation failed:", e);
        }
      }

      result =
        intent === "unknown" && process.env.OPENAI_API_KEY
          ? await generateOpenAIReply({
              supabase,
              conversationId,
              userMessageId,
              userEmail: user.email,
              appOrigin: request.headers.get("origin"),
              userMessage: effectiveMessage,
              voornaam: medewerker?.voornaam,
              intent,
            })
          : await handleIntent(intent, user.email, medewerker?.voornaam);
    }

    // Accident: auto-escalate when the flow indicates injuries.
    if (result?.intent === "accident_report" && result?.title === "Aanrijding — Gewonden") {
      try {
        const svc = createServiceRoleClient();
        if (svc) {
          const { data: esc, error: escErr } = await svc
            .from("fleet_escalations")
            .insert({
              conversation_id: conversationId,
              user_message_id: userMessageId,
              status: "unread",
              assignee_email: null,
              subject: null,
              body: null,
              error: null,
            })
            .select("id")
            .single();
          if (escErr) throw escErr;

          await escalateFleetQuestion({
            escalationId: esc.id,
            userEmail: user.email,
            question: "Aanrijding met gewonden",
            escalationReason:
              "Verplichte escalatie: gewonden betrokken bij aanrijding.",
            conversationId,
            appOrigin: request.headers.get("origin"),
          });
        }
      } catch (e) {
        console.error("Accident escalation failed:", e);
      }
    }

    try {
      await insertAssistantMessage(supabase, conversationId, result);
    } catch (persistErr) {
      console.error("Assistant message persist failed:", persistErr);
    }

    return NextResponse.json({ ...result, persisted });
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
    console.error(`Chat API error:\n${errText}`);
    const isDev = process.env.NODE_ENV !== "production";

    const fallback: ChatResponse = {
      intent: "unknown",
      title: "Fout",
      message:
        "Er is een fout opgetreden. Probeer het opnieuw of neem contact op met support.",
      suggestions: [
        "Mijn wagen",
        "Mijn documenten",
        "Mijn laadkosten",
        "Beschikbare wagens",
        "Contractinfo",
      ],
    };

    return NextResponse.json(
      { ...fallback, ...(isDev ? { debug: errText } : {}) },
      { status: 500 },
    );
  }
}
