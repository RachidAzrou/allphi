import OpenAI from "openai";
import type { ChatResponse } from "@/types/chat";
import type { KnowledgeChunkHit } from "@/lib/kb/retrieve";

const DEFAULT_SUGGESTIONS = [
  "Mijn wagen",
  "Mijn documenten",
  "Mijn laadkosten",
  "Beschikbare wagens",
  "Contractinfo",
];

type KbModelResult = {
  answer: string;
  confidence: number; // 0..1
  needs_escalation: boolean;
  escalation_reason?: string;
  used_sources?: number[]; // indices in provided sources array
};

function safeParseJson(s: string): KbModelResult | null {
  try {
    const v = JSON.parse(s);
    if (!v || typeof v !== "object") return null;
    const answer = typeof v.answer === "string" ? v.answer.trim() : "";
    const confidence =
      typeof v.confidence === "number" ? Math.max(0, Math.min(1, v.confidence)) : 0;
    const needs_escalation = Boolean(v.needs_escalation);
    const escalation_reason =
      typeof v.escalation_reason === "string" ? v.escalation_reason.trim() : undefined;
    const used_sources = Array.isArray(v.used_sources)
      ? (v.used_sources as unknown[])
          .filter((n: unknown) => Number.isInteger(n))
          .map((n: unknown) => Number(n))
      : undefined;
    if (!answer) return null;
    return { answer, confidence, needs_escalation, escalation_reason, used_sources };
  } catch {
    return null;
  }
}

function formatSourcesBlock(hits: KnowledgeChunkHit[], used?: number[]): string {
  const indices =
    used && used.length
      ? used
          .map((i) => Number(i))
          .filter((i) => i >= 0 && i < hits.length)
          .slice(0, 3)
      : [0, 1, 2].filter((i) => i < hits.length);

  const lines = indices.map((i) => {
    const h = hits[i];
    return `- ${h.title}`;
  });

  if (!lines.length) return "";
  return `\n\nBronnen:\n${lines.join("\n")}`;
}

function humanizeDownloadLabelFromHref(href: string): string {
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

  if (!cleaned) return "PDF downloaden";
  return `${cleaned} downloaden`;
}

export function deriveDownloadCta(hits: KnowledgeChunkHit[]): ChatResponse["cta"] | undefined {
  for (const h of hits) {
    const ref = (h.source_ref ?? "").trim();
    if (!ref) continue;
    // Repo-based refs: public/... -> served at /...
    if (ref.startsWith("public/")) {
      const href = `/${ref.slice("public/".length)}`.replace(/\\/g, "/");
      if (href.toLowerCase().endsWith(".pdf")) {
        return { label: humanizeDownloadLabelFromHref(href), href };
      }
    }
  }
  return undefined;
}

export async function generateKbAnswer(params: {
  userMessage: string;
  voornaam?: string;
  hits: KnowledgeChunkHit[];
}): Promise<
  | { ok: true; answer: string; confidence: number; needsEscalation: boolean; escalationReason?: string; usedSources?: number[]; cta?: ChatResponse["cta"] }
  | { ok: false }
> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return { ok: false };

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });
  const nameHint = params.voornaam ? `De gebruiker heet ${params.voornaam}.` : "";

  const sources = params.hits.map((h, i) => {
    const ref = h.source_ref?.trim() || "";
    const sim = typeof h.similarity === "number" ? h.similarity.toFixed(3) : "n/a";
    return `[#${i}] ${h.title}${ref ? ` (${ref})` : ""} — similarity=${sim}\n${h.content}`;
  });

  const system = `Je bent de Allphi Fleet Companion voor medewerkers. Antwoord kort en duidelijk in het Nederlands. ${nameHint}
Je krijgt een lijst met bronnen (knowledge base chunks). Je mag ALLEEN antwoorden op basis van die bronnen.
Als de bronnen onvoldoende zijn of de vraag te complex/ambigue is, zet needs_escalation=true.
Geef altijd een confidence score tussen 0 en 1.
Antwoord uitsluitend als JSON met exact deze keys:
{"answer": string, "confidence": number, "needs_escalation": boolean, "escalation_reason"?: string, "used_sources"?: number[]}
Waar used_sources indices zijn van de bronlijst (max 3).`;

  const user = `Vraag:\n${params.userMessage}\n\nBronnen:\n${sources.join("\n\n---\n\n")}`;

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      // Best-effort: many OpenAI models accept this, but we still parse defensively.
      response_format: { type: "json_object" },
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return { ok: false };
    const parsed = safeParseJson(text);
    if (!parsed) return { ok: false };

    return {
      ok: true,
      answer: parsed.answer,
      confidence: parsed.confidence,
      needsEscalation: parsed.needs_escalation,
      escalationReason: parsed.escalation_reason,
      usedSources: parsed.used_sources,
      cta: deriveDownloadCta(params.hits),
    };
  } catch (e) {
    console.error("OpenAI kb chat error:", e);
    return { ok: false };
  }
}

export function formatKbChatResponse(params: {
  answer: string;
  hits: KnowledgeChunkHit[];
  usedSources?: number[];
  cta?: ChatResponse["cta"];
}): ChatResponse {
  return {
    intent: "unknown",
    title: "Antwoord",
    message: params.answer.trim(),
    suggestions: [
      "Meer details",
      "Voorbeeld",
      params.cta?.label ?? "PDF downloaden",
      ...DEFAULT_SUGGESTIONS,
    ].filter((v, i, a) => a.indexOf(v) === i),
    ...(params.cta ? { cta: params.cta } : {}),
  };
}

