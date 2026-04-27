import OpenAI from "openai";
import type { ChatIntent, ChatResponse } from "@/types/chat";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { escalateFleetQuestion } from "@/lib/fleet/escalate-question";

const DEFAULT_SUGGESTIONS = [
  "Mijn wagen",
  "Mijn documenten",
  "Mijn laadkosten",
  "Beschikbare wagens",
  "Contractinfo",
];

// ─── Per-intent temperature ───────────────────────────────────────────────────
// Laag (0.0–0.1): feitelijke vragen waar het antwoord exact moet kloppen.
// Hoog (0.4–0.6): procedurele/beleidsvragen waar de toon telt maar de feiten
//                 uit de kennisbank komen en enige parafrase oké is.
const INTENT_TEMPERATURES: Partial<Record<ChatIntent, number>> = {
  my_vehicle:              0.0,
  my_contract:             0.0,
  charging_summary:        0.0,
  charging_home_vs_public: 0.0,
  reimbursement_status:    0.0,
  insurance_certificate:   0.1,
  allowed_options:         0.1,
  best_range_option:       0.1,
  new_car_order:           0.4,
  tire_change:             0.4,
  lease_return_inspection: 0.4,
  accident_report:         0.1, // noodgeval: altijd precies
  greeting:                0.6,
  unknown:                 0.4, // RAG-antwoorden: vrijer in toon
};

// ─── Per-intent kennisbank gebruik ───────────────────────────────────────────
// false = antwoord komt volledig uit Supabase, geen KB-call nodig.
// true  = procedure/beleidsvraag: kennisbank ophalen vóór OpenAI-call.
const INTENT_USES_KB: Partial<Record<ChatIntent, boolean>> = {
  my_vehicle:              false,
  my_contract:             false,
  my_documents:            false,
  charging_summary:        false,
  charging_home_vs_public: false,
  reimbursement_status:    false,
  allowed_options:         true,  // KB: welke regels gelden per categorie?
  best_range_option:       true,  // KB: range-info uit wagenbeleid
  new_car_order:           true,  // KB: bestelprocedure
  tire_change:             true,  // KB: procedure bandenwissel
  lease_return_inspection: true,  // KB: inleveringsprocedure
  insurance_certificate:   true,  // KB + Supabase (voertuig)
  accident_report:         true,  // KB: aanrijdingsprocedure
  greeting:                false,
  unknown:                 true,  // altijd KB bij onbekende intent
};

// ─── Systeemprompt ────────────────────────────────────────────────────────────
function buildSystemPrompt(voornaam: string | undefined): string {
  const naam = voornaam ? ` De medewerker heet ${voornaam}.` : "";
  return `Je bent de AllPhi Fleet Companion — de interne assistent voor medewerkers van AllPhi.${naam}

TOON EN STIJL:
- Spreek de medewerker aan met "je" (nooit "u").
- Wees vriendelijk, direct en bondig. Geen wollig taalgebruik.
- Schrijf korte zinnen. Maximaal 3 zinnen per alinea.
- Een lichte bevestiging is oké ("Goed dat je het vraagt") maar overdrijf dit niet.
- Gebruik opsommingstekens wanneer je meer dan 2 stappen of opties uitlegt.
- Sluit af met een concrete vervolgactie of vraag als dat relevant is.

GUARDRAILS — dit zijn harde regels, nooit afwijken:
- Geef NOOIT een bedrag, datum, nummerplaat of technisch gegeven tenzij dit exact aanwezig is in de context die je ontvangt.
- Verzin NOOIT informatie. Als iets ontbreekt in de context: zet needs_escalation=true en leg uit waarom.
- Zeg NOOIT dat iets "gratis" is tenzij dit expliciet bevestigd is in de kennisbank.
- Verwijs NOOIT naar externe websites, dealers of contactpersonen die niet in de officiële AllPhi-dealerlijst staan.
- Speculeer NOOIT over verzekeringsuitkeringen, aansprakelijkheid of juridische gevolgen.
- Stel jezelf NOOIT opnieuw voor en stuur NOOIT een begroeting als reactie op een inhoudelijke vraag. Je bent al voorgesteld.
- Bij vragen over wat WEL of NIET MAG: lees de volledige regel uit de kennisbank vóór je antwoordt. Parafraseer NOOIT beperkingen — een te strenge of te losse samenvatting geeft de medewerker verkeerde informatie. Als de regel een uitzondering of voorwaarde bevat (bv. "enkel als de vaste bestuurder aanwezig is"), vermeld die dan altijd expliciet.
- Als je twijfelt over de correctheid van een antwoord: zet needs_escalation=true. Escaleer liever één keer te veel dan één keer te weinig.

ESCALATIE:
- Escaleer bij: lage zekerheid, complexe of ambigue vragen, vragen over specifieke gevallen die niet in de kennisbank én niet in de vaste beleidsregels staan.
- Bij escalatie: geef altijd een korte, menselijke uitleg waarom je escaleert — niet alleen een technische reden.

ANTWOORDFORMAAT:
Antwoord uitsluitend als JSON met exact deze sleutels:
{
  "answer": string,
  "quote": string | null,
  "source_label": string | null,
  "confidence": number (0.0–1.0),
  "needs_escalation": boolean,
  "escalation_reason"?: string,
  "used_sources"?: number[]
}

Regels voor "quote" en "source_label":
- "quote" mag UITSLUITEND tekst bevatten die LETTERLIJK en WOORDELIJK voorkomt in de kennisbank-fragmenten die je hieronder ontvangt. Kopieer de exacte zin(nen) — geen parafrase, geen synthese, geen combinatie.
- Als je de tekst niet letterlijk terugvindt in de fragmenten: zet "quote" op null. Verzin NOOIT een quote.
- Zet in "source_label" de naam van het brondocument (bv. "Car Policy" of "Procedures Sharepoint") — alleen als quote niet null is.
- Bij puur feitelijke data-vragen (mijn wagen, laadkosten, nummerplaat): zet beide op null.
Waar used_sources een array is van maximaal 3 indices uit de bronlijst.`;
}

