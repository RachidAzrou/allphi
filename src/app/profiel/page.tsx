"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, Lock, Mail, MapPin, Phone, User } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { LoadingState } from "@/components/loading-state";
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
    <div className="flex min-h-[100dvh] flex-col bg-[#F7F9FC]">
      <AppHeader userEmail={userEmail} userDisplayName={userDisplayName} />

      {loading ? (
        <div className="flex min-h-0 flex-1 items-center justify-center">
          <LoadingState subtitle="We halen je profielgegevens op…" />
        </div>
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-6 lg:px-8">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E8F4FB] text-[#2799D7]"
                aria-hidden
              >
                <User className="size-5" strokeWidth={1.75} aria-hidden />
              </span>
              <h2 className="font-heading text-xl font-semibold text-[#163247]">
                Mijn profiel
              </h2>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-[#5F7382]">
              Je persoonlijke gegevens en contactinformatie.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:gap-4">
            <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(39,153,215,0.06)]">
              <div className="flex items-center gap-2 text-[#163247]">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8F4FB]/90 text-[#2799D7] ring-1 ring-[#2799D7]/10"
                  aria-hidden
                >
                  <User className="size-4.5" strokeWidth={1.9} aria-hidden />
                </span>
                <p className="font-heading text-[15px] font-semibold tracking-tight text-[#163247]">
                  Persoon
                </p>
              </div>
              <div className="mt-3 space-y-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#5F7382]">Naam</p>
                  <p className="mt-0.5 break-words text-[15px] font-semibold text-[#163247]">
                    {name || "—"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#5F7382]">E-mail</p>
                  <p className="mt-0.5 break-all text-[15px] font-semibold text-[#163247]">
                    {email || "—"}
                  </p>
                </div>

                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#5F7382]">Telefoon</p>
                  <p className="mt-0.5 break-words text-[15px] font-semibold text-[#163247]">
                    {phone || "—"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(39,153,215,0.06)]">
              <div className="flex items-center gap-2 text-[#163247]">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8F4FB]/90 text-[#2799D7] ring-1 ring-[#2799D7]/10"
                  aria-hidden
                >
                  <MapPin className="size-4.5" strokeWidth={1.9} aria-hidden />
                </span>
                <p className="font-heading text-[15px] font-semibold tracking-tight text-[#163247]">
                  Adres
                </p>
              </div>
              <div className="mt-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-[#5F7382]">Adresgegevens</p>
                  {address ? (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-[12px] text-[#5F7382]">Straat</p>
                        <p className="mt-0.5 break-words text-[15px] font-semibold text-[#163247]">
                          {straat || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#5F7382]">Huisnummer</p>
                        <p className="mt-0.5 break-words text-[15px] font-semibold text-[#163247]">
                          {huisnummer || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#5F7382]">Bus</p>
                        <p className="mt-0.5 break-words text-[15px] font-semibold text-[#163247]">
                          {bus || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#5F7382]">Postcode</p>
                        <p className="mt-0.5 break-words text-[15px] font-semibold text-[#163247]">
                          {postcode || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#5F7382]">Stad</p>
                        <p className="mt-0.5 break-words text-[15px] font-semibold text-[#163247]">
                          {stad || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[12px] text-[#5F7382]">Land</p>
                        <p className="mt-0.5 break-words text-[15px] font-semibold text-[#163247]">
                          {land || "—"}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-0.5 whitespace-pre-line break-words text-[15px] font-semibold text-[#163247]">
                      —
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-black/[0.06] bg-white p-4 shadow-[0_2px_12px_rgba(39,153,215,0.06)]">
              <div className="flex items-center gap-2 text-[#163247]">
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-[#E8F4FB]/90 text-[#2799D7] ring-1 ring-[#2799D7]/10"
                  aria-hidden
                >
                  <KeyRound className="size-4.5" strokeWidth={1.9} aria-hidden />
                </span>
                <p className="font-heading text-[15px] font-semibold tracking-tight text-[#163247]">
                  Beveiliging
                </p>
              </div>

              <div className="mt-3">
                <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
                  <DialogTrigger
                    render={
                      <Button
                        type="button"
                        className="h-11 w-full rounded-xl bg-[#2799D7] text-white hover:bg-[#1E7AB0]"
                      />
                    }
                  >
                    Wachtwoord wijzigen
                  </DialogTrigger>

                  <DialogContent className="bg-white">
                    <DialogHeader>
                      <DialogTitle>Wachtwoord wijzigen</DialogTitle>
                      <DialogDescription>
                        Geef je huidige wachtwoord in en kies een nieuw wachtwoord (minstens 8
                        tekens).
                      </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleChangePassword} className="space-y-3">
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#5F7382]" />
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="Huidig wachtwoord"
                          required
                          autoComplete="current-password"
                          className="w-full rounded-xl border border-[#DCE6EE] bg-white py-3 pl-11 pr-4 text-sm text-[#163247] placeholder:text-[#5F7382]/50 transition-all focus:border-[#2799D7] focus:outline-none focus:ring-2 focus:ring-[#2799D7]/30"
                        />
                      </div>

                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#5F7382]" />
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="Nieuw wachtwoord"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          className="w-full rounded-xl border border-[#DCE6EE] bg-white py-3 pl-11 pr-4 text-sm text-[#163247] placeholder:text-[#5F7382]/50 transition-all focus:border-[#2799D7] focus:outline-none focus:ring-2 focus:ring-[#2799D7]/30"
                        />
                      </div>

                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-[#5F7382]" />
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="Bevestig nieuw wachtwoord"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          className="w-full rounded-xl border border-[#DCE6EE] bg-white py-3 pl-11 pr-4 text-sm text-[#163247] placeholder:text-[#5F7382]/50 transition-all focus:border-[#2799D7] focus:outline-none focus:ring-2 focus:ring-[#2799D7]/30"
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
                          className="h-11 w-full rounded-xl bg-[#2799D7] text-white hover:bg-[#1E7AB0]"
                        >
                          {isSavingPassword ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                          ) : (
                            "Wachtwoord opslaan"
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={isSavingPassword}
                          className="h-11 w-full rounded-xl"
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
            </div>

          </div>
        </div>
      )}
    </div>
  );
}

