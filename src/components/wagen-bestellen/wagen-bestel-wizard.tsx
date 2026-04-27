"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import type { WagenBestelState, WagenBestellingStatus } from "@/types/wagen-bestelling";
import { WizardShell } from "./wizard-shell";
import { OfferteUpload, type UploadedOffer } from "./offerte-upload";
import { ApprovalTimeline } from "./approval-timeline";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SignaturePad } from "@/components/ongeval/signature-pad";

type FleetContext = {
  wagen_categorie?: string | null;
  optiebudget?: number | null;
  optiebudget_a?: number | null;
  optiebudget_b?: number | null;
  optiebudget_c?: number | null;
  tco_plafond?: number | null;
  leasingmaatschappij?: string | null;
};

function formatEur(v: number | null | undefined): string {
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat("nl-BE", { style: "currency", currency: "EUR" }).format(v);
}

export function WagenBestelWizard({
  bestellingId,
  status,
  state,
  onChange,
  onRequestClose,
  onRefresh,
}: {
  bestellingId: string;
  status: WagenBestellingStatus;
  state: WagenBestelState;
  onChange: (next: WagenBestelState) => Promise<void>;
  onRequestClose: () => void;
  onRefresh: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [ctx, setCtx] = useState<FleetContext | null>(null);
  const [ctxLoading, setCtxLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [role, setRole] = useState<"medewerker" | "fleet_manager" | "management">("medewerker");
  const [approvalNote, setApprovalNote] = useState("");
  const [approving, setApproving] = useState(false);

  const loadContext = useCallback(async () => {
    setCtxLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase
        .from("v_fleet_assistant_context")
        .select("wagen_categorie,optiebudget,optiebudget_a,optiebudget_b,optiebudget_c,tco_plafond,leasingmaatschappij")
        .ilike("emailadres", user.email)
        .order("wagen_categorie", { ascending: true })
        .limit(1)
        .maybeSingle();
      setCtx((data as FleetContext | null) ?? null);
    } catch (e) {
      console.error(e);
    } finally {
      setCtxLoading(false);
    }
  }, [supabase]);

  const loadRole = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;
      const { data } = await supabase
        .from("medewerkers")
        .select("role")
        .ilike("emailadres", user.email)
        .maybeSingle();
      const r = (data as { role?: string } | null)?.role;
      if (r === "fleet_manager" || r === "management") setRole(r);
      else setRole("medewerker");
    } catch (e) {
      console.error(e);
    }
  }, [supabase]);

  const go = useCallback(
    async (step: WagenBestelState["step"]) => {
      await onChange({ ...state, step });
    },
    [onChange, state],
  );

  const setModelField = useCallback(
    async (patch: Partial<WagenBestelState["model"]>) => {
      await onChange({ ...state, model: { ...state.model, ...patch } });
    },
    [onChange, state],
  );

  const onOfferUploaded = useCallback(
    async (u: UploadedOffer) => {
      const next: WagenBestelState = {
        ...state,
        offer: { storagePath: u.storagePath, filename: u.filename, uploadedAt: u.uploadedAt },
        step: "auto_checks",
      };
      await onChange(next);
      // Keep DB columns in sync for easier querying/reporting.
      const { error } = await supabase
        .from("wagen_bestellingen")
        .update({
          offer_storage_path: u.storagePath,
          offer_uploaded_at: u.uploadedAt,
        })
        .eq("id", bestellingId);
      if (error) console.error(error);
    },
    [bestellingId, onChange, state, supabase],
  );

  const submitForApproval = useCallback(async () => {
    setBusy(true);
    try {
      const { error } = await supabase
        .from("wagen_bestellingen")
        .update({ status: "submitted" })
        .eq("id", bestellingId);
      if (error) throw error;
      toast.success("Ingediend voor goedkeuring.");
      onRefresh();
    } catch (e) {
      console.error(e);
      toast.error("Kon niet indienen.");
    } finally {
      setBusy(false);
    }
  }, [bestellingId, onRefresh, supabase]);

  const runValidation = useCallback(async () => {
    setValidating(true);
    try {
      const res = await fetch(`/api/wagen-bestellen/${bestellingId}/validate-offerte`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as
        | {
            ok: true;
            issues: Array<{ code: string; message: string }>;
            overspendAmountEur: number | null;
            contributionAmountEur: number | null;
          }
        | { ok: false; error: string };
      if (!res.ok || !("ok" in data) || data.ok === false) {
        toast.error(("error" in data && data.error) || "Validatie mislukt.");
        return;
      }
      await onChange({
        ...state,
        checks: {
          validatedAt: new Date().toISOString(),
          ok: data.issues.length === 0,
          issues: data.issues,
          overspendAmountEur: data.overspendAmountEur,
          contributionAmountEur: data.contributionAmountEur,
        },
      });
      toast.success(data.issues.length === 0 ? "Offerte OK." : "Checks afgerond.");
    } catch (e) {
      console.error(e);
      toast.error("Validatie mislukt.");
    } finally {
      setValidating(false);
    }
  }, [bestellingId, onChange, state]);

  const generateContributionPdf = useCallback(async () => {
    setPdfBusy(true);
    try {
      const res = await fetch(`/api/wagen-bestellen/${bestellingId}/generate-bijdrage-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = (await res.json()) as { ok: true; path: string } | { ok: false; error: string };
      if (!res.ok || !data.ok) {
        toast.error(("error" in data && data.error) || "Kon PDF niet genereren.");
        return;
      }
      await onChange({
        ...state,
        contribution: {
          ...state.contribution,
          required: true,
          docPath: data.path,
          generatedAt: new Date().toISOString(),
        },
      });
      toast.success("Bijdrage-document gegenereerd.");
      onRefresh();
    } catch (e) {
      console.error(e);
      toast.error("Kon PDF niet genereren.");
    } finally {
      setPdfBusy(false);
    }
  }, [bestellingId, onChange, onRefresh, state]);

  const step = state.step;
  const shouldHaveCtx = step === "preorder_context" || step === "model_choice";

  useEffect(() => {
    if (!shouldHaveCtx) return;
    if (ctx || ctxLoading) return;
    void loadContext();
  }, [ctx, ctxLoading, loadContext, shouldHaveCtx]);

  useEffect(() => {
    if (role !== "medewerker") return;
    void loadRole();
  }, [loadRole, role]);

  const overspend = state.checks.overspendAmountEur ?? null;
  const contribution = state.checks.contributionAmountEur ?? null;
  const contributionRequired = Boolean(contribution && contribution > 0);
  const isApprover = role === "fleet_manager" || role === "management";

  const approveAction = useCallback(
    async (action: "approve_fleet" | "approve_management" | "reject" | "mark_ordered" | "mark_delivered") => {
      setApproving(true);
      try {
        const res = await fetch(`/api/wagen-bestellen/${bestellingId}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, note: approvalNote }),
        });
        const data = (await res.json()) as { ok: true } | { ok: false; error: string };
        if (!res.ok || !data.ok) {
          toast.error(("error" in data && data.error) || "Kon niet updaten.");
          return;
        }
        toast.success("Status bijgewerkt.");
        setApprovalNote("");
        onRefresh();
      } catch (e) {
        console.error(e);
        toast.error("Kon niet updaten.");
      } finally {
        setApproving(false);
      }
    },
    [approvalNote, bestellingId, onRefresh],
  );

  return (
    <WizardShell
      title="Nieuwe wagen bestellen"
      subtitle="Van modelkeuze tot goedkeuring — stap voor stap."
      onRequestClose={onRequestClose}
      footer={
        <div className="space-y-2">
          <Button type="button" variant="outline" onClick={onRequestClose} className="h-11 w-full rounded-xl">
            Terug naar chat
          </Button>
        </div>
      }
    >
      <ApprovalTimeline status={status} />

      {isApprover ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-foreground">Goedkeuring (Fleet/Management)</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Alleen zichtbaar voor fleet managers/management.
          </p>
          <label className="mt-3 block text-[12.5px] font-semibold text-foreground">
            Opmerking (optioneel)
            <input
              value={approvalNote}
              onChange={(e) => setApprovalNote(e.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px]"
              placeholder="bv. graag trekhaak bevestigen"
            />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {role === "fleet_manager" ? (
              <Button
                type="button"
                disabled={approving}
                onClick={() => void approveAction("approve_fleet")}
                className="h-11 rounded-xl"
              >
                Fleet: goedkeuren
              </Button>
            ) : (
              <Button
                type="button"
                disabled={approving}
                onClick={() => void approveAction("approve_management")}
                className="h-11 rounded-xl"
              >
                Management: goedkeuren
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={approving}
              onClick={() => void approveAction("reject")}
              className="h-11 rounded-xl"
            >
              Afkeuren
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={approving}
              onClick={() => void approveAction("mark_ordered")}
              className="h-11 rounded-xl"
            >
              Markeer als besteld
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={approving}
              onClick={() => void approveAction("mark_delivered")}
              className="h-11 rounded-xl"
            >
              Markeer als geleverd
            </Button>
          </div>
        </section>
      ) : null}

      {step === "preorder_context" ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-foreground">Pre-order fase</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Bekijk je categorie/optiebudget en de basisregels (EV-only, verplichte opties, trekhaakregels).
          </p>

          <div className="mt-3 grid grid-cols-1 gap-2 text-[13px]">
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
              <span className="text-muted-foreground">Categorie</span>
              <span className="font-semibold text-foreground">{ctx?.wagen_categorie ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
              <span className="text-muted-foreground">Optiebudget</span>
              <span className="font-semibold text-foreground">{formatEur(ctx?.optiebudget ?? null)}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
              <span className="text-muted-foreground">Leasingmaatschappij</span>
              <span className="font-semibold text-foreground">{ctx?.leasingmaatschappij ?? "—"}</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <Button type="button" onClick={() => void go("model_choice")} className="h-11 w-full rounded-xl">
              Verder: model kiezen
            </Button>
          </div>
        </section>
      ) : null}

      {step === "model_choice" ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-foreground">Modelkeuze</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Kies een model uit de officiële keuzelijst en vraag een offerte op bij een dealer naar keuze.
          </p>

          <div className="mt-3 space-y-2">
            <label className="block text-[12.5px] font-semibold text-foreground">
              Merk + model (vrij veld)
              <input
                value={state.model.merkModel ?? ""}
                onChange={(e) => void setModelField({ merkModel: e.target.value })}
                className={cn(
                  "mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px]",
                )}
                placeholder="bv. Tesla Model 3 Long Range"
              />
            </label>
            <label className="block text-[12.5px] font-semibold text-foreground">
              Dealer (optioneel)
              <input
                value={state.model.dealer ?? ""}
                onChange={(e) => void setModelField({ dealer: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px]"
                placeholder="bv. Dealer X"
              />
            </label>
            <label className="block text-[12.5px] font-semibold text-foreground">
              Totaalprijs offerte (EUR, incl. BTW) (voor checks)
              <input
                inputMode="decimal"
                value={typeof state.model.offerTotalEur === "number" ? String(state.model.offerTotalEur) : ""}
                onChange={(e) => {
                  const raw = e.target.value.replace(",", ".").trim();
                  const n = raw ? Number(raw) : null;
                  void setModelField({ offerTotalEur: n !== null && Number.isFinite(n) ? n : null });
                }}
                className="mt-1 h-11 w-full rounded-xl border border-border bg-background px-3 text-[14px]"
                placeholder="bv. 48500"
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => void go("preorder_context")} className="h-11 rounded-xl">
              Terug
            </Button>
            <Button type="button" onClick={() => void go("offer_upload")} className="h-11 rounded-xl">
              Verder: offerte uploaden
            </Button>
          </div>
        </section>
      ) : null}

      {step === "offer_upload" ? (
        <section>
          <OfferteUpload
            bestellingId={bestellingId}
            existingPath={state.offer.storagePath}
            onUploaded={(u) => void onOfferUploaded(u)}
          />
          <div className="mt-2">
            <Button type="button" variant="outline" onClick={() => void go("model_choice")} className="h-11 w-full rounded-xl">
              Terug
            </Button>
          </div>
        </section>
      ) : null}

      {step === "auto_checks" ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-foreground">Automatische checks</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            We controleren of je model in de keuzelijst zit en berekenen overschrijding vs. optiebudget.
          </p>

          <div className="mt-3">
            <Button
              type="button"
              onClick={() => void runValidation()}
              disabled={validating}
              className="h-11 w-full rounded-xl"
            >
              {validating ? "Bezig met controleren…" : "Voer checks uit"}
            </Button>
          </div>

          {(state.checks.issues?.length ?? 0) > 0 ? (
            <div className="mt-3 rounded-2xl border border-border bg-background p-3">
              <p className="text-[13px] font-semibold text-foreground">Aandachtspunten</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-muted-foreground">
                {state.checks.issues!.map((it) => (
                  <li key={it.code}>{it.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="mt-3 grid grid-cols-1 gap-2 text-[13px]">
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
              <span className="text-muted-foreground">Overschrijding</span>
              <span className="font-semibold text-foreground">{overspend ? formatEur(overspend) : "—"}</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-muted px-3 py-2">
              <span className="text-muted-foreground">Persoonlijke bijdrage</span>
              <span className="font-semibold text-foreground">{contribution ? formatEur(contribution) : "—"}</span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => void go("offer_upload")} className="h-11 rounded-xl">
              Terug
            </Button>
            <Button
              type="button"
              onClick={() => void go(contributionRequired ? "contribution_sign" : "submit_for_approval")}
              className="h-11 rounded-xl"
            >
              Verder
            </Button>
          </div>
        </section>
      ) : null}

      {step === "contribution_sign" ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-foreground">Persoonlijke bijdrage</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Overschrijding &gt; € 3.000 vereist een bijdrage-document en ondertekening.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-muted px-3 py-2 text-[13px]">
            <span className="text-muted-foreground">Bijdrage (indicatief)</span>
            <span className="font-semibold text-foreground">{formatEur(contribution)}</span>
          </div>

          <div className="mt-3">
            <Button
              type="button"
              onClick={() => void generateContributionPdf()}
              disabled={pdfBusy}
              className="h-11 w-full rounded-xl"
            >
              {pdfBusy ? "Bezig…" : "Genereer bijdrage-document (PDF)"}
            </Button>
            {state.contribution.docPath ? (
              <p className="mt-2 text-[12.5px] text-muted-foreground">
                Document klaar. Onderteken hieronder.
              </p>
            ) : null}
          </div>

          <div className="mt-4">
            <SignaturePad
              value={state.contribution.signature ?? null}
              onChange={(sig) => {
                void onChange({
                  ...state,
                  contribution: {
                    ...state.contribution,
                    required: true,
                    signature: sig,
                    signedAt: new Date().toISOString(),
                  },
                });
                if (typeof sig === "string" && sig.startsWith("data:image/")) {
                  void fetch(`/api/wagen-bestellen/${bestellingId}/sign-bijdrage`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ signatureDataUrl: sig }),
                  }).then(() => onRefresh());
                }
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button type="button" variant="outline" onClick={() => void go("auto_checks")} className="h-11 rounded-xl">
              Terug
            </Button>
            <Button type="button" onClick={() => void go("submit_for_approval")} className="h-11 rounded-xl">
              Verder: indienen
            </Button>
          </div>
        </section>
      ) : null}

      {step === "submit_for_approval" ? (
        <section className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <p className="text-[14px] font-semibold text-foreground">Indienen</p>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            Dit stuurt je bestelling door naar Fleet & Management voor goedkeuring.
          </p>

          <div className="mt-4 space-y-2">
            <Button
              type="button"
              onClick={() => void submitForApproval()}
              disabled={busy || status !== "draft"}
              className="h-11 w-full rounded-xl"
            >
              {status !== "draft" ? "Reeds ingediend" : busy ? "Bezig…" : "Indienen voor goedkeuring"}
            </Button>
            <Button type="button" variant="outline" onClick={() => void go("auto_checks")} className="h-11 w-full rounded-xl">
              Terug
            </Button>
          </div>
        </section>
      ) : null}
    </WizardShell>
  );
}

