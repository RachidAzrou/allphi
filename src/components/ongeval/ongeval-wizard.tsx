"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  BadgeCheck,
  Building2,
  Car,
  ChevronRight,
  Download,
  DoorOpen,
  FilePenLine,
  GitBranch,
  Info,
  Languages,
  ParkingCircle,
  QrCode,
  RefreshCw,
  ShieldAlert,
  Smartphone,
  SmartphoneNfc,
  Split,
  Truck,
  UserCircle,
  Users,
} from "lucide-react";
import { FcTwoSmartphones } from "react-icons/fc";
import { toast } from "sonner";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { WizardFooterButton, WizardShell } from "@/components/ongeval/wizard-shell";
import { ImpactDiagram } from "@/components/ongeval/impact-diagram";
import { LocationPicker } from "@/components/ongeval/location-picker";
import { SignaturePad } from "@/components/ongeval/signature-pad";
import { STEP_BANNERS } from "@/components/ongeval/step-banners";
import {
  advanceState,
  getNextStepId,
  getNextAfterOverviewSkip,
  getPreviousStepId,
  mergePayloadIntoState,
  popHistory,
  validateStep,
} from "@/lib/ongeval/engine";
import { toIsoDate } from "@/lib/ongeval/date-utils";
import {
  getCategoryDescription,
  getCategoryLabel,
  getDetailLabel,
  resolveLang,
  t,
  type OngevalLang,
} from "@/lib/ongeval/i18n";
import {
  CENTER_LINE_OPTIONS,
  GENERIC_SINGLE,
  LANE_CHANGE_OPTIONS,
  MANEUVER_A_OPTIONS,
  MANEUVER_B_OPTIONS,
  PRIORITY_OPTIONS,
  REAR_END_OPTIONS,
  SITUATION_CATEGORIES,
} from "@/lib/ongeval/situations";
import { formatDateForDisplay, formatTimeForDisplay } from "@/lib/ongeval/date-utils";
import type {
  AccidentReportState,
  OngevalStepId,
  SituationCategoryId,
} from "@/types/ongeval";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

const CATEGORY_ICONS: Record<SituationCategoryId, LucideIcon> = {
  parking: ParkingCircle,
  rear_end: Car,
  maneuver: GitBranch,
  priority: ShieldAlert,
  lane_change: Split,
  opposite: ArrowLeftRight,
  door: DoorOpen,
  load: Truck,
};

type OngevalWizardProps = {
  reportId: string;
  initialPayload: unknown;
  /** Guest mode (partij B zonder login): secret uit QR/link */
  guestSecret?: string | null;
  /** Chat-overlay: compacte layout en sluiten zonder route-wissel */
  embedded?: boolean;
  /** Bij embedded: terug/exit/voltooid sluiten het venster */
  onRequestClose?: () => void;
};

