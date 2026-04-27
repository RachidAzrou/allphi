"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
import { AllphiLoader } from "@/components/allphi-loader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type MedewerkerRow = Record<string, unknown> & {
  id?: string;
  voornaam?: string | null;
  naam?: string | null;
  emailadres?: string | null;
  telefoonnummer?: string | null;
  geboortedatum?: string | null;
  straat?: string | null;
  huisnummer?: string | null;
  bus?: string | null;
  postcode?: string | null;
  stad?: string | null;
  land?: string | null;
  rijbewijsnummer?: string | null;
  rijbewijsNummer?: string | null;
  rijbewijscategorie?: string | null;
  rijbewijsCategorie?: string | null;
  rijbewijsgeldigTot?: string | null;
  rijbewijsGeldigTot?: string | null;
};

function asText(v: unknown): string {
  if (typeof v !== "string") return "";
  return v.trim();
}

function joinNonEmpty(parts: Array<string | undefined | null>, sep = " "): string {
  return parts
    .filter((p): p is string => typeof p === "string" && p.trim().length > 0)
    .map((p) => p.trim())
    .join(sep);
}

function formatAddress(medewerker: MedewerkerRow | null): string {
  if (!medewerker) return "";

  const straat = asText(medewerker.straat);
  const huisnummer = asText(medewerker.huisnummer);
  const bus = asText(medewerker.bus);
  const postcode = asText(medewerker.postcode);
  const stad = asText(medewerker.stad);
  const land = asText(medewerker.land);

  const line1 = joinNonEmpty(
    [straat, joinNonEmpty([huisnummer, bus ? `bus ${bus}` : ""], " ")],
    " "
  );
  const line2 = joinNonEmpty([postcode, stad], " ");
  const line3 = land;

  return [line1, line2, line3].filter((l) => l.trim().length > 0).join("\n");
}

