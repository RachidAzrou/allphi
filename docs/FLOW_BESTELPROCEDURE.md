# Flow: Bestelprocedure Nieuwe Wagen

> Bestandspaden zijn relatief t.o.v. `/src`.

## Samenvatting

De bestelprocedure is geïmplementeerd als een **wizard** die een `wagen_bestellingen` dossier aanmaakt en een `payload` (wizard state) persisteert. De flow bevat:

- **Medewerker-flow**: context → modelkeuze → offerte upload → automatische checks → (optioneel) bijdrage-PDF + ondertekening → indienen voor goedkeuring.
- **Approver-flow (Fleet/Management)**: goedkeuren/afkeuren → status wordt `approved` zodra beide approvals aanwezig zijn → optioneel markeren als `ordered` en `delivered`.

De stappen `waiting` en `delivery` bestaan als types, maar hebben **(nog) geen UI-sectie** in de wizard (wel kan een approver vandaag al “markeer als besteld/geleverd”).

---

## Data model (actuele implementatie)

### Tables

- `wagen_bestellingen`
  - `status`: `draft | submitted | approved | rejected | ordered | delivered`
  - `payload`: JSON met `WagenBestelState` (zie `types/wagen-bestelling.ts`)
  - reporting velden die de wizard synchroniseert:
    - `offer_storage_path`, `offer_uploaded_at`
    - `offer_validation` (issues + modelAllowed + validatedAt)
    - `overspend_amount_eur`, `personal_contribution_amount_eur`
    - `contribution_doc_path`, `contribution_doc_generated_at`
    - `contribution_signature`, `contribution_signed_at`
    - `fleet_approved_at`, `management_approved_at`, `approval_note`, …
- `wagen_bestelling_events` (audit trail van approve/reject/mark acties)

### Storage buckets

- `wagen-offertes`: upload van dealer-offertes (door medewerker) via client-side upload
- `wagen-bijdrage-docs`: gegenereerde bijdrage-PDF + “stamping” van handtekening

---

## Wizard entry points (UI)

- Index: `app/wagen-bestellen/page.tsx` → `WagenBestellenIndexClient`
  - maakt een nieuw `wagen_bestellingen` dossier (status `draft`) met `createInitialWagenBestelState()`
  - opent direct het dossier `/wagen-bestellen/[id]`
- Wizard: `app/wagen-bestellen/[id]/wizard-client.tsx` + `components/wagen-bestellen/wagen-bestel-wizard.tsx`
  - laadt row + payload
  - persisteert payload bij elke stap via `.update({ payload: next })`

---

## Wizard stappen (actuele UI + backend gedrag)

> De stap-id’s komen uit `types/wagen-bestelling.ts`.

### Stap 1 — `preorder_context` (UI ✅, inhoud beperkt)

Bestand: `components/wagen-bestellen/wagen-bestel-wizard.tsx`

Toont vandaag:
- categorie (`wagen_categorie`) + optiebudget + leasingmaatschappij (via `v_fleet_assistant_context`)

**Gaps t.o.v. je document**:
- EV-only regel / verplichte opties / trekhaakregels worden in de UI tekstueel aangekondigd, maar er is geen uitgewerkte module met toggles/regels.

### Stap 2 — `model_choice` (UI ✅, dealer dropdown ❌)

Bestand: `components/wagen-bestellen/wagen-bestel-wizard.tsx`

Input velden:
- `merkModel` (vrij tekstveld)
- `dealer` (vrij tekstveld, optioneel)
- `offerTotalEur` (numeriek, voor budget-check)

**Gap**:
- geen officiële dealer dropdown (geen `lib/data/dealers.ts` wiring).

### Stap 3 — `offer_upload` (UI ✅)

Bestand: `components/wagen-bestellen/offerte-upload.tsx`

- upload naar bucket `wagen-offertes` op pad `{user.id}/{bestellingId}/{timestamp}-{filename}`
- na upload:
  - wizard zet `state.offer.*`
  - wizard zet ook DB columns `offer_storage_path`, `offer_uploaded_at`
  - wizard gaat naar stap `auto_checks`

**Gap**:
- er wordt **geen e-mail** gestuurd naar `fleet@allphi.eu` (niet geïmplementeerd).

### Stap 4 — `auto_checks` (UI ✅ + endpoint ✅)

