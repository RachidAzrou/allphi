# Flow: Algemene Vragen (AI Chat)

> Bestandspaden zijn relatief t.o.v. `/src`.

## Samenvatting

Werknemer stelt een fleet-vraag in natuurlijke taal. De backend routeert deterministisch (guided flows + regex-intents). **Alleen als geen intent herkend wordt** (intent = `unknown`) en `OPENAI_API_KEY` beschikbaar is, valt het systeem terug op **OpenAI + RAG** (knowledge base). Indien onvoldoende zekerheid: **automatische escalatie** naar de **in-app fleet manager inbox** via `fleet_escalations`.

---

## Volledige flow (actuele implementatie)

```
Werknemer stelt vraag in chat (vrije tekst, optioneel met bijlagen)
        ↓
POST /api/chat
  Bestand: app/api/chat/route.ts
        ↓
[STAP 1] Persist user message
  Tables: chat_conversations + chat_messages
        ↓
[STAP 2] Guided flow actief?
  Check: flow.id in laatste assistant-meta (chat_messages.metadata.flow)
        ├─ tire_change             → handleTireChangeFlowMessage()
        ├─ lease_return_inspection → handleLeaseReturnInspectionFlowMessage()
        ├─ accident_report         → handleAccidentReportFlowMessage()
        └─ geen flow actief        → verder naar STAP 3
        ↓
[STAP 3] Intent detectie (deterministisch)
  Bestand: lib/intent/router.ts
  Mechanisme: priority-ordered regex patterns → keyword fallback → unknown
        ↓
[STAP 4] Intent handling
        ├─ Intent != unknown  → handleIntent(intent) → deterministische response (DB views + formatters of CTA/flow start)
        └─ Intent == unknown  → STAP 5 (alleen als OPENAI_API_KEY bestaat)
        ↓
[STAP 5] OpenAI + RAG (alleen bij unknown)
  Bestand: lib/openai/fleet-chat.ts
        ├─ Embedding berekenen van vraag
        ├─ kb_match_chunks RPC (min_similarity: 0.2, top_k: 6)
        ├─ Chat completion (JSON) met antwoord + confidence + needs_escalation + used_sources
        ├─ "Bronnen:" wordt toegevoegd aan de message (als tekst)
        └─ Best-effort logging in knowledge_queries_log
        ↓
[STAP 6] Automatische escalatie (in-app, geen e-mail/Teams)
  Trigger:
    - LLM: needs_escalation=true of leeg antwoord
    - Insurance: intent=insurance_certificate én geen actief voertuig
    - Accident: intent=accident_report én title="Aanrijding — Gewonden"
  Mechanisme:
    - Insert in fleet_escalations (status queued)
    - escalateFleetQuestion() vult subject/body (email is bewust uitgeschakeld)
        ↓
[STAP 7] Respons tonen aan werknemer
  UI: app/chat/page.tsx + components/*
  - Antwoordtekst
  - Suggesties
  - CTA (optioneel)
  - Bij RAG: "Bronnen:" zit al in de message-tekst (geen aparte UI-render nodig)
        ↓
[STAP 8] Logging
  - chat_messages bevat volledige user/assistant thread
  - knowledge_queries_log bevat retrieved_chunk_ids + similarity scores (RAG pad)
```

---

## Intent regels (actuele implementatie)

Bestand: `lib/intent/router.ts` — prioriteitsvolgorde (bovenste = hoogste prioriteit).

| Intent | Voorbeeldtriggers |
|---|---|
| `new_car_order` | "nieuwe wagen bestellen", "offerte uploaden", "wagen bestellen" |
| `accident_report` | "aanrijding", "ongeval", "schade melden", "glasbreuk", "parkeerschade", "vandalisme", "inbraak", "diefstal", "carglass" |
| `tire_change` | "bandenwissel", "winterbanden", "zomerbanden" |
| `lease_return_inspection` | "leasewagen inleveren", "inspectie", "contracteinde wagen" |
| `insurance_certificate` | "verzekeringsattest" |
| `charging_home_vs_public` | "thuis of publiek", "waar laad ik", "hoeveel thuis" |
| `reimbursement_status` | "terugbetaling", "openstaand bedrag", "voorgeschoten" |
| `best_range_option` | "grootste range", "rijdt het verst", "langste actieradius" |
| `allowed_options` | "welke wagens mag ik kiezen", "beschikbare opties" |
| `my_documents` | "mijn documenten", "mijn offerte" |
| `my_contract` | "mijn contract", "einddatum contract", "looptijd" |
| `my_vehicle` | "mijn wagen", "nummerplaat", "actieradius", "aandrijving" |
| `charging_summary` | "laadkosten", "hoeveel geladen", "kWh", "laadsessies" |
| `greeting` | "hallo", "hoi", "goedemorgen" |
| `unknown` | → OpenAI RAG fallback (als OPENAI_API_KEY gezet is) |

---

## Escalatie: wat gebeurt er precies (in-app inbox)

- **Table**: `fleet_escalations`
- **Helper**: `src/lib/fleet/escalate-question.ts`
  - vult `subject` + `body` + `status`
  - **stuurt geen e-mail** (bewust uitgeschakeld)
  - geen Teams integratie nodig

---

## Wat staat nog open (optioneel, als je dit wil bouwen)

### A) Chat export naar PDF

- **Nieuw endpoint**: `POST /api/chat/export-pdf` (of server action)
- **UI**: knop “Download als PDF” na AI-antwoord (RAG of andere vrije-tekst antwoorden)

### B) “AI bijleren” van fleet manager antwoorden

- Bij reply in fleet manager inbox: opslaan als nieuw KB document/chunks (incl. embedding)
- Vereist design-beslissing: governance (review), versies, audit trail

