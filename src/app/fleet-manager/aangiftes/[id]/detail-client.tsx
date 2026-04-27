"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Copy, FileText, Paperclip } from "lucide-react";
import { TbCarCrash, TbUser } from "react-icons/tb";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { cn } from "@/lib/utils";
import { FLEET_INBOX_POLL_EVENT } from "@/lib/fleet/escalation-status";

type DetailPayload =
  | {
      ok: true;
      aangifte: {
        id: string;
        status: string;
        created_at: string;
        updated_at: string;
        email_status: string | null;
        medewerker_id: number | null;
        payload: unknown;
        fleet_unread: boolean;
        fleet_read_at: string | null;
      };
      medewerker: Record<string, unknown> | null;
      vehicleContextRows: Record<string, unknown>[];
    }
  | { ok?: false; error?: string };

function safeString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function value(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") {
    const s = v.trim();
    return s ? s : null;
  }
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "boolean") return v ? "Ja" : "Nee";
  return null;
}

function Row({ label, v }: { label: string; v: unknown }) {
  const s = value(v);
  return (
    <div className="grid grid-cols-1 gap-1.5 py-2 sm:grid-cols-[14rem_1fr] sm:gap-3">
      <div className="text-[12px] font-semibold text-muted-foreground">{label}</div>
      <div className="min-w-0 text-[14px] text-foreground">{s ?? "—"}</div>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <h3 className="font-heading flex items-center gap-2 text-[15px] font-semibold text-foreground">
        {icon ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-border bg-muted/30 text-primary shadow-sm" aria-hidden>
            {icon}
          </span>
        ) : null}
        {title}
      </h3>
      <div className="mt-3 divide-y divide-border/60">{children}</div>
    </section>
  );
}

function pickBasics(payload: unknown) {
  const p = (payload ?? {}) as Record<string, unknown>;
  const location = (p.location ?? {}) as Record<string, unknown>;
  const partyA = (p.partyA ?? {}) as Record<string, unknown>;
  const bestuurder = (partyA.bestuurder ?? {}) as Record<string, unknown>;
  const voertuig = (partyA.voertuig ?? {}) as Record<string, unknown>;
  const verzekering = (partyA.verzekering ?? {}) as Record<string, unknown>;

  return {
    datum: safeString(location.datum).trim(),
    stad: safeString(location.stad).trim(),
    bestuurderNaam: [
      safeString(bestuurder.voornaam).trim(),
      safeString(bestuurder.naam).trim(),
    ]
      .filter(Boolean)
      .join(" "),
    bestuurderEmail: safeString(bestuurder.email).trim(),
    nummerplaat: safeString(voertuig.nummerplaat).trim(),
    merkModel: safeString(voertuig.merkModel).trim(),
    verzekeraar: safeString(verzekering.maatschappij).trim(),
    polis: safeString(verzekering.polisnummer).trim(),
  };
}

