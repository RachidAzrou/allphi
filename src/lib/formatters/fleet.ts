import type { ChatResponse } from "@/types/chat";
import type { FleetAssistantContext } from "@/types/database";
import { eur, datum } from "./utils";

export function formatVehicleResponse(
  ctx: FleetAssistantContext | null
): ChatResponse {
  if (!ctx?.merk_model) {
    return {
      intent: "my_vehicle",
      title: "Mijn wagen",
      message:
        "Ik kon geen voertuiggegevens vinden die aan jouw profiel gekoppeld zijn. Neem contact op met je fleet manager.",
      suggestions: ["Mijn contract", "Beschikbare wagens"],
    };
  }

  const lines = [`Je rijdt momenteel met een **${ctx.merk_model}**.`];
  if (ctx.nummerplaat) lines.push(`Je nummerplaat is **${ctx.nummerplaat}**.`);
  if (ctx.aandrijving) lines.push(`De aandrijving is **${ctx.aandrijving}**.`);
  if (ctx.range_km) lines.push(`De range van je wagen is **${ctx.range_km} km**.`);

  const fields = [
    { label: "Merk / Model", value: ctx.merk_model },
    ctx.nummerplaat ? { label: "Nummerplaat", value: ctx.nummerplaat } : null,
    ctx.aandrijving ? { label: "Aandrijving", value: ctx.aandrijving } : null,
    ctx.range_km ? { label: "Range", value: `${ctx.range_km} km` } : null,
    ctx.vin ? { label: "VIN", value: ctx.vin } : null,
    ctx.afleverdatum ? { label: "Afleverdatum", value: datum(ctx.afleverdatum) } : null,
    ctx.wagen_categorie ? { label: "Categorie", value: ctx.wagen_categorie } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return {
    intent: "my_vehicle",
    title: "Mijn wagen",
    message: lines.join("\n"),
    cards: [{ type: "vehicle", title: ctx.merk_model, fields }],
    suggestions: ["Mijn contract", "Mijn documenten", "Mijn laadkosten"],
  };
}

export function formatContractResponse(
  ctx: FleetAssistantContext | null
): ChatResponse {
  if (!ctx?.contract_id) {
    return {
      intent: "my_contract",
      title: "Contractinfo",
      message:
        "Ik kon geen contractgegevens vinden voor jouw profiel. Neem contact op met je fleet manager.",
      suggestions: ["Mijn wagen", "Beschikbare wagens"],
    };
  }

  const lines = [`Hier zijn je contractgegevens:`];
  if (ctx.contract_id) lines.push(`Contractnummer: **${ctx.contract_id}**`);
  if (ctx.goedkeuringsstatus) lines.push(`De goedkeuringsstatus is **${ctx.goedkeuringsstatus}**.`);
  if (ctx.contracteinddatum) lines.push(`Je contract loopt tot **${datum(ctx.contracteinddatum)}**.`);

  const fields = [
    { label: "Contractnummer", value: ctx.contract_id },
    ctx.goedkeuringsstatus ? { label: "Goedkeuring", value: ctx.goedkeuringsstatus } : null,
    ctx.contracteinddatum ? { label: "Einddatum", value: datum(ctx.contracteinddatum) } : null,
    ctx.tco_plafond ? { label: "TCO-plafond", value: eur(ctx.tco_plafond) } : null,
    ctx.optiebudget ? { label: "Optiebudget", value: eur(ctx.optiebudget) } : null,
    ctx.leasingmaatschappij ? { label: "Leasingmaatschappij", value: ctx.leasingmaatschappij } : null,
    ctx.wagen_categorie ? { label: "Categorie", value: ctx.wagen_categorie } : null,
    ctx.merk_model ? { label: "Wagen", value: ctx.merk_model } : null,
  ].filter(Boolean) as { label: string; value: string }[];

  return {
    intent: "my_contract",
    title: "Contractinfo",
    message: lines.join("\n"),
    cards: [{ type: "contract", title: "Contract " + ctx.contract_id, fields }],
    suggestions: ["Mijn wagen", "Mijn documenten", "Beschikbare wagens"],
  };
}

export function formatDocumentsResponse(
  rows: FleetAssistantContext[]
): ChatResponse {
  if (!rows || rows.length === 0) {
    return {
      intent: "my_documents",
      title: "Documenten",
      message: "Er zijn momenteel geen documenten beschikbaar voor jouw wagen.",
      suggestions: ["Mijn wagen", "Mijn contract"],
    };
  }

  const docs = rows.filter((r) => r.document_type);
  if (docs.length === 0) {
    return {
      intent: "my_documents",
      title: "Documenten",
      message: "Er zijn momenteel geen documenten beschikbaar voor jouw wagen.",
      suggestions: ["Mijn wagen", "Mijn contract"],
    };
  }

  const lines = [`Je beschikbare documenten voor je wagen:`];
  for (const d of docs) {
    lines.push(`- **${d.document_type}**`);
  }

  const cards = docs.map((d) => ({
    type: "document" as const,
    title: d.document_type ?? "Document",
    fields: [
      { label: "Type", value: d.document_type ?? "—" },
      d.document_url ? { label: "Link", value: d.document_url } : null,
      d.merk_model ? { label: "Wagen", value: d.merk_model } : null,
    ].filter(Boolean) as { label: string; value: string }[],
  }));

  return {
    intent: "my_documents",
    title: "Documenten",
    message: lines.join("\n"),
    cards,
    suggestions: ["Mijn wagen", "Mijn contract"],
  };
}
