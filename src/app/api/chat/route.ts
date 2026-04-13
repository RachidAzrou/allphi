import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { detectIntent } from "@/lib/intent/router";
import { handleIntent } from "@/lib/intent/handlers";
import { generateOpenAIReply } from "@/lib/openai/fleet-chat";
import type { ChatResponse } from "@/types/chat";
import {
  CHAT_ATTACHMENTS_BUCKET,
  MAX_CHAT_ATTACHMENT_BYTES,
  MAX_CHAT_ATTACHMENTS,
} from "@/lib/chat/attachment-limits";
import { uploadChatFilesForPrompt } from "@/lib/chat/process-uploads";
import { signStoredAttachments } from "@/lib/chat/sign-attachments";
import {
  getOrCreateConversationId,
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
      let message = String(form.get("message") ?? "").trim();
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

      if (!message && files.length > 0) {
        message = "Bijlagen toegevoegd.";
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

    // Intent alleen op wat de gebruiker typte — niet op [Bijlagen] / .pdf in URLs,
    // anders wordt "my_documents" getriggerd bij elke PDF-bijlage.
    const intent = detectIntent(userFacingContent);

    const result: ChatResponse =
      intent === "unknown" && process.env.OPENAI_API_KEY
        ? await generateOpenAIReply({
            userMessage: effectiveMessage,
            voornaam: medewerker?.voornaam,
          })
        : await handleIntent(intent, user.email, medewerker?.voornaam);

    try {
      await insertAssistantMessage(supabase, conversationId, result);
    } catch (persistErr) {
      console.error("Assistant message persist failed:", persistErr);
    }

    return NextResponse.json({ ...result, persisted });
  } catch (error) {
    console.error("Chat API error:", error);

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

    return NextResponse.json(fallback, { status: 500 });
  }
}
