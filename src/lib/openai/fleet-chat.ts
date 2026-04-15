import OpenAI from "openai";
import type { ChatResponse } from "@/types/chat";

const DEFAULT_SUGGESTIONS = [
  "Mijn wagen",
  "Mijn documenten",
  "Mijn laadkosten",
  "Beschikbare wagens",
  "Contractinfo",
];

function unknownFallback(): ChatResponse {
  return {
    intent: "unknown",
    title: "Niet herkend",
    message:
      "Ik kan je daar nog niet goed mee helpen. Je kan me bijvoorbeeld vragen naar je wagen, documenten, contract, laadkosten of beschikbare wagens.",
    suggestions: DEFAULT_SUGGESTIONS,
  };
}

export async function generateOpenAIReply(params: {
  userMessage: string;
  voornaam?: string;
}): Promise<ChatResponse> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return unknownFallback();
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  const openai = new OpenAI({ apiKey });

  const nameHint = params.voornaam
    ? `De gebruiker heet ${params.voornaam}.`
    : "";

  try {
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.6,
      messages: [
        {
          role: "system",
          content: `Je bent de Allphi Fleet Companion voor medewerkers. Antwoord kort en duidelijk in het Nederlands. ${nameHint}
Je helpt met vragen over bedrijfswagens, contracten, documenten, laadkosten en terugbetaling. Als een vraag niet over fleet gaat, geef dan een kort nuttig antwoord of verwijs vriendelijk naar support of HR.
Noem geen interne systemen of API-keys. Gebruik maximaal een paar korte alinea's.
Als de gebruiker meldt een verkeersongeval, aanrijding, botsing of schade na een conflict met een ander voertuig: wees kort empathisch, zeg dat ze in deze app via het menu-item "Ongeval melden" (of de pagina /ongeval) de ongeval-wizard kunnen openen om een Europees aanrijdingsformulier stap voor stap in te vullen. Leg niet uit dat dit technisch een wizard is tenzij gevraagd.
Als het bericht een sectie [Bijlagen] met links bevat, zijn die bestanden ontvangen; zeg dan niet dat de upload is mislukt. Alleen als er expliciet "(upload niet gelukt)" bij een bestand staat, kun je vriendelijk vragen om opnieuw te proberen of de inhoud te beschrijven.`,
        },
        { role: "user", content: params.userMessage },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) {
      return unknownFallback();
    }

    return {
      intent: "unknown",
      title: "Antwoord",
      message: text,
      suggestions: DEFAULT_SUGGESTIONS,
    };
  } catch (error) {
    console.error("OpenAI fleet chat error:", error);
    return unknownFallback();
  }
}