function formatTimestamp(ts: string) {
  try {
    return new Intl.DateTimeFormat("nl-BE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return ts;
  }
}

function shortId(id: string): string {
  const s = (id ?? "").trim();
  if (!s) return "—";
  if (s.length <= 16) return s;
  return `${s.slice(0, 8)}…${s.slice(-4)}`;
}

export function FleetManagerAangifteDetailClient(props: { userEmail: string; userDisplayName: string }) {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailPayload | null>(null);
  const [tab, setTab] = useState<"medewerker" | "wagen" | "bijlagen">("medewerker");
  const [repairBusy, setRepairBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/fleet-manager/aangiftes/${encodeURIComponent(id)}`, {
        credentials: "same-origin",
      });
      const json = (await res.json()) as DetailPayload;
      if (!res.ok || !json || (json as { ok?: boolean }).ok !== true) {
        throw new Error((json as { error?: string }).error ?? "load_failed");
      }
      setDetail(json);

      // mark read (best-effort)
      void fetch("/api/fleet-manager/aangiftes/mark-read", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ id }),
      }).then(() => {
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(FLEET_INBOX_POLL_EVENT));
        }
      });
    } catch (e) {
      console.error(e);
      setError("Kon dossier niet laden.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    void load();
  }, [id, load]);

  const aangifte =
    detail && (detail as { ok?: boolean }).ok === true
      ? (detail as Extract<DetailPayload, { ok: true }>).aangifte
      : null;

  const dossierId = aangifte?.id ?? id;
  const dossierIdShort = useMemo(() => shortId(dossierId), [dossierId]);

  const basics = useMemo(() => pickBasics(aangifte?.payload), [aangifte?.payload]);

  const pdfHref = useMemo(
    () => `/api/fleet-manager/aangiftes/${encodeURIComponent(dossierId)}/pdf?dl=1`,
    [dossierId],
  );

  const medewerker = useMemo(() => {
    if (!detail || (detail as { ok?: boolean }).ok !== true) return null;
    return (detail as Extract<DetailPayload, { ok: true }>).medewerker ?? null;
  }, [detail]);

  const vehicleRows = useMemo(() => {
    if (!detail || (detail as { ok?: boolean }).ok !== true) return [];
    const rows = (detail as Extract<DetailPayload, { ok: true }>).vehicleContextRows;
    return Array.isArray(rows) ? rows : [];
  }, [detail]);

  const vehicle = useMemo(() => {
    // view can have multiple rows (documents join). We show the first row as "vehicle main",
    // and keep full rows list available if needed.
    return vehicleRows[0] ?? null;
  }, [vehicleRows]);

  const canRepairLinks = useMemo(() => {
    if (!aangifte) return false;
    return !medewerker || !vehicle;
  }, [aangifte, medewerker, vehicle]);

  const copyDossierId = useCallback(async () => {
    const v = (dossierId ?? "").trim();
    if (!v) return;
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(v);
      } else if (typeof document !== "undefined") {
        const el = document.createElement("textarea");
        el.value = v;
        el.setAttribute("readonly", "true");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        el.remove();
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch (e) {
      console.error("[fleet] copy dossier id failed", e);
      setCopied(false);
    }
  }, [dossierId]);

  const repairLinks = useCallback(async () => {
    if (!id || repairBusy) return;
    setRepairBusy(true);
    try {
      const res = await fetch(
        `/api/fleet-manager/aangiftes/${encodeURIComponent(id)}/backfill-links`,
        { method: "POST", credentials: "same-origin" },
      );
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok !== true) throw new Error(json.error ?? "repair_failed");
      await load();
    } finally {
      setRepairBusy(false);
    }
  }, [id, repairBusy, load]);

  const TabButton = (p: { id: typeof tab; label: string; icon: React.ReactNode }) => {
    const active = p.id === tab;
    return (
      <button
        type="button"
        onClick={() => setTab(p.id)}
        className={cn(
          "inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2 text-[14px] font-semibold transition-[background-color,color,transform] active:scale-[0.99]",
          active
            ? "bg-background text-foreground shadow-sm"
            : "bg-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        <span className={cn("shrink-0", active ? "text-primary" : "text-muted-foreground")} aria-hidden>
          {p.icon}
        </span>
        {p.label}
      </button>
    );
  };

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader
        userEmail={props.userEmail}
        userDisplayName={props.userDisplayName}
        showFleetManagerNav
      />

      {loading ? (
        <LoadingState subtitle="We halen het dossier op…" />
      ) : error ? (
        <main className="app-page-shell app-page-shell-wide">
          <ErrorState onRetry={() => void load()} message={error} />
        </main>
      ) : !aangifte ? (
        <main className="app-page-shell app-page-shell-wide">
          <ErrorState onRetry={() => void load()} message="Dossier niet gevonden." />
        </main>
      ) : (
        <main className="app-page-shell app-page-shell-wide">
          <header className="pt-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm"
                    aria-hidden="true"
                  >
                    <TbCarCrash className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h1 className="font-heading truncate text-[1.25rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.5rem]">
                      Dossier {dossierIdShort}
                    </h1>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
                      <span className="truncate">
                        {basics.stad || "—"} • {basics.datum || "—"} • {basics.nummerplaat || "—"}
                      </span>
                      <span className="text-muted-foreground/50">·</span>
                      <span className="font-mono break-all text-muted-foreground/80">{dossierId}</span>
                      <button
                        type="button"
                        onClick={() => void copyDossierId()}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                          copied
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            : "border-border bg-card text-muted-foreground hover:bg-muted/40",
                        )}
                        aria-label="Kopieer dossier ID"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        {copied ? "Gekopieerd" : "Kopieer"}
                      </button>
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-sm leading-snug text-muted-foreground">
                  Laatst bijgewerkt: {formatTimestamp(aangifte.updated_at)}
                  {aangifte.email_status ? ` • Email: ${aangifte.email_status}` : ""}
                </p>
              </div>
              <Link
                href="/fleet-manager/aangiftes"
                className="rounded-full border border-border bg-card px-3 py-1.5 text-[13px] font-semibold text-muted-foreground shadow-sm hover:bg-muted/40"
              >
                Terug
              </Link>
            </div>
            {canRepairLinks ? (
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => void repairLinks()}
                  disabled={repairBusy}
                  className="rounded-xl border border-border bg-card px-4 py-2 text-[13px] font-semibold text-foreground shadow-sm hover:bg-muted/40 disabled:opacity-60"
                >
                  {repairBusy ? "Herstellen…" : "Herstel koppeling (medewerker/wagen)"}
                </button>
              </div>
            ) : null}
          </header>

          <section className="mt-6">
            <div
              role="tablist"
              aria-label="Dossier tabs"
              className="flex w-full items-center gap-1 rounded-2xl border border-border bg-muted/30 p-1 shadow-sm"
            >
              <TabButton id="medewerker" label="Medewerker" icon={<TbUser className="h-4 w-4" />} />
              <TabButton id="wagen" label="Wagen" icon={<TbCarCrash className="h-4 w-4" />} />
              <TabButton id="bijlagen" label="Bijlagen" icon={<Paperclip className="h-4 w-4" strokeWidth={2} />} />
            </div>

            <div className="mt-4">
              {tab === "medewerker" ? (
                <div className="space-y-3">
                  <Section title="Medewerker" icon={<TbUser className="h-4 w-4" aria-hidden />}>
                    <Row label="ID" v={medewerker?.id} />
                    <Row label="Extern nummer" v={medewerker?.extern_nummer} />
                    <Row label="Voornaam" v={medewerker?.voornaam} />
                    <Row label="Naam" v={medewerker?.naam} />
                    <Row label="Email" v={medewerker?.emailadres} />
                    <Row label="Telefoon" v={medewerker?.telefoonnummer} />
                    <Row label="Rol" v={medewerker?.rol} />
                    <Row label="Categorie wagen" v={medewerker?.categorie_wagen} />
                    <Row label="Geboortedatum" v={medewerker?.geboortedatum} />
                  </Section>
                  <Section title="Adres" icon={<FileText className="h-4 w-4" strokeWidth={2} aria-hidden />}>
                    <Row label="Straat" v={medewerker?.straat} />
                    <Row label="Huisnummer" v={medewerker?.huisnummer} />
                    <Row label="Bus" v={medewerker?.bus} />
                    <Row label="Postcode" v={medewerker?.postcode} />
                    <Row label="Stad" v={medewerker?.stad} />
                    <Row label="Land" v={medewerker?.land} />
                  </Section>
                </div>
              ) : tab === "wagen" ? (
                <div className="space-y-3">
                  <Section title="Wagen" icon={<TbCarCrash className="h-4 w-4" aria-hidden />}>
                    <Row label="Nummerplaat" v={vehicle?.nummerplaat} />
                    <Row label="Merk/model" v={vehicle?.merk_model} />
                    <Row label="VIN" v={vehicle?.vin} />
                    <Row label="Categorie" v={vehicle?.wagen_categorie} />
                    <Row label="Leasingmaatschappij" v={vehicle?.leasingmaatschappij} />
                    <Row label="Afleverdatum" v={vehicle?.afleverdatum} />
                    <Row label="Contract einddatum" v={vehicle?.contracteinddatum} />
                  </Section>
                  <Section title="Verzekering" icon={<FileText className="h-4 w-4" strokeWidth={2} aria-hidden />}>
                    <Row label="Maatschappij" v={vehicle?.insurance_company} />
                    <Row label="Polisnummer" v={vehicle?.policy_number} />
                    <Row label="Groene kaart nr." v={vehicle?.green_card_number} />
                    <Row label="Geldig van" v={vehicle?.green_card_valid_from} />
                    <Row label="Geldig tot" v={vehicle?.green_card_valid_to} />
                  </Section>
                  <Section title="Contract" icon={<FileText className="h-4 w-4" strokeWidth={2} aria-hidden />}>
                    <Row label="Contract ID" v={vehicle?.contract_id} />
                    <Row label="TCO plafond" v={vehicle?.tco_plafond} />
                    <Row label="Optiebudget" v={vehicle?.optiebudget} />
                    <Row label="Goedkeuringsstatus" v={vehicle?.goedkeuringsstatus} />
                  </Section>
                </div>
              ) : (
                <div className="space-y-3">
                  <Section title="Bijlagen" icon={<Paperclip className="h-4 w-4" strokeWidth={2} aria-hidden />}>
                    <div className="py-2">
                      <a
                        href={pdfHref}
                        target="_blank"
                        rel="noreferrer"
                        className="stitch-btn-primary inline-flex h-11 items-center justify-center rounded-xl px-4 text-[14px] font-semibold shadow-sm transition-[filter,transform] hover:brightness-105"
                      >
                        Download PDF (incl. foto’s)
                      </a>
                      <p className="mt-2 text-[13px] text-muted-foreground">
                        De PDF bevat het aanrijdingsformulier + extra pagina’s met de bijgevoegde foto’s.
                      </p>
                    </div>
                    <div className="py-2">
                      <div className="overflow-hidden rounded-2xl border border-border bg-muted/10">
                        <iframe
                          title="PDF preview"
                          src={pdfHref.replace("dl=1", "dl=0")}
                          className="h-[70vh] w-full"
                        />
                      </div>
                    </div>
                  </Section>
                </div>
              )}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