export default function ProfielPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [userEmail, setUserEmail] = useState("");
  const [userDisplayName, setUserDisplayName] = useState("");

  const [medewerker, setMedewerker] = useState<MedewerkerRow | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [tab, setTab] = useState<"persoon" | "adres" | "extra">("persoon");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) {
        router.replace("/login");
        return;
      }

      setUserEmail(user.email);

      const { data: m, error: mError } = await supabase
        .from("medewerkers")
        .select("*")
        .eq("emailadres", user.email)
        .maybeSingle();

      if (cancelled) return;

      if (mError) {
        console.error(mError);
        toast.error("Kon je profiel niet laden.");
        setLoading(false);
        return;
      }

      if (!m) {
        toast.error("Geen medewerkerprofiel gevonden voor dit account.");
        setLoading(false);
        return;
      }

      const mRow = (m as unknown as MedewerkerRow) ?? null;
      setMedewerker(mRow);

      const volledigeNaam = joinNonEmpty([asText(mRow.voornaam), asText(mRow.naam)]);
      if (volledigeNaam) setUserDisplayName(volledigeNaam);

      if (!cancelled) setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [router, supabase]);

  const name = joinNonEmpty([asText(medewerker?.voornaam), asText(medewerker?.naam)]);
  const email = asText(medewerker?.emailadres) || userEmail;
  const phone = asText(medewerker?.telefoonnummer);
  const address = formatAddress(medewerker);
  const straat = asText(medewerker?.straat);
  const huisnummer = asText(medewerker?.huisnummer);
  const bus = asText(medewerker?.bus);
  const postcode = asText(medewerker?.postcode);
  const stad = asText(medewerker?.stad);
  const land = asText(medewerker?.land);

  const firstNonEmptyString = (obj: unknown, keys: string[]): string => {
    if (!obj || typeof obj !== "object") return "";
    for (const k of keys) {
      const v = (obj as any)[k];
      if (typeof v === "string" && v.trim().length > 0) return v.trim();
    }
    return "";
  };

  const rijbewijsNummer = firstNonEmptyString(medewerker, ["rijbewijsNummer", "rijbewijsnummer"]);
  const rijbewijsCategorie = firstNonEmptyString(medewerker, ["rijbewijsCategorie", "rijbewijscategorie"]);
  const rijbewijsGeldigTot = firstNonEmptyString(medewerker, ["rijbewijsGeldigTot", "rijbewijsgeldigTot"]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Geen e-mailadres gevonden voor dit account.");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Je nieuwe wachtwoord moet minstens 8 tekens lang zijn.");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("De nieuwe wachtwoorden komen niet overeen.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });

      if (reauthError) {
        toast.error("Huidig wachtwoord klopt niet.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        console.error(updateError);
        toast.error("Wachtwoord wijzigen mislukt. Probeer het opnieuw.");
        return;
      }

      toast.success("Wachtwoord gewijzigd.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordDialogOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Er is een onverwachte fout opgetreden.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <div className="app-canvas flex min-h-dvh flex-col">
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-safe">
          <LoadingState subtitle="We halen je profielgegevens op…" />
        </div>
      ) : (
        <main className="app-page-shell">
          <header className="flex items-center gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
              aria-hidden
            >
              <User className="size-5" strokeWidth={1.75} aria-hidden />
            </span>
            <h1 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              Mijn profiel
            </h1>
          </header>

          <div className="mt-6 flex flex-col gap-6">
            <div className="app-ios-group p-1">
              <div className="grid grid-cols-3 gap-1">
                {(
                  [
                    ["persoon", "Persoon"],
                    ["adres", "Adres"],
                    ["extra", "Extra"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={[
                      "min-h-11 touch-manipulation rounded-xl px-3 text-[13px] font-semibold transition-colors",
                      tab === id
                        ? "stitch-gradient-fill shadow-sm"
                        : "text-muted-foreground hover:bg-muted/40 active:bg-muted/60",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {tab === "persoon" ? (
              <section aria-labelledby="profiel-persoon-heading">
                <h2
                  id="profiel-persoon-heading"
                  className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Persoon
                </h2>
                <div className="app-ios-group divide-y divide-border/60">
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-medium text-muted-foreground">Naam</p>
                    <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                      {name || "—"}
                    </p>
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-medium text-muted-foreground">E-mail</p>
                    <p className="mt-0.5 break-all text-[15px] font-semibold text-foreground">
                      {email || "—"}
                    </p>
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-medium text-muted-foreground">Telefoon</p>
                    <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                      {phone || "—"}
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            {tab === "adres" ? (
              <section aria-labelledby="profiel-adres-heading">
                <h2
                  id="profiel-adres-heading"
                  className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                >
                  Adres
                </h2>
                {address ? (
                  <div className="app-ios-group divide-y divide-border/60">
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">Straat</p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {straat || "—"}
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">Huisnummer</p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {huisnummer || "—"}
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">Bus</p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {bus || "—"}
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">Postcode</p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {postcode || "—"}
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">Stad</p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {stad || "—"}
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">Land</p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {land || "—"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="app-ios-group px-4 py-3.5">
                    <p className="text-[13px] font-medium text-muted-foreground">Adresgegevens</p>
                    <p className="mt-0.5 text-[15px] font-semibold text-foreground">—</p>
                  </div>
                )}
              </section>
            ) : null}

            {tab === "extra" ? (
              <>
                <section aria-labelledby="profiel-extra-heading">
                  <h2
                    id="profiel-extra-heading"
                    className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Extra gegevens
                  </h2>
                  <div className="app-ios-group divide-y divide-border/60">
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">
                        Rijbewijsnummer
                      </p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {rijbewijsNummer || "—"}
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">Categorie</p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {rijbewijsCategorie || "—"}
                      </p>
                    </div>
                    <div className="px-4 py-3.5">
                      <p className="text-[13px] font-medium text-muted-foreground">Geldig tot</p>
                      <p className="mt-0.5 break-words text-[15px] font-semibold text-foreground">
                        {rijbewijsGeldigTot || "—"}
                      </p>
                    </div>
                  </div>
                </section>

                <section aria-labelledby="profiel-beveiliging-heading">
                  <h2
                    id="profiel-beveiliging-heading"
                    className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground"
                  >
                    Beveiliging
                  </h2>
                  <div className="app-ios-group p-4">
                    <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                      <DialogTrigger
                        render={
                          <Button
                            type="button"
                            className="min-h-12 w-full touch-manipulation rounded-xl"
                          />
                        }
                      >
                        Wachtwoord wijzigen
                      </DialogTrigger>

                      <DialogContent className="bg-card">
                        <DialogHeader>
                          <DialogTitle>Wachtwoord wijzigen</DialogTitle>
                          <DialogDescription>
                            Geef je huidige wachtwoord in en kies een nieuw wachtwoord (minstens 8
                            tekens).
                          </DialogDescription>
                        </DialogHeader>

                        <form onSubmit={handleChangePassword} className="space-y-3">
                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="password"
                              value={currentPassword}
                              onChange={(e) => setCurrentPassword(e.target.value)}
                              placeholder="Huidig wachtwoord"
                              required
                              autoComplete="current-password"
                              className="stitch-focus-input min-h-12 w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-base text-foreground transition-all placeholder:text-muted-foreground/50 sm:text-sm"
                            />
                          </div>

                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="password"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder="Nieuw wachtwoord"
                              required
                              minLength={8}
                              autoComplete="new-password"
                              className="stitch-focus-input min-h-12 w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-base text-foreground transition-all placeholder:text-muted-foreground/50 sm:text-sm"
                            />
                          </div>

                          <div className="relative">
                            <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
                            <input
                              type="password"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Bevestig nieuw wachtwoord"
                              required
                              minLength={8}
                              autoComplete="new-password"
                              className="stitch-focus-input min-h-12 w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-base text-foreground transition-all placeholder:text-muted-foreground/50 sm:text-sm"
                            />
                          </div>

                          <div className="flex flex-col gap-2 pt-1">
                            <Button
                              type="submit"
                              disabled={
                                isSavingPassword ||
                                !currentPassword ||
                                !newPassword ||
                                !confirmPassword
                              }
                              className="min-h-12 w-full touch-manipulation rounded-xl"
                            >
                              {isSavingPassword ? (
                                <AllphiLoader size={16} />
                              ) : (
                                "Wachtwoord opslaan"
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              disabled={isSavingPassword}
                              className="min-h-12 w-full touch-manipulation rounded-xl"
                              onClick={() => {
                                setPasswordDialogOpen(false);
                                setCurrentPassword("");
                                setNewPassword("");
                                setConfirmPassword("");
                              }}
                            >
                              Annuleren
                            </Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </section>
              </>
            ) : null}
          </div>
        </main>
      )}
    </div>
  );
}