function unknownFallback(): ChatResponse {
  return {
    intent: "unknown",
    title: "Niet herkend",
    message:
      "Ik kan je daar nog niet goed mee helpen. Je kan me bijvoorbeeld vragen naar je wagen, documenten, contract, laadkosten of beschikbare wagens.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

// Row returned by match_kb_chunks_hybrid (kb_sources/kb_chunks tables).
type KbChunkMatch = {
  chunk_id: string;
  source_slug: string;
  source_title: string;
  source_path: string;
  doc_type: string;
  priority: number;
  chunk_index: number;
  content: string;
  metadata: Record<string, unknown> | null;
  similarity: number;
  rrf_score: number;
};

async function retrieveKbContext(params: {
  openai: OpenAI;
  embeddingModel: string;
  userMessage: string;
  matchCount?: number;
}): Promise<{
  matches: KbChunkMatch[];
  contextBlock: string | null;
  sourcesUsed: { title: string; source_ref: string | null }[];
}> {
  const matchCount = Math.max(1, Math.min(params.matchCount ?? 6, 10));
  const q = params.userMessage.trim();
  if (!q) return { matches: [], contextBlock: null, sourcesUsed: [] };

  const emb = await params.openai.embeddings.create({
    model: params.embeddingModel,
    input: q,
  });
  const queryEmbedding = emb.data[0]?.embedding;
  if (!queryEmbedding)
    return { matches: [], contextBlock: null, sourcesUsed: [] };

  // Use service-role client because end-users don't have direct KB table access.
  const svc = createServiceRoleClient();
  if (!svc) return { matches: [], contextBlock: null, sourcesUsed: [] };

  // Hybrid search: vector (semantic) + full-text (keyword) via RRF.
  // Reads from kb_sources/kb_chunks — the canonical KB populated by ingest-kb.mjs.
  const { data, error } = await svc.rpc("match_kb_chunks_hybrid", {
    query_embedding: queryEmbedding,
    query_text: q,
    match_count: matchCount,
    rrf_k: 60,
  });
  if (error) throw error;

  const matches = (data ?? []) as KbChunkMatch[];
  if (matches.length === 0)
    return { matches: [], contextBlock: null, sourcesUsed: [] };

  const sourcesUsed = Array.from(
    new Map(
      matches.map((m) => [
        m.source_slug,
        { title: m.source_title, source_ref: m.source_path ?? null },
      ]),
    ).values(),
  );

  // Keep the injected context compact to avoid prompt bloat.
  const MAX_CONTEXT_CHARS = 9000;
  let acc = "";
  for (const m of matches) {
    const header = `[Bron: ${m.source_title} | idx=${m.chunk_index} | rrf=${m.rrf_score.toFixed(4)} | sim=${m.similarity.toFixed(3)}]\n`;
    const block = `${header}${m.content}\n\n`;
    if (acc.length + block.length > MAX_CONTEXT_CHARS) break;
    acc += block;
  }

  const contextBlock =
    "Je krijgt hieronder relevante kennisbank-fragmenten (RAG). " +
    "Gebruik deze als primaire bron. " +
    "Als je niet genoeg info hebt: zeg dat je het gaat escaleren.\n\n" +
    acc.trim();

  return { matches, contextBlock, sourcesUsed };
}

export async function generateOpenAIReply(params: {
  supabase: SupabaseClient;
  conversationId: string;
  userMessageId: string;
  userEmail: string;
  appOrigin?: string | null;
  userMessage: string;
  voornaam?: string;
  intent?: ChatIntent;
}): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return unknownFallback();
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const embeddingModel =
    process.env.OPENAI_EMBEDDING_MODEL ?? "text-embedding-3-small";
  const openai = new OpenAI({ apiKey });

  const intent = params.intent ?? "unknown";
  const temperature = INTENT_TEMPERATURES[intent] ?? 0.4;
  const usesKb = INTENT_USES_KB[intent] ?? true;

  try {
    const svc = createServiceRoleClient();

    // Handle quick follow-ups that refer to the previous KB answer.
    const followUp = params.userMessage.trim().toLowerCase();
    const isMoreDetails = followUp === "meer details";
    const isExample = followUp === "voorbeeld";
    const isPdf =
      followUp === "pdf downloaden" ||
      followUp === "pdf" ||
      followUp.endsWith(" downloaden");

    let baseQuestion = params.userMessage;
    if ((isMoreDetails || isExample || isPdf) && svc) {
      const { data: lastLog } = await svc
        .from("knowledge_queries_log")
        .select("query_text")
        .eq("conversation_id", params.conversationId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const q = typeof (lastLog as any)?.query_text === "string" ? String((lastLog as any).query_text) : "";
      if (q.trim()) baseQuestion = q.trim();
    }

    const { matches, contextBlock, sourcesUsed } = usesKb
      ? await retrieveKbContext({
          openai,
          embeddingModel,
          userMessage: baseQuestion,
          matchCount: 6,
        })
      : { matches: [], contextBlock: null, sourcesUsed: [] };

    // CTA: first public PDF source_ref.
    const pdfRef = sourcesUsed
      .map((s) => (s.source_ref ?? "").trim())
      .find((r) => r.startsWith("public/") && r.toLowerCase().endsWith(".pdf"));
    const humanizeLabelFromRef = (ref: string) => {
      const href = `/${ref.slice("public/".length)}`.replace(/\\/g, "/");
      const last = href.split("/").pop() ?? "";
      const decoded = (() => {
        try {
          return decodeURIComponent(last);
        } catch {
          return last;
        }
      })();
      const base = decoded.replace(/\.[a-z0-9]+$/i, "").trim();
      const cleaned = base
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .replace(/\(\s*\d+\s*\)\s*$/g, "")
        .trim();
      return cleaned ? `${cleaned} downloaden` : "PDF downloaden";
    };
    const cta =
      pdfRef && pdfRef.startsWith("public/")
        ? {
            label: humanizeLabelFromRef(pdfRef),
            href: `/${pdfRef.slice("public/".length)}`,
          }
        : undefined;

    if (isPdf) {
      return {
        intent: "unknown",
        title: "PDF",
        message: cta
          ? "Hier is de relevante PDF."
          : "Ik vond geen PDF-bron voor deze vraag.",
        suggestions: DEFAULT_SUGGESTIONS,
        ...(cta ? { cta } : {}),
      };
    }

    const completion = await openai.chat.completions.create({
      model,
      temperature,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: buildSystemPrompt(params.voornaam),
        },
        ...(contextBlock ? [{ role: "system" as const, content: contextBlock }] : []),
        {
          role: "user",
          content:
            `Vraag:\n${baseQuestion}\n\n` +
            (isMoreDetails
              ? "De gebruiker vraagt: geef meer details (maar blijf beknopt en praktisch).\n\n"
              : isExample
                ? "De gebruiker vraagt: geef een concreet voorbeeld.\n\n"
                : "") +
            `Bronlijst (indices):\n` +
            sourcesUsed
              .slice(0, 12)
              .map((s, i) => `[#${i}] ${s.title}${s.source_ref ? ` (${s.source_ref})` : ""}`)
              .join("\n"),
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return unknownFallback();
    }

    let parsed: {
      answer?: unknown;
      quote?: unknown;
      source_label?: unknown;
      confidence?: unknown;
      needs_escalation?: unknown;
      escalation_reason?: unknown;
      used_sources?: unknown;
    } | null = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const rawAnswer =
      typeof parsed?.answer === "string" ? parsed.answer.trim() : "";
    const quote =
      typeof parsed?.quote === "string" && parsed.quote.trim()
        ? parsed.quote.trim()
        : null;
    const sourceLabel =
      typeof parsed?.source_label === "string" && parsed.source_label.trim()
        ? parsed.source_label.trim()
        : null;

    // Append the exact KB quote to the answer so users always see the source.
    const answer = rawAnswer
      ? quote && sourceLabel
        ? `${rawAnswer}\n\n📄 **${sourceLabel}:** *"${quote}"*`
        : rawAnswer
      : "";
    const confidenceRaw =
      typeof parsed?.confidence === "number" ? parsed.confidence : 0;
    const confidence = Math.max(0, Math.min(1, confidenceRaw));
    const needsEscalation = Boolean(parsed?.needs_escalation);
    const escalationReason =
      typeof parsed?.escalation_reason === "string"
        ? parsed.escalation_reason.trim()
        : "";
    const used =
      Array.isArray(parsed?.used_sources) && parsed?.used_sources.length
        ? (parsed?.used_sources as unknown[])
            .filter((n) => Number.isInteger(n))
            .map((n) => Number(n))
            .filter((n) => n >= 0 && n < sourcesUsed.length)
            .slice(0, 3)
        : [];

    // Best-effort log.
    if (svc) {
      try {
        await svc.from("knowledge_queries_log").insert({
          conversation_id: params.conversationId,
          user_message_id: params.userMessageId,
          query_text: params.userMessage.trim(),
          retrieved_chunk_ids: matches.map((m) => m.chunk_id),
          similarity_scores: matches.map((m) => m.similarity ?? 0),
          model,
          confidence,
          escalated: needsEscalation,
        });
      } catch (e) {
        console.error("KB query log insert failed:", e);
      }
    }

    if (needsEscalation || !answer) {
      // Don't auto-escalate — ask the user for explicit consent first.
      const reason = escalationReason ||
        "Ik heb onvoldoende informatie om je vraag correct te beantwoorden.";
      return {
        intent: "unknown",
        title: "Niet zeker",
        message:
          "Ik ben niet zeker genoeg om hier meteen correct op te antwoorden. " +
          "Wil je dat ik je vraag doorstuur naar je fleet manager?" +
          (escalationReason ? `\n\nReden: ${escalationReason}` : ""),
        suggestions: DEFAULT_SUGGESTIONS,
        pendingEscalation: {
          question: params.userMessage,
          reason,
        },
      };
    }

    // Geen exacte quote gevonden → antwoord gegeven maar soft-escalatie aanbieden.
    // De medewerker krijgt het antwoord + de optie om het te laten bevestigen
    // door de fleet manager, zonder verplichte escalatie.
    const softEscalation = !quote && usesKb
      ? {
          pendingEscalation: {
            question: params.userMessage,
            reason:
              "Het antwoord is afgeleid uit de algemene Car Policy-regels, maar er is geen exacte zin gevonden die dit letterlijk bevestigt. De fleet manager kan dit definitief bevestigen.",
          },
        }
      : {};

    const softNote = !quote && usesKb
      ? '\n\n<span class="chat-soft-note">Wil je dit laten bevestigen door je fleet manager? Gebruik de knop hieronder.</span>'
      : "";

    return {
      intent: "unknown",
      title: "Antwoord",
      message: answer + softNote,
      suggestions: [
        "Meer details",
        "Voorbeeld",
        cta?.label ?? "PDF downloaden",
        ...DEFAULT_SUGGESTIONS,
      ].filter((v, i, a) => a.indexOf(v) === i),
      ...(cta ? { cta } : {}),
      ...softEscalation,
    };
  } catch (error) {
    console.error("OpenAI fleet chat error:", error);
    return unknownFallback();
  }
}