export function OngevalWizard({
  reportId,
  initialPayload,
  guestSecret = null,
  embedded = false,
  onRequestClose,
}: OngevalWizardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => {
    const raw = searchParams?.get("returnTo");
    if (!raw) return null;
    // Keep it simple and safe: only allow internal absolute paths.
    if (!raw.startsWith("/")) return null;
    return raw;
  }, [searchParams]);
  const supabase = useMemo(() => createClient(), []);
  const [state, setState] = useState<AccidentReportState>(() => {
    const merged = mergePayloadIntoState(initialPayload);
    // Guest join (partij B zonder login) moet in de B-flow starten,
    // niet in de maker (partij A) flow.
    if (!guestSecret) return merged;
    return {
      ...merged,
      role: "B",
      currentStepId: "party_b_language",
      navigationHistory: [],
    };
  });
  const [exitOpen, setExitOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const skipPersistRef = useRef(true);
  const localEditAtRef = useRef(0);
  const [joinSecret, setJoinSecret] = useState<string | null>(null);
  const [joinQrDataUrl, setJoinQrDataUrl] = useState<string | null>(null);
  const [refreshingJoinQr, setRefreshingJoinQr] = useState(false);
  const [partyBJoinedAt, setPartyBJoinedAt] = useState<string | null>(null);

  const stepId = state.currentStepId;
  const lang: OngevalLang = resolveLang(
    state.role,
    state.partyBLanguage as OngevalLang | null,
  );
  const bannerKey = `banner_${stepId}`;
  // Vertaalde banner-tekst (val terug op NL indien key niet bestaat).
  const bannerKeyByStep: Partial<Record<OngevalStepId, string>> = {
    signature_a: "banner.signature",
    signature_b: "banner.signature",
    vehicle_contact: "banner.vehicle_contact",
    proposal_intro: "banner.proposal_intro",
  };
  const bannerMessageI18nKey = bannerKeyByStep[stepId];
  const bannerMessage = bannerMessageI18nKey
    ? t(lang, bannerMessageI18nKey)
    : STEP_BANNERS[stepId];
  const bannerDismissed = state.dismissedBanners[bannerKey] === true;

  const persist = useCallback(
    async (next: AccidentReportState) => {
      setSaving(true);
      try {
        if (guestSecret) {
          const res = await fetch(
            `/api/ongeval/${encodeURIComponent(reportId)}/guest`,
            {
              method: "PUT",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ secret: guestSecret, payload: next }),
            },
          );
          if (!res.ok) throw new Error("guest_update_failed");
        } else {
          const { error } = await supabase
            .from("ongeval_aangiften")
            .update({
              payload: next as unknown as Record<string, unknown>,
              updated_at: new Date().toISOString(),
            })
            .eq("id", reportId);
          if (error) throw error;
        }
      } catch (e) {
        console.error(e);
        toast.error("Opslaan mislukt. Probeer opnieuw.");
      } finally {
        setSaving(false);
      }
    },
    [guestSecret, reportId, supabase],
  );

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    const t = setTimeout(() => {
      void persist(state);
    }, 800);
    return () => clearTimeout(t);
  }, [state, persist]);

  const updateState = useCallback((patch: Partial<AccidentReportState>) => {
    localEditAtRef.current = Date.now();
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel(`ongeval_aangiften:${reportId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ongeval_aangiften",
          filter: `id=eq.${reportId}`,
        },
        (payload) => {
          const nextRow = (payload as any)?.new as
            | { payload?: unknown; party_b_joined_at?: string | null }
            | undefined;
          const remotePayload = nextRow?.payload as unknown;

          // Track Party B join status (used to gate share_qr).
          if (typeof nextRow?.party_b_joined_at === "string" || nextRow?.party_b_joined_at === null) {
            setPartyBJoinedAt(nextRow.party_b_joined_at ?? null);
          }

          if (!remotePayload) return;
          if (Date.now() - localEditAtRef.current < 1200) return;
          setState((prev) => {
            const merged = mergePayloadIntoState(remotePayload);
            // Keep navigation/role strictly per-device so Partij A and Partij B
            // can move through the wizard independently on their own toestel.
            merged.currentStepId = prev.currentStepId;
            merged.navigationHistory = prev.navigationHistory;
            merged.role = prev.role;
            merged.dismissedBanners = prev.dismissedBanners;
            if (JSON.stringify(merged) === JSON.stringify(prev)) return prev;
            return merged;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [reportId, supabase]);

  const ensureJoinQr = useCallback(
    async (mode: "existing" | "rotate" = "existing") => {
      if (mode === "rotate") setRefreshingJoinQr(true);
      try {
        let secret: string | null = null;

        if (mode === "rotate") {
          const nextSecret = Array.from(
            crypto.getRandomValues(new Uint8Array(16)),
          )
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          const { data, error } = await supabase
            .from("ongeval_aangiften")
            .update({
              join_secret: nextSecret,
              party_b_user_id: null,
              party_b_joined_at: null,
            })
            .eq("id", reportId)
            .select("join_secret")
            .maybeSingle();

          if (error) throw error;
          secret = ((data as any)?.join_secret as string | null) ?? nextSecret;
          setPartyBJoinedAt(null);
          toast.success("QR-code vernieuwd.");
        } else {
          const { data, error } = await supabase
            .from("ongeval_aangiften")
            .select("join_secret, party_b_joined_at")
            .eq("id", reportId)
            .maybeSingle();
          if (error) return;
          secret = (data as any)?.join_secret as string | null;
          setPartyBJoinedAt(((data as any)?.party_b_joined_at as string | null) ?? null);
        }

        if (!secret) return;
        setJoinSecret(secret);

        const url = `${window.location.origin}/ongeval/join?rid=${reportId}&s=${encodeURIComponent(
          secret,
        )}`;
        const png = await QRCode.toDataURL(url, {
          errorCorrectionLevel: "M",
          margin: 2,
          width: 680,
          color: {
            dark: "#163247",
            light: "#FFFFFF",
          },
        });
        setJoinQrDataUrl(png);
      } catch (e) {
        console.error(e);
        toast.error("QR-code vernieuwen mislukt.");
      } finally {
        if (mode === "rotate") setRefreshingJoinQr(false);
      }
    },
    [reportId, supabase],
  );

  useEffect(() => {
    if (stepId !== "share_qr") return;
    void ensureJoinQr("existing");
  }, [ensureJoinQr, stepId]);

  // Fallback polling voor partyBJoinedAt zolang A op share_qr wacht — dekt
  // scenario waarbij Supabase-realtime (postgres_changes) niet actief is.
  useEffect(() => {
    if (stepId !== "share_qr") return;
    if (state.role !== "A") return;
    if (partyBJoinedAt) return;
    let cancelled = false;
    const interval = window.setInterval(async () => {
      if (cancelled) return;
      const { data } = await supabase
        .from("ongeval_aangiften")
        .select("party_b_joined_at")
        .eq("id", reportId)
        .maybeSingle();
      const joined = (data as { party_b_joined_at?: string | null } | null)?.party_b_joined_at ?? null;
      if (joined) {
        setPartyBJoinedAt(joined);
        window.clearInterval(interval);
      }
    }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [stepId, state.role, partyBJoinedAt, reportId, supabase]);

  // Auto-advance Partij A uit de QR-deelstap zodra Partij B gekoppeld is, zodat
  // A niet blijft hangen op de QR-pagina.
  const autoAdvancedFromShareQrRef = useRef(false);
  useEffect(() => {
    if (stepId !== "share_qr") {
      autoAdvancedFromShareQrRef.current = false;
      return;
    }
    if (state.role !== "A") return;
    if (!partyBJoinedAt) return;
    if (autoAdvancedFromShareQrRef.current) return;
    autoAdvancedFromShareQrRef.current = true;
    toast.success("Partij B is gekoppeld. Ga verder met plaats en tijd.");
    setState((prev) => advanceState(prev, "location_time"));
  }, [stepId, state.role, partyBJoinedAt]);

  // Vangnet: in een 2-toestel-setup is `party_b_optional` altijd onzin —
  // Partij A hoort door naar plaats/tijd, Partij B naar het eigen formulier.
  // Voorkomt dat oude, al opgeslagen state iemand hier laat stranden.
  useEffect(() => {
    if (stepId !== "party_b_optional") return;
    if (state.devicesCount !== 2) return;
    const target = state.role === "B" ? "party_b_form" : "location_time";
    setState((prev) => advanceState(prev, target));
  }, [stepId, state.devicesCount, state.role]);

  const goNext = useCallback(() => {
    if (!validateStep(stepId, state)) {
      toast.error("Vul de verplichte velden in om verder te gaan.");
      return;
    }
    const nextId = getNextStepId(stepId, state);
    if (!nextId) return;
    setState(advanceState(state, nextId));
  }, [stepId, state]);

  const goBack = useCallback(() => {
    const prevId = getPreviousStepId(state);
    if (prevId) {
      setState(popHistory(state));
      return;
    }
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    router.push(returnTo ?? "/ongeval");
  }, [state, router, onRequestClose, returnTo]);

  const dismissBanner = useCallback(() => {
    updateState({
      dismissedBanners: { ...state.dismissedBanners, [bannerKey]: true },
    });
  }, [bannerKey, state.dismissedBanners, updateState]);

  const handleExit = useCallback(() => {
    setExitOpen(true);
  }, []);

  const confirmExit = useCallback(() => {
    setExitOpen(false);
    if (onRequestClose) {
      onRequestClose();
      return;
    }
    router.push(returnTo ?? "/chat");
  }, [router, onRequestClose, returnTo]);

  useEffect(() => {
    setState((s) => {
      const hasDate = s.location.datum.trim().length > 0;
      const hasTime = s.location.tijd.trim().length > 0;
      if (hasDate && hasTime) return s;
      const d = new Date();
      return {
        ...s,
        location: {
          ...s.location,
          datum: hasDate ? s.location.datum : d.toLocaleDateString("nl-BE"),
          tijd: hasTime
            ? s.location.tijd
            : d.toLocaleTimeString("nl-BE", {
                hour: "2-digit",
                minute: "2-digit",
              }),
        },
      };
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const email = user?.email ?? "";
      if (!email) return;

      const { data: medewerker } = await supabase
        .from("medewerkers")
        .select(
          "id, voornaam, naam, emailadres, telefoonnummer, geboortedatum, straat, huisnummer, bus, postcode, stad, land",
        )
        .ilike("emailadres", email)
        .maybeSingle();

      const { data: vctx } = await supabase
        .from("v_fleet_assistant_context")
        .select("nummerplaat, merk_model, insurance_company, policy_number")
        .eq("emailadres", email)
        .maybeSingle();

      const { data: company } = await supabase
        .from("company_profile")
        .select(
          "name, contact_first_name, enterprise_number, street, house_number, box, postal_code, city, country",
        )
        .order("id", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      setState((prev) => {
        const next = { ...prev };

        // Prefill employee driver basics
        if ((medewerker as any)?.voornaam && !next.employeeDriver.voornaam) {
          next.employeeDriver = {
            ...next.employeeDriver,
            voornaam: String((medewerker as any).voornaam ?? ""),
          };
        }
        if ((medewerker as any)?.naam && !next.employeeDriver.naam) {
          next.employeeDriver = {
            ...next.employeeDriver,
            naam: String((medewerker as any).naam ?? ""),
          };
        }
        if (email && !next.employeeDriver.email) {
          next.employeeDriver = { ...next.employeeDriver, email };
        }
        if ((medewerker as any)?.telefoonnummer && !next.employeeDriver.telefoon) {
          next.employeeDriver = {
            ...next.employeeDriver,
            telefoon: String((medewerker as any).telefoonnummer ?? ""),
          };
        }

        const geboortedatum =
          typeof (medewerker as any)?.geboortedatum === "string"
            ? String((medewerker as any).geboortedatum)
            : "";
        if (geboortedatum && !next.employeeDriver.geboortedatum) {
          next.employeeDriver = {
            ...next.employeeDriver,
            geboortedatum: toIsoDate(geboortedatum),
          };
        }

        const maybeSetAddress = (key: string, value: unknown) => {
          if (typeof value !== "string") return;
          if (!value.trim()) return;
          if ((next.employeeDriver.adres as any)[key]?.trim?.()) return;
          next.employeeDriver = {
            ...next.employeeDriver,
            adres: { ...next.employeeDriver.adres, [key]: value },
          };
        };
        maybeSetAddress("straat", (medewerker as any)?.straat);
        maybeSetAddress("huisnummer", (medewerker as any)?.huisnummer);
        maybeSetAddress("bus", (medewerker as any)?.bus);
        maybeSetAddress("postcode", (medewerker as any)?.postcode);
        maybeSetAddress("stad", (medewerker as any)?.stad);
        maybeSetAddress("land", (medewerker as any)?.land);

        // When the employee is the driver, also prefill partyA.bestuurder (used in overview/PDF).
        if (next.driverWasEmployee !== false) {
          const b = next.partyA.bestuurder;
          const ed = next.employeeDriver;

          const setBestuurderIfEmpty = (
            key: keyof typeof b,
            value: unknown,
          ) => {
            if (typeof value !== "string") return;
            if (!value.trim()) return;
            if (String((b as any)[key] ?? "").trim()) return;
            next.partyA = {
              ...next.partyA,
              bestuurder: { ...next.partyA.bestuurder, [key]: value },
            };
          };

          setBestuurderIfEmpty("voornaam", ed.voornaam);
          setBestuurderIfEmpty("naam", ed.naam);
          setBestuurderIfEmpty("geboortedatum", toIsoDate(ed.geboortedatum));
          setBestuurderIfEmpty("email", ed.email);
          setBestuurderIfEmpty("telefoon", ed.telefoon);
          setBestuurderIfEmpty("rijbewijsNummer", ed.rijbewijsNummer);

          const ba = next.partyA.bestuurder.adres;
          const ea = ed.adres;
          const setBestuurderAdresIfEmpty = (k: keyof typeof ba, v: unknown) => {
            if (typeof v !== "string") return;
            if (!v.trim()) return;
            if (String((ba as any)[k] ?? "").trim()) return;
            next.partyA = {
              ...next.partyA,
              bestuurder: {
                ...next.partyA.bestuurder,
                adres: { ...next.partyA.bestuurder.adres, [k]: v },
              },
            };
          };

          setBestuurderAdresIfEmpty("straat", ea.straat);
          setBestuurderAdresIfEmpty("huisnummer", ea.huisnummer);
          setBestuurderAdresIfEmpty("bus", ea.bus);
          setBestuurderAdresIfEmpty("postcode", ea.postcode);
          setBestuurderAdresIfEmpty("stad", ea.stad);
          setBestuurderAdresIfEmpty("land", ea.land);
        }

        // Policyholder is always company: keep fields blank unless user filled them.
        if (company && typeof company === "object") {
          const cp = company as any;
          const current = next.partyA.verzekeringsnemer;

          const setIfEmpty = (key: keyof typeof current, value: unknown) => {
            if (typeof value !== "string") return;
            if (!value.trim()) return;
            if (String((current as any)[key] ?? "").trim()) return;
            next.partyA = {
              ...next.partyA,
              verzekeringsnemer: { ...next.partyA.verzekeringsnemer, [key]: value },
            };
          };

          setIfEmpty("naam", cp.name);
          setIfEmpty("voornaam", cp.contact_first_name);
          setIfEmpty("ondernemingsnummer", cp.enterprise_number);

          const ca = next.partyA.verzekeringsnemer.adres;
          const setAddrIfEmpty = (k: keyof typeof ca, v: unknown) => {
            if (typeof v !== "string") return;
            if (!v.trim()) return;
            if (String((ca as any)[k] ?? "").trim()) return;
            next.partyA = {
              ...next.partyA,
              verzekeringsnemer: {
                ...next.partyA.verzekeringsnemer,
                adres: { ...next.partyA.verzekeringsnemer.adres, [k]: v },
              },
            };
          };

          setAddrIfEmpty("straat", cp.street);
          setAddrIfEmpty("huisnummer", cp.house_number);
          setAddrIfEmpty("bus", cp.box);
          setAddrIfEmpty("postcode", cp.postal_code);
          setAddrIfEmpty("stad", cp.city);
          setAddrIfEmpty("land", cp.country);
        }

        // Prefill vehicle
        const nummerplaat =
          typeof (vctx as any)?.nummerplaat === "string"
            ? String((vctx as any).nummerplaat)
            : "";
        const merkModel =
          typeof (vctx as any)?.merk_model === "string"
            ? String((vctx as any).merk_model)
            : "";
        const insuranceCompany =
          typeof (vctx as any)?.insurance_company === "string"
            ? String((vctx as any).insurance_company)
            : "";
        const policyNumber =
          typeof (vctx as any)?.policy_number === "string"
            ? String((vctx as any).policy_number)
            : "";

        if (nummerplaat && !next.partyA.voertuig.nummerplaat) {
          next.partyA = {
            ...next.partyA,
            voertuig: { ...next.partyA.voertuig, nummerplaat },
          };
        }
        if (merkModel && !next.partyA.voertuig.merkModel) {
          next.partyA = {
            ...next.partyA,
            voertuig: { ...next.partyA.voertuig, merkModel },
          };
        }
        if (insuranceCompany && !next.partyA.verzekering.maatschappij) {
          next.partyA = {
            ...next.partyA,
            verzekering: {
              ...next.partyA.verzekering,
              maatschappij: insuranceCompany,
            },
          };
        }
        if (policyNumber && !next.partyA.verzekering.polisnummer) {
          next.partyA = {
            ...next.partyA,
            verzekering: { ...next.partyA.verzekering, polisnummer: policyNumber },
          };
        }

        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  function renderPartyBForm() {
    const p = state.partyB;
    return (
      <div className="flex flex-col gap-6 px-4 py-6">
        <div className="rounded-2xl border border-[#2799D7]/12 bg-gradient-to-br from-[#F7F9FC] to-white px-4 py-4 shadow-sm">
          <p className="text-[14px] leading-relaxed text-[#5F7382]">
            {t(lang, "party_b_form.intro")}
          </p>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
            {t(lang, "party_b_form.section.policyholder")}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t(lang, "field.firstname")}>
              <Input
                value={p.verzekeringsnemer.voornaam}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        voornaam: e.target.value,
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.lastname")}>
              <Input
                value={p.verzekeringsnemer.naam}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        naam: e.target.value,
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
          <Field label={t(lang, "field.street")}>
            <Input
              value={p.verzekeringsnemer.adres.straat}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    verzekeringsnemer: {
                      ...p.verzekeringsnemer,
                      adres: { ...p.verzekeringsnemer.adres, straat: e.target.value },
                    },
                  },
                })
              }
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t(lang, "field.housenumber")}>
              <Input
                value={p.verzekeringsnemer.adres.huisnummer}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, huisnummer: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.box")}>
              <Input
                value={p.verzekeringsnemer.adres.bus}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, bus: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.postcode")}>
              <Input
                value={p.verzekeringsnemer.adres.postcode}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, postcode: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t(lang, "field.city")}>
              <Input
                value={p.verzekeringsnemer.adres.stad}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, stad: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.country")}>
              <Input
                value={p.verzekeringsnemer.adres.land}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      verzekeringsnemer: {
                        ...p.verzekeringsnemer,
                        adres: { ...p.verzekeringsnemer.adres, land: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
            {t(lang, "party_b_form.section.insurance")}
          </h3>
          <Field label={t(lang, "field.insurance_company")}>
            <Input
              value={p.verzekering.maatschappij}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    verzekering: { ...p.verzekering, maatschappij: e.target.value },
                  },
                })
              }
            />
          </Field>
          <Field label={t(lang, "field.policy_number")}>
            <Input
              value={p.verzekering.polisnummer}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    verzekering: { ...p.verzekering, polisnummer: e.target.value },
                  },
                })
              }
            />
          </Field>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
            {t(lang, "party_b_form.section.vehicle")}
          </h3>
          <Field label={t(lang, "field.make_model")}>
            <Input
              value={p.voertuig.merkModel}
              onChange={(e) =>
                updateState({
                  partyB: { ...p, voertuig: { ...p.voertuig, merkModel: e.target.value } },
                })
              }
            />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t(lang, "field.plate")}>
              <Input
                value={p.voertuig.nummerplaat}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      voertuig: { ...p.voertuig, nummerplaat: e.target.value },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.registration_country")}>
              <Input
                value={p.voertuig.landInschrijving}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      voertuig: { ...p.voertuig, landInschrijving: e.target.value },
                    },
                  })
                }
              />
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
            {t(lang, "party_b_form.section.driver")}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <Field label={t(lang, "field.firstname")}>
              <Input
                value={p.bestuurder.voornaam}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: { ...p.bestuurder, voornaam: e.target.value },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.lastname")}>
              <Input
                value={p.bestuurder.naam}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: { ...p.bestuurder, naam: e.target.value },
                    },
                  })
                }
              />
            </Field>
          </div>
          <Field label={t(lang, "field.birthdate")}>
            <Input
              type="date"
              value={p.bestuurder.geboortedatum}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    bestuurder: { ...p.bestuurder, geboortedatum: e.target.value },
                  },
                })
              }
            />
          </Field>
          <Field label={t(lang, "field.license_number")}>
            <Input
              value={p.bestuurder.rijbewijsNummer}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    bestuurder: {
                      ...p.bestuurder,
                      rijbewijsNummer: e.target.value,
                    },
                  },
                })
              }
            />
          </Field>
          <Field label={t(lang, "field.street")}>
            <Input
              value={p.bestuurder.adres.straat}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    bestuurder: {
                      ...p.bestuurder,
                      adres: { ...p.bestuurder.adres, straat: e.target.value },
                    },
                  },
                })
              }
            />
          </Field>
          <div className="grid grid-cols-3 gap-2">
            <Field label={t(lang, "field.housenumber")}>
              <Input
                value={p.bestuurder.adres.huisnummer}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: {
                        ...p.bestuurder,
                        adres: { ...p.bestuurder.adres, huisnummer: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.postcode")}>
              <Input
                value={p.bestuurder.adres.postcode}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: {
                        ...p.bestuurder,
                        adres: { ...p.bestuurder.adres, postcode: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.city")}>
              <Input
                value={p.bestuurder.adres.stad}
                onChange={(e) =>
                  updateState({
                    partyB: {
                      ...p,
                      bestuurder: {
                        ...p.bestuurder,
                        adres: { ...p.bestuurder.adres, stad: e.target.value },
                      },
                    },
                  })
                }
              />
            </Field>
          </div>
          <Field label={t(lang, "field.country")}>
            <Input
              value={p.bestuurder.adres.land}
              onChange={(e) =>
                updateState({
                  partyB: {
                    ...p,
                    bestuurder: {
                      ...p.bestuurder,
                      adres: { ...p.bestuurder.adres, land: e.target.value },
                    },
                  },
                })
              }
            />
          </Field>
        </section>
      </div>
    );
  }

  function renderBody() {
    switch (stepId) {
      case "driver_select":
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-6 md:max-w-2xl">
            <ModeCard
              icon={UserCircle}
              title="Ik was de bestuurder"
              description="We vullen je gegevens in vanuit je profiel (je kunt ze nog aanpassen)."
              onClick={() => {
                const next = { ...state, driverWasEmployee: true };
                setState(advanceState(next, "driver_employee_form"));
              }}
            />
            <ModeCard
              icon={Users}
              title="Een andere bestuurder"
              description="Je vult de gegevens van de bestuurder in (bv. collega, partner, …)."
              onClick={() => {
                const next = { ...state, driverWasEmployee: false };
                setState(advanceState(next, "driver_other_form"));
              }}
            />
          </div>
        );
      case "driver_employee_form": {
        const d = state.employeeDriver;
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
                Persoonsgegevens
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Voornaam">
                  <Input
                    value={d.voornaam}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: { ...d, voornaam: e.target.value },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            voornaam: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Naam">
                  <Input
                    value={d.naam}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: { ...d, naam: e.target.value },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            naam: e.target.value,
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Geboortedatum">
                <Input
                  type="date"
                  value={d.geboortedatum}
                  onChange={(e) =>
                    updateState({
                      employeeDriver: { ...d, geboortedatum: e.target.value },
                      partyA: {
                        ...state.partyA,
                        bestuurder: {
                          ...state.partyA.bestuurder,
                          geboortedatum: e.target.value,
                        },
                      },
                    })
                  }
                />
              </Field>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
                Adres
              </h3>
              <Field label="Straat">
                <Input
                  value={d.adres.straat}
                  onChange={(e) =>
                    updateState({
                      employeeDriver: {
                        ...d,
                        adres: { ...d.adres, straat: e.target.value },
                      },
                      partyA: {
                        ...state.partyA,
                        bestuurder: {
                          ...state.partyA.bestuurder,
                          adres: {
                            ...state.partyA.bestuurder.adres,
                            straat: e.target.value,
                          },
                        },
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Huisnr.">
                  <Input
                    value={d.adres.huisnummer}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, huisnummer: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              huisnummer: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Bus">
                  <Input
                    value={d.adres.bus}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, bus: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              bus: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Postcode">
                  <Input
                    value={d.adres.postcode}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, postcode: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              postcode: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Stad">
                  <Input
                    value={d.adres.stad}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, stad: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              stad: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Land">
                  <Input
                    value={d.adres.land}
                    onChange={(e) =>
                      updateState({
                        employeeDriver: {
                          ...d,
                          adres: { ...d.adres, land: e.target.value },
                        },
                        partyA: {
                          ...state.partyA,
                          bestuurder: {
                            ...state.partyA.bestuurder,
                            adres: {
                              ...state.partyA.bestuurder.adres,
                              land: e.target.value,
                            },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
                Rijbewijs
              </h3>
              <Field label="Rijbewijsnummer">
                <Input
                  value={d.rijbewijsNummer}
                  onChange={(e) =>
                    updateState({
                      employeeDriver: { ...d, rijbewijsNummer: e.target.value },
                      partyA: {
                        ...state.partyA,
                        bestuurder: {
                          ...state.partyA.bestuurder,
                          rijbewijsNummer: e.target.value,
                        },
                      },
                    })
                  }
                />
              </Field>
            </section>
          </div>
        );
      }
      case "driver_other_form": {
        const d = state.otherDriver;
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
                Persoonsgegevens
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Voornaam">
                  <Input
                    value={d.voornaam}
                    onChange={(e) =>
                      updateState({
                        otherDriver: { ...d, voornaam: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field label="Naam">
                  <Input
                    value={d.naam}
                    onChange={(e) =>
                      updateState({
                        otherDriver: { ...d, naam: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Geboortedatum">
                <Input
                  type="date"
                  value={d.geboortedatum}
                  onChange={(e) =>
                    updateState({
                      otherDriver: { ...d, geboortedatum: e.target.value },
                    })
                  }
                />
              </Field>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
                Adres
              </h3>
              <Field label="Straat">
                <Input
                  value={d.adres.straat}
                  onChange={(e) =>
                    updateState({
                      otherDriver: {
                        ...d,
                        adres: { ...d.adres, straat: e.target.value },
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Huisnr.">
                  <Input
                    value={d.adres.huisnummer}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, huisnummer: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Bus">
                  <Input
                    value={d.adres.bus}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, bus: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Postcode">
                  <Input
                    value={d.adres.postcode}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, postcode: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Stad">
                  <Input
                    value={d.adres.stad}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, stad: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Land">
                  <Input
                    value={d.adres.land}
                    onChange={(e) =>
                      updateState({
                        otherDriver: {
                          ...d,
                          adres: { ...d.adres, land: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
                Rijbewijs
              </h3>
              <Field label="Rijbewijsnummer">
                <Input
                  value={d.rijbewijsNummer}
                  onChange={(e) =>
                    updateState({
                      otherDriver: { ...d, rijbewijsNummer: e.target.value },
                    })
                  }
                />
              </Field>
            </section>
          </div>
        );
      }
      case "policyholder_select":
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-6 md:max-w-2xl">
            <ModeCard
              icon={Building2}
              title="Bedrijf"
              description="De verzekeringsnemer is altijd het bedrijf (naam + adres)."
              onClick={() => {
                const next = {
                  ...state,
                  partyA: {
                    ...state.partyA,
                    verzekeringsnemerType: "company" as const,
                  },
                };
                setState(advanceState(next, "policyholder_form"));
              }}
            />
          </div>
        );
      case "policyholder_form": {
        const p = state.partyA.verzekeringsnemer;
        return (
          <div className="flex flex-col gap-6 px-4 py-6">
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
                Bedrijfsgegevens
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Contactpersoon — optioneel">
                  <Input
                    value={p.voornaam}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: { ...p, voornaam: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Naam (bedrijf)">
                  <Input
                    value={p.naam}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: { ...p, naam: e.target.value },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <Field label="Ondernemingsnummer">
                <Input
                  value={p.ondernemingsnummer}
                  onChange={(e) =>
                    updateState({
                      partyA: {
                        ...state.partyA,
                        verzekeringsnemer: {
                          ...p,
                          ondernemingsnummer: e.target.value,
                        },
                      },
                    })
                  }
                />
              </Field>
            </section>

            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-[15px] font-semibold text-[#163247]">
                Adres
              </h3>
              <Field label="Straat">
                <Input
                  value={p.adres.straat}
                  onChange={(e) =>
                    updateState({
                      partyA: {
                        ...state.partyA,
                        verzekeringsnemer: {
                          ...p,
                          adres: { ...p.adres, straat: e.target.value },
                        },
                      },
                    })
                  }
                />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Huisnr.">
                  <Input
                    value={p.adres.huisnummer}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, huisnummer: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Bus">
                  <Input
                    value={p.adres.bus}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, bus: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Postcode">
                  <Input
                    value={p.adres.postcode}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, postcode: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="Stad">
                  <Input
                    value={p.adres.stad}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, stad: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
                <Field label="Land">
                  <Input
                    value={p.adres.land}
                    onChange={(e) =>
                      updateState({
                        partyA: {
                          ...state.partyA,
                          verzekeringsnemer: {
                            ...p,
                            adres: { ...p.adres, land: e.target.value },
                          },
                        },
                      })
                    }
                  />
                </Field>
              </div>
            </section>
          </div>
        );
      }
      case "insurer_select": {
        const ins = state.partyA.verzekering;
        return (
          <div className="flex flex-col gap-3 px-4 py-6">
            <Field label="Verzekeringsmaatschappij">
              <Input
                value={ins.maatschappij}
                onChange={(e) =>
                  updateState({
                    partyA: {
                      ...state.partyA,
                      verzekering: { ...ins, maatschappij: e.target.value },
                    },
                  })
                }
              />
            </Field>
            <Field label="Polisnummer">
              <Input
                value={ins.polisnummer}
                onChange={(e) =>
                  updateState({
                    partyA: {
                      ...state.partyA,
                      verzekering: { ...ins, polisnummer: e.target.value },
                    },
                  })
                }
              />
            </Field>
          </div>
        );
      }
      case "vehicle_confirm": {
        const v = state.partyA.voertuig;
        return (
          <div className="flex flex-col gap-3 px-4 py-6">
            <Field label="Merk & model">
              <Input
                value={v.merkModel}
                onChange={(e) =>
                  updateState({
                    partyA: {
                      ...state.partyA,
                      voertuig: { ...v, merkModel: e.target.value },
                    },
                  })
                }
              />
            </Field>
            <Field label="Nummerplaat">
              <Input
                value={v.nummerplaat}
                onChange={(e) =>
                  updateState({
                    partyA: {
                      ...state.partyA,
                      voertuig: { ...v, nummerplaat: e.target.value },
                    },
                  })
                }
              />
            </Field>
            <Field label="Land van inschrijving">
              <Input
                value={v.landInschrijving}
                onChange={(e) =>
                  updateState({
                    partyA: {
                      ...state.partyA,
                      voertuig: { ...v, landInschrijving: e.target.value },
                    },
                  })
                }
              />
            </Field>
          </div>
        );
      }
      case "parties_count":
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-6 md:max-w-2xl">
            <ModeCard
              icon={UserCircle}
              title="1 partij aanwezig"
              description="Je bent alleen aanwezig en vult het dossier in."
              onClick={() => {
                const next = {
                  ...state,
                  partiesCount: 1 as const,
                  wantsFillPartyB: null,
                };
                setState(advanceState(next, "devices_count"));
              }}
            />
            <ModeCard
              icon={Users}
              title="2 partijen aanwezig"
              description="Partij A en B zijn aanwezig om het dossier in te vullen."
              onClick={() => {
                const next = {
                  ...state,
                  partiesCount: 2 as const,
                  wantsFillPartyB: null,
                };
                setState(advanceState(next, "devices_count"));
              }}
            />
          </div>
        );
      case "devices_count":
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-6 md:max-w-2xl">
            <ModeCard
              icon={Smartphone}
              title="Eén toestel"
              description="Je vult alles in op één toestel."
              onClick={() => {
                const next = { ...state, devicesCount: 1 as const, role: null };
                setState(advanceState(next, "party_b_language"));
              }}
            />
            <ModeCard
              icon={FcTwoSmartphones}
              title="Twee toestellen"
              description="Partij A en B vullen mee in op hun eigen toestel (QR-link)."
              onClick={() => {
                const next = { ...state, devicesCount: 2 as const };
                setState(advanceState(next, "role_select"));
              }}
            />
          </div>
        );
      case "role_select":
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-6 md:max-w-2xl">
            <ModeCard
              icon={BadgeCheck}
              title="Rol A — maakt het rapport"
              description="Je start de aangifte en deelt een QR-code met partij B."
              onClick={() => {
                const next = { ...state, role: "A" as const };
                setState(advanceState(next, "share_qr"));
              }}
            />
            <ModeCard
              icon={QrCode}
              title="Rol B — assisteert"
              description="Je scant de QR-code van partij A en vult mee in."
              onClick={() => {
                toast.message("Open de koppelpagina om te scannen.");
                router.push("/ongeval/join");
              }}
            />
          </div>
        );
      case "share_qr":
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 py-6 md:max-w-2xl">
            <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(39,153,215,0.06)]">
              <div className="flex items-center justify-between gap-2 border-b border-black/[0.06] bg-[#F7F9FC] px-4 py-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Info
                    className="mt-[2px] size-4 shrink-0 text-[#2799D7]"
                    strokeWidth={2}
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="min-w-0 text-[14px] font-semibold leading-snug text-[#163247]">
                      Laat partij B deze QR-code scannen om mee in te vullen.
                    </p>
                    <p className="mt-0.5 text-[12px] text-[#5F7382]">
                      {partyBJoinedAt ? "Partij B is gekoppeld." : "Wachten op partij B…"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Vernieuw QR-code"
                  className="inline-flex items-center text-[#2799D7]"
                  onClick={() => void ensureJoinQr("rotate")}
                  disabled={refreshingJoinQr}
                >
                  <RefreshCw className="size-4" strokeWidth={2} aria-hidden />
                  <span className="sr-only">Vernieuw</span>
                </button>
              </div>
              <div className="p-4">
                {joinQrDataUrl ? (
                  <div className="rounded-2xl border border-black/[0.06] bg-[#F7F9FC] p-5 md:p-6">
                    <img
                      src={joinQrDataUrl}
                      alt="QR-code om dossier te koppelen"
                      className="mx-auto w-full max-w-[360px] rounded-lg bg-white md:max-w-[420px]"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[240px] items-center justify-center text-[14px] text-[#5F7382]">
                    QR-code wordt geladen…
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      case "scan_qr":
        return (
          <div className="px-4 py-10 text-center text-[15px] text-[#5F7382]">
            QR scannen wordt zo meteen toegevoegd in de volgende stap.
          </div>
        );
      case "party_b_language": {
        const pickLanguage = (lang: "nl" | "fr" | "en") => {
          const next = { ...state, partyBLanguage: lang };
          const target = getNextStepId("party_b_language", next) ?? "party_b_optional";
          setState(advanceState(next, target));
        };
        return (
          <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-6 md:max-w-2xl">
            <ModeCard
              icon={Languages}
              title="Nederlands"
              description="Partij B gebruikt Nederlands."
              onClick={() => pickLanguage("nl")}
            />
            <ModeCard
              icon={Languages}
              title="Frans"
              description="Partij B gebruikt Frans."
              onClick={() => pickLanguage("fr")}
            />
            <ModeCard
              icon={Languages}
              title="Engels"
              description="Partij B gebruikt Engels."
              onClick={() => pickLanguage("en")}
            />
          </div>
        );
      }
      case "party_b_optional":
        if (state.partiesCount !== 1) {
          return (
            <div className="px-4 py-10 text-center text-[15px] text-[#5F7382]">
              Partij B vult mee in via het tweede toestel.
            </div>
          );
        }
        return (
          <div className="flex flex-col gap-6 px-4 py-10">
            <p className="text-center text-[15px] leading-relaxed text-[#163247]">
              Wil je nu al bepaalde gegevens van partij B invullen?
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setState(advanceState({ ...state, wantsFillPartyB: true }, "party_b_form"))
                }
                className="min-h-[88px] min-w-[120px] rounded-2xl border border-[#2799D7]/25 bg-white px-4 text-[16px] font-semibold text-[#2799D7] shadow-sm transition-all hover:border-[#2799D7]/40 hover:shadow-md active:scale-[0.995]"
              >
                Ja
              </button>
              <button
                type="button"
                onClick={() =>
                  setState(advanceState({ ...state, wantsFillPartyB: false }, "location_time"))
                }
                className="min-h-[88px] min-w-[120px] rounded-2xl border border-black/[0.08] bg-white px-4 text-[16px] font-semibold text-[#163247] shadow-sm transition-all hover:border-black/[0.14] hover:shadow-md active:scale-[0.995]"
              >
                Nee
              </button>
            </div>
          </div>
        );
      case "party_b_form":
        return renderPartyBForm();
      case "location_time":
        return (
          <div className="flex flex-col gap-3 px-4 py-4">
            <LocationPicker
              lang={lang}
              value={{
                straat: state.location.straat,
                huisnummer: state.location.huisnummer,
                postcode: state.location.postcode,
                stad: state.location.stad,
                land: state.location.land,
              }}
              onChange={(next) =>
                updateState({
                  location: {
                    ...state.location,
                    straat: next.straat || state.location.straat,
                    huisnummer: next.huisnummer || state.location.huisnummer,
                    postcode: next.postcode || state.location.postcode,
                    stad: next.stad || state.location.stad,
                    land: next.land || state.location.land,
                  },
                })
              }
            />
            <Field label={t(lang, "field.street")}>
              <Input
                value={state.location.straat}
                onChange={(e) =>
                  updateState({
                    location: { ...state.location, straat: e.target.value },
                  })
                }
              />
            </Field>
            <Field label={t(lang, "field.housenumber")}>
              <Input
                value={state.location.huisnummer}
                onChange={(e) =>
                  updateState({
                    location: { ...state.location, huisnummer: e.target.value },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(lang, "field.postcode")}>
                <Input
                  value={state.location.postcode}
                  onChange={(e) =>
                    updateState({
                      location: { ...state.location, postcode: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t(lang, "field.city")}>
                <Input
                  value={state.location.stad}
                  onChange={(e) =>
                    updateState({
                      location: { ...state.location, stad: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
            <Field label={t(lang, "field.country")}>
              <Input
                value={state.location.land}
                onChange={(e) =>
                  updateState({
                    location: { ...state.location, land: e.target.value },
                  })
                }
              />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label={t(lang, "field.date")}>
                <Input
                  type="date"
                  value={state.location.datum}
                  onChange={(e) =>
                    updateState({
                      location: { ...state.location, datum: e.target.value },
                    })
                  }
                />
              </Field>
              <Field label={t(lang, "field.time")}>
                <Input
                  type="time"
                  value={state.location.tijd}
                  onChange={(e) =>
                    updateState({
                      location: { ...state.location, tijd: e.target.value },
                    })
                  }
                />
              </Field>
            </div>
          </div>
        );
      case "injuries_material":
        return (
          <div className="flex flex-col gap-6 px-4 py-8">
            <YesNoBlock
              label={t(lang, "injuries.question")}
              value={state.gewonden}
              onChange={(v) => updateState({ gewonden: v })}
              lang={lang}
            />
            <YesNoBlock
              label={t(lang, "material.question")}
              value={state.materieleSchadeAnders}
              onChange={(v) => updateState({ materieleSchadeAnders: v })}
              lang={lang}
            />
          </div>
        );
      case "witnesses":
        return (
          <div className="flex flex-col gap-2 px-4 py-4">
            <Field label={t(lang, "overview.section.witnesses")}>
              <textarea
                className="min-h-[120px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder={t(lang, "witnesses.placeholder")}
                value={state.getuigen}
                onChange={(e) => updateState({ getuigen: e.target.value })}
              />
            </Field>
            <p className="text-[12px] text-[#5F7382]">
              {t(lang, "witnesses.help")}
            </p>
          </div>
        );
      case "situation_main":
        return (
          <div className="mx-3 mt-2 mb-4 flex flex-col overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(39,153,215,0.07)]">
            {SITUATION_CATEGORIES.map((cat) => {
              const Icon = CATEGORY_ICONS[cat.id];
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    const sub = cat.id;
                    let nextStep: OngevalStepId = "sit_rear_end";
                    if (sub === "rear_end") nextStep = "sit_rear_end";
                    else if (sub === "opposite") nextStep = "sit_center_line";
                    else if (sub === "priority") nextStep = "sit_priority";
                    else if (sub === "maneuver") nextStep = "sit_maneuver_a";
                    else if (sub === "lane_change") nextStep = "sit_lane_change";
                    else if (sub === "parking") nextStep = "sit_parking";
                    else if (sub === "door") nextStep = "sit_door";
                    else if (sub === "load") nextStep = "sit_load";
                    setState(
                      advanceState(
                        {
                          ...state,
                          situationCategory: cat.id,
                          situationDetailKey: null,
                          maneuverAKey: null,
                          maneuverBKey: null,
                        },
                        nextStep,
                      ),
                    );
                  }}
                  className="flex w-full items-start gap-3 border-b border-black/[0.05] px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-[#F7F9FC]/80 active:bg-[#E8F4FB]/50"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8F4FB]/90 text-[#2799D7] ring-1 ring-[#2799D7]/10">
                    <Icon className="size-6" strokeWidth={1.5} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-heading text-[15px] font-semibold text-[#163247]">
                      {getCategoryLabel(cat.id, lang) || cat.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-snug text-[#5F7382]">
                      {getCategoryDescription(cat.id, lang) || cat.description}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-5 shrink-0 text-[#2799D7]/35" />
                </button>
              );
            })}
          </div>
        );
      case "sit_rear_end":
        return (
          <OptionList
            lang={lang}
            options={REAR_END_OPTIONS}
            selectedId={state.situationDetailKey}
            onSelect={(id) => updateState({ situationDetailKey: id })}
          />
        );
      case "sit_center_line":
        return (
          <OptionList
            lang={lang}
            options={CENTER_LINE_OPTIONS}
            selectedId={state.situationDetailKey}
            onSelect={(id) => updateState({ situationDetailKey: id })}
          />
        );
      case "sit_priority":
        return (
          <OptionList
            lang={lang}
            options={PRIORITY_OPTIONS}
            selectedId={state.situationDetailKey}
            onSelect={(id) => updateState({ situationDetailKey: id })}
          />
        );
      case "sit_maneuver_a":
        return (
          <div>
            <p className="border-b border-[#2799D7]/10 bg-[#F7F9FC] px-4 py-2.5 text-[13px] font-medium text-[#5F7382]">
              {lang === "fr"
                ? "Choisissez la manœuvre de la partie A"
                : lang === "en"
                  ? "Choose the manoeuvre of party A"
                  : "Kies de rijbeweging van partij A"}
            </p>
            <OptionList
              lang={lang}
              options={MANEUVER_A_OPTIONS}
              selectedId={state.maneuverAKey}
              onSelect={(id) => updateState({ maneuverAKey: id })}
            />
          </div>
        );
      case "sit_maneuver_b":
        return (
          <div>
            <p className="border-b border-[#2799D7]/10 bg-[#F7F9FC] px-4 py-2.5 text-[13px] font-medium text-[#5F7382]">
              {lang === "fr"
                ? "Choisissez la manœuvre de la partie B"
                : lang === "en"
                  ? "Choose the manoeuvre of party B"
                  : "Kies de rijbeweging van partij B"}
            </p>
            <OptionList
              lang={lang}
              options={MANEUVER_B_OPTIONS}
              selectedId={state.maneuverBKey}
              onSelect={(id) => updateState({ maneuverBKey: id })}
            />
          </div>
        );
      case "sit_lane_change":
        return (
          <OptionList
            lang={lang}
            options={LANE_CHANGE_OPTIONS}
            selectedId={state.situationDetailKey}
            onSelect={(id) => updateState({ situationDetailKey: id })}
          />
        );
      case "sit_parking":
        return (
          <OptionList
            lang={lang}
            options={GENERIC_SINGLE.parking ?? []}
            selectedId={state.situationDetailKey}
            onSelect={(id) => updateState({ situationDetailKey: id })}
          />
        );
      case "sit_door":
        return (
          <OptionList
            lang={lang}
            options={GENERIC_SINGLE.door ?? []}
            selectedId={state.situationDetailKey}
            onSelect={(id) => updateState({ situationDetailKey: id })}
          />
        );
      case "sit_load":
        return (
          <OptionList
            lang={lang}
            options={GENERIC_SINGLE.load ?? []}
            selectedId={state.situationDetailKey}
            onSelect={(id) => updateState({ situationDetailKey: id })}
          />
        );
      case "proposal_intro":
        return (
          <div className="px-4 py-8">
            <div className="mx-auto max-w-md rounded-2xl border border-[#2799D7]/12 bg-gradient-to-br from-[#F7F9FC] to-white px-4 py-6 shadow-sm">
              <p className="text-center text-[15px] leading-relaxed text-[#163247]">
                {t(lang, "proposal.section_title")}
              </p>
            </div>
          </div>
        );
      case "proposal_decision":
        return (
          <div className="flex flex-col gap-4 px-4 py-10">
            <p className="text-center text-[15px] text-[#163247]">
              {t(lang, "proposal.question")}
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => updateState({ proposalAccepted: true })}
                className={`min-h-[100px] min-w-[100px] rounded-full border-2 px-4 text-[17px] font-semibold transition-colors ${
                  state.proposalAccepted === true
                    ? "border-2 border-[#2799D7] bg-[#E8F4FB] text-[#163247] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                    : "border-2 border-[#DCE6EE] bg-white text-[#2799D7] hover:border-[#2799D7]/35"
                }`}
              >
                {t(lang, "common.yes")}
              </button>
              <button
                type="button"
                onClick={() => updateState({ proposalAccepted: false })}
                className={`min-h-[100px] min-w-[100px] rounded-full border-2 px-4 text-[17px] font-semibold transition-colors ${
                  state.proposalAccepted === false
                    ? "border-2 border-[#2799D7] bg-[#E8F4FB] text-[#163247] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                    : "border-2 border-[#DCE6EE] bg-white text-[#2799D7] hover:border-[#2799D7]/35"
                }`}
              >
                {t(lang, "common.no")}
              </button>
            </div>
          </div>
        );
      case "circumstances_manual":
        return (
          <div className="px-4 py-4">
            <Field label={t(lang, "circumstances.label")}>
              <textarea
                className="min-h-[160px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder={t(lang, "circumstances.placeholder")}
                value={state.circumstancesNotes}
                onChange={(e) =>
                  updateState({ circumstancesNotes: e.target.value })
                }
              />
            </Field>
          </div>
        );
      case "vehicle_contact":
        return (
          <div className="flex flex-col gap-8 px-4 py-10">
            <p className="text-center text-[16px] font-medium text-[#163247]">
              {t(lang, "vehicle_contact.question")}
            </p>
            <div className="flex justify-center gap-4">
              <button
                type="button"
                onClick={() => updateState({ vehicleContact: true })}
                className={`min-h-[100px] min-w-[100px] rounded-full border-2 px-4 text-[17px] font-semibold transition-colors ${
                  state.vehicleContact === true
                    ? "border-2 border-[#2799D7] bg-[#E8F4FB] text-[#163247] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                    : "border-2 border-[#DCE6EE] bg-white text-[#2799D7] hover:border-[#2799D7]/35"
                }`}
              >
                {t(lang, "common.yes")}
              </button>
              <button
                type="button"
                onClick={() => updateState({ vehicleContact: false })}
                className={`min-h-[100px] min-w-[100px] rounded-full border-2 px-4 text-[17px] font-semibold transition-colors ${
                  state.vehicleContact === false
                    ? "border-2 border-[#2799D7] bg-[#E8F4FB] text-[#163247] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
                    : "border-2 border-[#DCE6EE] bg-white text-[#2799D7] hover:border-[#2799D7]/35"
                }`}
              >
                {t(lang, "common.no")}
              </button>
            </div>
          </div>
        );
      case "impact_party_a":
        return (
          <ImpactDiagram
            label={t(lang, "impact.a.label")}
            hint={t(lang, "impact.hint")}
            party="A"
            value={state.impactPartyA}
            onChange={(impactPartyA) => updateState({ impactPartyA })}
          />
        );
      case "impact_party_b":
        return (
          <ImpactDiagram
            label={t(lang, "impact.b.label")}
            hint={t(lang, "impact.hint")}
            party="B"
            value={state.impactPartyB}
            onChange={(impactPartyB) => updateState({ impactPartyB })}
          />
        );
      case "overview_intro":
        return (
          <div className="flex flex-col gap-6 px-4 py-10">
            <p className="text-center text-[15px] leading-relaxed text-[#163247]">
              {t(lang, "overview.intro")}
            </p>
          </div>
        );
      case "overview_detail":
        return <OverviewTabs state={state} lang={lang} />;
      case "signature_a":
        return (
          <div className="flex min-h-[280px] flex-col gap-3 px-4 py-4">
            <p className="text-[14px] leading-relaxed text-[#5F7382]">
              {lang === "fr"
                ? "Signez ci-dessous au nom du "
                : lang === "en"
                  ? "Sign below on behalf of "
                  : "Teken hieronder de handtekening van "}
              <strong className="font-semibold text-[#163247]">
                {lang === "fr"
                  ? "conducteur A"
                  : lang === "en"
                    ? "driver A"
                    : "bestuurder A"}
              </strong>
              {lang === "fr"
                ? ". Utilisez votre doigt ou un stylet."
                : lang === "en"
                  ? ". Use finger or stylus."
                  : ". Gebruik vinger of stylus."}
            </p>
            <SignaturePad
              value={state.signaturePartyA}
              onChange={(signaturePartyA) => updateState({ signaturePartyA })}
            />
          </div>
        );
      case "signature_b":
        return (
          <div className="flex min-h-[280px] flex-col gap-3 px-4 py-4">
            <p className="text-[14px] leading-relaxed text-[#5F7382]">
              {t(lang, "signature.b.prompt")}
            </p>
            <SignaturePad
              value={state.signaturePartyB}
              onChange={(signaturePartyB) => updateState({ signaturePartyB })}
            />
          </div>
        );
      case "complete":
        return (
          <PdfPreviewStep
            reportId={reportId}
            guestSecret={guestSecret}
            lang={lang}
          />
        );
      default:
        return null;
    }
  }

  const footer = useMemo(() => {
    if (stepId === "complete") {
      return (
        <WizardFooterButton
          label={t(lang, "common.ok")}
          disabled={saving}
          onClick={async () => {
            try {
              setSaving(true);
              const { error } = await supabase
                .from("ongeval_aangiften")
                .update({
                  status: "completed",
                  payload: state as unknown as Record<string, unknown>,
                })
                .eq("id", reportId);
              if (error) throw error;
              if (onRequestClose) {
                onRequestClose();
              } else {
                router.push(returnTo ?? "/chat");
              }
            } catch (e) {
              console.error(e);
              toast.error("Afronden mislukt.");
            } finally {
              setSaving(false);
            }
          }}
        />
      );
    }
    if (stepId === "overview_detail") {
      return (
        <div className="flex flex-col">
          <button
            type="button"
            className="flex min-h-12 w-full items-center justify-center border-t border-black/[0.06] bg-[#F0F4F8] text-[15px] font-semibold text-[#163247] transition-colors hover:bg-[#E8EEF3]"
            onClick={() => {
              setState(
                advanceState(
                  { ...state, overviewSkipped: true },
                  getNextAfterOverviewSkip(),
                ),
              );
            }}
          >
            {t(lang, "overview.skip")}
          </button>
          <WizardFooterButton label={t(lang, "common.next")} onClick={goNext} />
        </div>
      );
    }
    if (
      stepId === "signature_a" ||
      stepId === "signature_b" ||
      stepId === "impact_party_a" ||
      stepId === "impact_party_b"
    ) {
      return (
        <div className="grid grid-cols-1">
          <WizardFooterButton
            label={
              stepId.startsWith("signature")
                ? t(lang, "common.confirm")
                : t(lang, "common.next")
            }
            onClick={goNext}
            disabled={!validateStep(stepId, state)}
          />
        </div>
      );
    }
    if (
      stepId === "situation_main" ||
      stepId === "driver_select" ||
      stepId === "policyholder_select" ||
      stepId === "parties_count" ||
      stepId === "devices_count" ||
      stepId === "role_select" ||
      stepId === "party_b_language" ||
      stepId === "party_b_optional"
    ) {
      return null;
    }
    if (stepId === "share_qr" && state.role === "A") {
      return (
        <WizardFooterButton
          label={t(lang, "common.next")}
          onClick={goNext}
          disabled={!partyBJoinedAt || saving}
        />
      );
    }
    return (
      <WizardFooterButton
        label={t(lang, "common.next")}
        onClick={goNext}
        disabled={!validateStep(stepId, state) || saving}
      />
    );
  }, [
    stepId,
    goNext,
    router,
    state,
    saving,
    supabase,
    reportId,
    lang,
    onRequestClose,
    returnTo,
    partyBJoinedAt,
  ]);

  return (
    <>
      <WizardShell
        stepId={stepId}
        embedded={embedded}
        bannerMessage={bannerMessage}
        bannerDismissed={bannerDismissed}
        onDismissBanner={bannerMessage ? dismissBanner : undefined}
        onBack={goBack}
        showBack={stepId !== "driver_select"}
        onExit={handleExit}
        footer={footer}
        lang={lang}
      >
        <ScrollArea
          className={
            embedded
              ? "min-h-0 flex-1"
              : "h-[min(100dvh-120px,900px)]"
          }
        >
          {renderBody()}
        </ScrollArea>
      </WizardShell>

      <Dialog open={exitOpen} onOpenChange={setExitOpen}>
        <DialogContent showCloseButton>
          <DialogTitle>Wizard sluiten?</DialogTitle>
          <DialogDescription>
            {embedded
              ? "Je concept is opgeslagen. Je kunt later verdergaan via het menu of opnieuw vanuit de chat."
              : "Je concept is opgeslagen. Je kunt later verdergaan via het menu Ongeval melden."}
          </DialogDescription>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button variant="outline" onClick={() => setExitOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={confirmExit}>Sluiten</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-[#5F7382]">{label}</span>
      {children}
    </label>
  );
}

function YesNoBlock({
  label,
  value,
  onChange,
  lang = "nl",
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean) => void;
  lang?: OngevalLang;
}) {
  return (
    <div>
      <p className="mb-3 text-center text-[15px] font-medium text-[#163247]">
        {label}
      </p>
      <div className="flex justify-center gap-4">
        <button
          type="button"
          onClick={() => onChange(true)}
          className={`min-h-[88px] min-w-[88px] rounded-full border-2 text-[16px] font-semibold ${
            value === true
              ? "border-2 border-[#2799D7] bg-[#E8F4FB] text-[#163247] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
              : "border-2 border-[#DCE6EE] bg-white text-[#2799D7] hover:border-[#2799D7]/35"
          }`}
        >
          {t(lang, "common.yes")}
        </button>
        <button
          type="button"
          onClick={() => onChange(false)}
          className={`min-h-[88px] min-w-[88px] rounded-full border-2 text-[16px] font-semibold ${
            value === false
              ? "border-2 border-[#2799D7] bg-[#E8F4FB] text-[#163247] shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]"
              : "border-2 border-[#DCE6EE] bg-white text-[#2799D7] hover:border-[#2799D7]/35"
          }`}
        >
          {t(lang, "common.no")}
        </button>
      </div>
    </div>
  );
}

function ModeCard({
  icon: Icon,
  title,
  description,
  comingSoon,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  description: string;
  comingSoon?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3 rounded-2xl border border-black/[0.06] bg-white px-4 py-4 text-left shadow-[0_2px_12px_rgba(39,153,215,0.06)] transition-all hover:border-[#2799D7]/25 hover:shadow-[0_4px_20px_rgba(39,153,215,0.1)] active:scale-[0.995]"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#E8F4FB]/90 text-[#2799D7] ring-1 ring-[#2799D7]/10">
        <Icon className="size-6" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-heading text-[15px] font-semibold leading-tight text-[#163247]">
            {title}
          </p>
          {comingSoon ? (
            <span className="inline-flex shrink-0 rounded-full border border-[#2799D7]/15 bg-[#E8F4FB]/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2389C4]">
              Binnenkort
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[13px] leading-snug text-[#5F7382]">
          {description}
        </p>
      </div>
      <ChevronRight className="mt-1 size-5 shrink-0 text-[#2799D7]/35 transition group-hover:translate-x-0.5 group-hover:text-[#2799D7]/55" />
    </button>
  );
}

function OptionList({
  options,
  selectedId,
  onSelect,
  lang = "nl",
}: {
  options: { id: string; title: string; description: string }[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  lang?: OngevalLang;
}) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-3 px-4 py-6 md:max-w-2xl">
      {options.map((o) => {
        const selected = selectedId === o.id;
        const title = getDetailLabel(o.id, lang) || o.title;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onSelect(o.id)}
            className={`group flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-all active:scale-[0.995] ${
              selected
                ? "border-[#2799D7]/35 bg-[#E8F4FB]/90 shadow-[0_4px_20px_rgba(39,153,215,0.12)] ring-2 ring-[#2799D7]/20"
                : "border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(39,153,215,0.06)] hover:border-[#2799D7]/25 hover:shadow-[0_4px_20px_rgba(39,153,215,0.1)]"
            }`}
          >
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-heading text-[15px] font-semibold leading-tight text-[#163247]">
                {title}
              </p>
              {o.description ? (
                <p className="mt-1.5 text-[13px] leading-snug text-[#5F7382]">
                  {o.description}
                </p>
              ) : null}
            </div>
            <ChevronRight
              className={`mt-1 size-5 shrink-0 transition group-hover:translate-x-0.5 ${
                selected
                  ? "text-[#2799D7]"
                  : "text-[#2799D7]/35 group-hover:text-[#2799D7]/55"
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}

function OverviewTabs({
  state,
  lang = "nl",
}: {
  state: AccidentReportState;
  lang?: OngevalLang;
}) {
  const [tab, setTab] = useState<
    "locatie" | "vragen" | "getuigen" | "gegevens" | "raakpunt"
  >("locatie");
  const loc = state.location;
  const notFilled = t(lang, "common.not_filled");
  const notSpecified = t(lang, "common.not_specified");
  const yesNo = (v: boolean | null) =>
    v === null ? null : v ? t(lang, "common.yes") : t(lang, "common.no");
  const personLine = (p: {
    voornaam: string;
    naam: string;
  }) => [p.voornaam, p.naam].filter(Boolean).join(" ");
  const addressLine = (a: {
    straat: string;
    huisnummer: string;
    bus?: string;
    postcode: string;
    stad: string;
    land: string;
  }) => {
    const street = [a.straat, a.huisnummer].filter(Boolean).join(" ");
    const bus = a.bus ? ` bus ${a.bus}` : "";
    const city = [a.postcode, a.stad].filter(Boolean).join(" ");
    const parts = [street + bus, city, a.land].filter((p) => p && p.trim());
    return parts.join(", ");
  };

  return (
    <div className="flex min-h-[320px] flex-col">
      <div className="flex overflow-x-auto border-b border-black/[0.08] bg-white px-2">
        {(
          [
            ["locatie", t(lang, "overview.tab.location")],
            ["vragen", t(lang, "overview.tab.questions")],
            ["raakpunt", t(lang, "overview.tab.impact")],
            ["getuigen", t(lang, "overview.tab.witnesses")],
            ["gegevens", t(lang, "overview.tab.data")],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`min-h-11 flex-shrink-0 flex-1 border-b-2 px-2 py-2 text-[13px] font-medium ${
              tab === id
                ? "border-[#2799D7] text-[#2799D7]"
                : "border-transparent text-[#5F7382]"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 space-y-4 px-4 py-4">
        {tab === "locatie" ? (
          <>
            <Section title={t(lang, "overview.section.place")}>
              <Row label={t(lang, "field.street")} value={loc.straat} />
              <Row label={t(lang, "field.housenumber")} value={loc.huisnummer} />
              <Row label={t(lang, "field.postcode")} value={loc.postcode} />
              <Row label={t(lang, "field.city")} value={loc.stad} />
              <Row label={t(lang, "field.country")} value={loc.land} />
            </Section>
            <Section title={t(lang, "overview.section.time")}>
              <Row label={t(lang, "field.date")} value={formatDateForDisplay(loc.datum)} />
              <Row label={t(lang, "field.time")} value={formatTimeForDisplay(loc.tijd)} />
            </Section>
            <Section title={t(lang, "overview.section.damage")}>
              <Row
                label={t(lang, "overview.row.injuries")}
                value={yesNo(state.gewonden) ?? notSpecified}
              />
              <Row
                label={t(lang, "overview.row.other_damage")}
                value={yesNo(state.materieleSchadeAnders) ?? notSpecified}
              />
            </Section>
          </>
        ) : null}
        {tab === "vragen" ? (
          <>
            <Section title={t(lang, "overview.section.accident_type")}>
              <Row
                label={t(lang, "overview.row.category")}
                value={
                  getCategoryLabel(state.situationCategory, lang) ||
                  t(lang, "overview.empty.category")
                }
              />
              <Row
                label={t(lang, "overview.row.detail")}
                value={
                  getDetailLabel(state.situationDetailKey, lang) ||
                  t(lang, "overview.empty.detail")
                }
              />
              {state.situationCategory === "maneuver" ? (
                <>
                  <Row
                    label={t(lang, "overview.row.maneuver_a")}
                    value={
                      getDetailLabel(state.maneuverAKey, lang) ||
                      t(lang, "overview.empty.maneuver_a")
                    }
                  />
                  <Row
                    label={t(lang, "overview.row.maneuver_b")}
                    value={
                      getDetailLabel(state.maneuverBKey, lang) ||
                      t(lang, "overview.empty.maneuver_b")
                    }
                  />
                </>
              ) : null}
            </Section>
            <Section title={t(lang, "overview.section.proposal")}>
              <Row
                label={t(lang, "overview.row.proposal_accepted")}
                value={yesNo(state.proposalAccepted) ?? t(lang, "overview.empty.proposal")}
              />
              {state.proposalAccepted === false ? (
                <Row
                  label={t(lang, "overview.row.circumstances")}
                  value={state.circumstancesNotes || t(lang, "overview.empty.proposal_notes")}
                />
              ) : null}
            </Section>
            <Section title={t(lang, "overview.section.vehicle_contact")}>
              <Row
                label={t(lang, "overview.row.contact")}
                value={yesNo(state.vehicleContact) ?? notSpecified}
              />
            </Section>
          </>
        ) : null}
        {tab === "raakpunt" ? (
          <>
            <Section title={t(lang, "overview.section.impact_a")}>
              <OverviewImpactPreview party="A" point={state.impactPartyA} lang={lang} />
            </Section>
            <Section title={t(lang, "overview.section.impact_b")}>
              <OverviewImpactPreview party="B" point={state.impactPartyB} lang={lang} />
            </Section>
          </>
        ) : null}
        {tab === "getuigen" ? (
          <Section title={t(lang, "overview.section.witnesses")}>
            {state.getuigen?.trim() ? (
              <p className="whitespace-pre-wrap text-[14px] text-[#163247]">
                {state.getuigen}
              </p>
            ) : (
              <p className="text-[14px] italic text-[#5F7382]">
                {t(lang, "overview.empty.witnesses")}
              </p>
            )}
          </Section>
        ) : null}
        {tab === "gegevens" ? (
          <>
            <Section title={t(lang, "overview.section.driver_a")}>
              <Row label={t(lang, "field.lastname")} value={personLine(state.partyA.bestuurder) || notFilled} />
              <Row
                label={t(lang, "field.birthdate")}
                value={
                  formatDateForDisplay(state.partyA.bestuurder.geboortedatum) ||
                  notFilled
                }
              />
              <Row label={t(lang, "overview.row.phone")} value={state.partyA.bestuurder.telefoon || notFilled} />
              <Row label={t(lang, "overview.row.email")} value={state.partyA.bestuurder.email || notFilled} />
              <Row label={t(lang, "overview.row.license")} value={state.partyA.bestuurder.rijbewijsNummer || notFilled} />
              <Row label={t(lang, "overview.row.address")} value={addressLine(state.partyA.bestuurder.adres) || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.vehicle_a")}>
              <Row label={t(lang, "field.make_model")} value={state.partyA.voertuig.merkModel || notFilled} />
              <Row label={t(lang, "field.plate")} value={state.partyA.voertuig.nummerplaat || notFilled} />
              <Row label={t(lang, "field.country")} value={state.partyA.voertuig.landInschrijving || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.insurance_a")}>
              <Row label={t(lang, "overview.row.company")} value={state.partyA.verzekering.maatschappij || notFilled} />
              <Row label={t(lang, "overview.row.policy")} value={state.partyA.verzekering.polisnummer || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.holder_a")}>
              <Row label={t(lang, "field.lastname")} value={personLine(state.partyA.verzekeringsnemer) || notFilled} />
              <Row label={t(lang, "overview.row.enterprise")} value={state.partyA.verzekeringsnemer.ondernemingsnummer || t(lang, "common.dash")} />
              <Row label={t(lang, "overview.row.address")} value={addressLine(state.partyA.verzekeringsnemer.adres) || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.driver_b")}>
              <Row label={t(lang, "field.lastname")} value={personLine(state.partyB.bestuurder) || notFilled} />
              <Row
                label={t(lang, "field.birthdate")}
                value={
                  formatDateForDisplay(state.partyB.bestuurder.geboortedatum) ||
                  notFilled
                }
              />
              <Row label={t(lang, "overview.row.phone")} value={state.partyB.bestuurder.telefoon || notFilled} />
              <Row label={t(lang, "overview.row.email")} value={state.partyB.bestuurder.email || notFilled} />
              <Row label={t(lang, "overview.row.license")} value={state.partyB.bestuurder.rijbewijsNummer || notFilled} />
              <Row label={t(lang, "overview.row.address")} value={addressLine(state.partyB.bestuurder.adres) || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.vehicle_b")}>
              <Row label={t(lang, "field.make_model")} value={state.partyB.voertuig.merkModel || notFilled} />
              <Row label={t(lang, "field.plate")} value={state.partyB.voertuig.nummerplaat || notFilled} />
              <Row label={t(lang, "field.country")} value={state.partyB.voertuig.landInschrijving || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.insurance_b")}>
              <Row label={t(lang, "overview.row.company")} value={state.partyB.verzekering.maatschappij || notFilled} />
              <Row label={t(lang, "overview.row.policy")} value={state.partyB.verzekering.polisnummer || notFilled} />
            </Section>
            <Section title={t(lang, "overview.section.holder_b")}>
              <Row label={t(lang, "field.lastname")} value={personLine(state.partyB.verzekeringsnemer) || notFilled} />
              <Row label={t(lang, "overview.row.address")} value={addressLine(state.partyB.verzekeringsnemer.adres) || notFilled} />
            </Section>
          </>
        ) : null}
      </div>
    </div>
  );
}

function OverviewImpactPreview({
  party,
  point,
  lang = "nl",
}: {
  party: "A" | "B";
  point: { x: number; y: number } | null;
  lang?: OngevalLang;
}) {
  if (!point) {
    return (
      <p className="text-[14px] italic text-[#5F7382]">
        {t(lang, "overview.empty.impact")}
      </p>
    );
  }
  return (
    <div className="flex justify-center">
      <div className="relative w-[140px]">
        <ImpactDiagram
          label=""
          party={party}
          value={point}
          onChange={() => {}}
          readOnly
        />
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 rounded-lg border border-[#2799D7]/10 bg-[#E8F4FB]/60 px-3 py-1.5 text-[13px] font-semibold text-[#163247]">
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[12px] text-[#5F7382]">{label}</p>
      <p className="text-[15px] font-semibold text-[#163247]">{value || "—"}</p>
    </div>
  );
}

function PdfPreviewStep({
  reportId,
  guestSecret,
  lang = "nl",
}: {
  reportId: string;
  guestSecret: string | null;
  lang?: OngevalLang;
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const previewUrl = useMemo(() => {
    const base = `/api/ongeval/${reportId}/pdf`;
    return guestSecret ? `${base}?s=${encodeURIComponent(guestSecret)}` : base;
  }, [reportId, guestSecret]);

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(previewUrl, { method: "GET" });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let detail = "Onbekende fout";
        try {
          const parsed = JSON.parse(text);
          detail = parsed?.detail || parsed?.error || detail;
        } catch {
          detail = text || `HTTP ${res.status}`;
        }
        throw new Error(detail);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Unknown error");
      toast.error(t(lang, "complete.error_title"));
    } finally {
      setLoading(false);
    }
  }, [previewUrl, lang]);

  useEffect(() => {
    void loadPreview();
    return () => {
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUrl]);

  const download = useCallback(() => {
    const dlUrl = guestSecret
      ? `${previewUrl}&dl=1`
      : `${previewUrl}?dl=1`;
    const a = document.createElement("a");
    a.href = dlUrl;
    a.download = `aanrijdingsformulier-${reportId}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [previewUrl, guestSecret, reportId]);

  return (
    <div className="flex flex-col gap-4 px-4 py-6">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-[18px] font-semibold text-[#163247]">
          {t(lang, "complete.title")}
        </p>
        <p className="text-[13px] leading-relaxed text-[#5F7382]">
          {t(lang, "complete.subtitle")}
        </p>
      </div>
      <div className="relative min-h-[420px] overflow-hidden rounded-2xl border border-black/[0.08] bg-[#F7F9FC]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center text-[13px] text-[#5F7382]">
            {t(lang, "complete.loading")}
          </div>
        ) : null}
        {errorMessage && !loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-[14px] font-medium text-[#B42318]">
              {t(lang, "complete.error_title")}
            </p>
            <p className="text-[12px] text-[#5F7382]">{errorMessage}</p>
            <Button
              type="button"
              onClick={() => {
                void loadPreview();
              }}
              className="h-10 rounded-lg bg-[#2799D7] text-[13px] font-semibold text-white hover:bg-[#1e7bb0]"
            >
              {t(lang, "complete.retry")}
            </Button>
          </div>
        ) : null}
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="h-[520px] w-full"
            title="European accident statement preview"
          />
        ) : null}
      </div>
      <div className="mx-auto flex w-full max-w-sm flex-col gap-2">
        <Button
          type="button"
          disabled={!pdfUrl}
          onClick={download}
          className="h-12 w-full justify-center gap-2 rounded-xl bg-[#2389C4] text-[15px] font-semibold text-white shadow-[0_4px_14px_rgba(35,137,196,0.25)] hover:bg-[#1e7bb0] active:bg-[#1a6a9a] disabled:opacity-50 disabled:shadow-none"
        >
          <Download aria-hidden="true" />
          {t(lang, "complete.download")}
        </Button>
      </div>
    </div>
  );
}