- UI knop “Voer checks uit”
- Endpoint: `POST /api/wagen-bestellen/[id]/validate-offerte`

Checks (actuele logica):
- **model**: moet `merkModel` of `catalogId` bevatten
- **price**: `offerTotalEur` > 0
- **allowed options (best effort)**: vergelijkt `catalogId` of `merkModel` tegen `v_allowed_vehicle_options` voor deze user
- **overspend**:
  - haalt `optiebudget` uit `v_fleet_assistant_context`
  - `overspend = max(0, offerTotalEur - optiebudget)`
- **threshold**:
  - `company_profile.car_order_overspend_threshold_eur` (fallback 3000)
  - als `overspend > threshold` dan `contributionAmountEur = overspend` anders 0

> Dit wijkt af van “min(overschrijding, 3000)”: in de huidige code is de bijdrage **alles** boven de threshold zodra je erover gaat.

### Stap 5 — `contribution_sign` (UI ✅ + endpoints ✅)

Wanneer `contributionAmountEur > 0`:

- bijdrage-PDF genereren:
  - Endpoint: `POST /api/wagen-bestellen/[id]/generate-bijdrage-pdf`
  - upload naar bucket `wagen-bijdrage-docs` op `{user.id}/{id}/bijdrage.pdf`
  - update `wagen_bestellingen.contribution_doc_path` + timestamp
- ondertekenen:
  - UI gebruikt `SignaturePad`
  - Endpoint: `POST /api/wagen-bestellen/[id]/sign-bijdrage`
    - downloadt pdf uit `wagen-bijdrage-docs`
    - embed signature image in een vaste “signature box”
    - uploadt terug (upsert)
    - update `contribution_signature` + `contribution_signed_at`

### Stap 6 — `submit_for_approval` (UI ✅)

- UI knop “Indienen voor goedkeuring”
- DB update: `wagen_bestellingen.status = submitted`

### Stap 7 — `waiting` (type ✅, UI ❌)

Bestaat in `types/wagen-bestelling.ts` maar heeft vandaag geen UI-sectie in de wizard.

Opmerking:
- in je aangeleverde flow staat `chargerOfferPath`, maar dit veld bestaat vandaag niet in `WagenBestelState.waiting`.

### Stap 8 — `delivery` (type ✅, UI ❌)

Bestaat in `types/wagen-bestelling.ts` maar heeft vandaag geen UI-sectie in de wizard.

---

## Goedkeuring & status (Fleet/Management)

### Approver actions (endpoint ✅)

Endpoint: `POST /api/wagen-bestellen/[id]/approve`

Actions:
- `approve_fleet` (alleen role `fleet_manager`)
- `approve_management` (alleen role `management`)
- `reject`
- `mark_ordered`
- `mark_delivered`

Logica:
- zodra zowel `fleet_approved_at` als `management_approved_at` gezet zijn, wordt `status = approved` (tenzij rejected).
- elke actie schrijft een event in `wagen_bestelling_events`.

### UI

- `components/wagen-bestellen/approval-timeline.tsx` toont statuslijn
- `components/wagen-bestellen/wagen-bestel-wizard.tsx` toont approver knoppen als role `fleet_manager|management`

---

## Wat staat nog open (zoals in je flow, maar nu correct gescope’d)

### A) Dealer dropdown + officiële dealer lijst

- Nieuwe data: `lib/data/dealers.ts`
- UI-aanpassing in `model_choice` stap om merk/dealer te laten kiezen + details tonen.

### B) Trekhaak module

- Uitklapbare sectie in `preorder_context` met toggle + gewicht keuze + waarschuwingen.
- Persist naar `state.model` (extra veld) + eventueel extra checks.

### C) Wachttijd (waiting) UI + laadpunt checklist

- UI-sectie toevoegen in wizard + uitbreiden van state met `chargerOfferPath` (en storage bucket voor Stroohm-offerte).
- Notificatie naar Fleet (mechanisme moet nog bepaald worden; er is nog geen “wagen-bestelling escalations” pipeline zoals bij chat).

### D) Leveringsstap UI

- UI + rolgebaseerde acties (fleet/medewerker inputs), i.p.v. enkel “mark delivered”.

### E) Automatisch mailen naar `fleet@allphi.eu`

- Niet aanwezig vandaag.
- Als je dit wil: implementeren in `validate-offerte` of bij “submit_for_approval” met een echte mail provider of bestaande in-app inbox.

