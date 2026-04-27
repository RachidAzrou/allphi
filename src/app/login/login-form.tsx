"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, CheckCircle2, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AllphiLoader } from "@/components/allphi-loader";

type Mode = "login" | "activate" | "forgot";

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [voornaam, setVoornaam] = useState("");
  const [naam, setNaam] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const authError = searchParams.get("error");

  const supabase = createClient();

  useEffect(() => {
    if (authError === "no_access") {
      toast.error("Je hebt geen toegang tot deze applicatie. Neem contact op met je fleet manager.");
    } else if (authError === "auth_failed") {
      toast.error("Authenticatie mislukt. Probeer het opnieuw.");
    }
  }, [authError]);

  const checkMedewerker = async (options?: {
    withNames?: boolean;
  }): Promise<boolean> => {
    const body: { email: string; naam?: string; voornaam?: string } = {
      email: email.trim().toLowerCase(),
    };
    if (options?.withNames) {
      body.voornaam = voornaam.trim();
      body.naam = naam.trim();
    }

    const res = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      toast.error("Er ging iets mis bij het controleren van je gegevens. Probeer het later opnieuw.");
      return false;
    }

    const { exists } = await res.json();

    if (!exists) {
      if (options?.withNames) {
        toast.error(
          "Voornaam, naam en e-mail komen niet overeen met onze gegevens. Controleer je invoer of neem contact op met je fleet manager.",
        );
      } else {
        toast.error(
          "Je kan alleen inloggen als je door je organisatie bent toegevoegd aan Fleet Companion.",
        );
      }
      return false;
    }

    return true;
  };

  const handleLogin = async () => {
    const exists = await checkMedewerker();
    if (!exists) return;

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      toast.error("Onjuist e-mailadres of wachtwoord.");
      return;
    }

    const { data: medewerker, error: medewerkerError } = await supabase
      .from("medewerkers")
      .select("role, rol")
      .eq("emailadres", email.trim().toLowerCase())
      .maybeSingle();

    if (medewerkerError) {
      console.error(medewerkerError);
      router.push("/chat");
      return;
    }

    const role = (medewerker as { role?: string | null; rol?: string | null } | null)
      ? (medewerker as { role?: string | null; rol?: string | null }).role ??
        (medewerker as { role?: string | null; rol?: string | null }).rol ??
        "medewerker"
      : "medewerker";

    const isFleet = role === "fleet_manager" || role === "management";
    try {
      window.localStorage.setItem("allphi:isFleet", isFleet ? "1" : "0");
    } catch {
      // ignore
    }
    router.push(isFleet ? "/fleet-manager" : "/chat");
  };

  const handleActivate = async () => {
    const exists = await checkMedewerker({ withNames: true });
    if (!exists) return;

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      if (error.status === 429) {
        toast.error("Je hebt te veel e-mails aangevraagd. Wacht even en probeer het over 60 seconden opnieuw.");
      } else {
        toast.error("Versturen van de bevestigingsmail mislukt. Probeer het later opnieuw.");
      }
      return;
    }

    setIsSent(true);
  };

  const handleForgot = async () => {
    const exists = await checkMedewerker();
    if (!exists) return;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    });

    if (error) {
      if (error.status === 429) {
        toast.error("Je hebt te veel e-mails aangevraagd. Wacht even en probeer het over 60 seconden opnieuw.");
      } else {
        toast.error("Versturen van de reset-mail mislukt. Probeer het later opnieuw.");
      }
      return;
    }

    setIsSent(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (mode === "login") await handleLogin();
      else if (mode === "activate") await handleActivate();
      else await handleForgot();
    } catch {
      toast.error("Er is een onverwachte fout opgetreden.");
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setPassword("");
    setVoornaam("");
    setNaam("");
    setIsSent(false);
  };

  const subtitle: Record<Mode, string> = {
    login: "Log in met je werk e-mailadres",
    activate:
      "Vul je voornaam, naam en werk e-mail in om je account te activeren",
    forgot: "Ontvang een e-mail om je wachtwoord opnieuw in te stellen",
  };

  const buttonLabel: Record<Mode, string> = {
    login: "Inloggen",
    activate: "Bevestigingsmail versturen",
    forgot: "Reset-mail versturen",
  };

  const sentMessage: Record<Mode, string> = {
    login: "",
    activate: "We hebben een bevestigingsmail gestuurd naar",
    forgot: "We hebben een reset-mail gestuurd naar",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-sm touch-manipulation"
    >
      {/* Logo & Title */}
      <div className="text-center mb-8">
        <img
          src="/icons/allphi-logo.png"
          alt="AllPhi"
          width={64}
          height={64}
          className="mx-auto mb-4 h-16 w-16 rounded-full shadow-lg shadow-primary/20"
        />
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          Fleet Companion
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{subtitle[mode]}</p>
      </div>

      <AnimatePresence mode="wait">
        {!isSent ? (
          <motion.form
            key={mode}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            onSubmit={handleSubmit}
            className="touch-manipulation space-y-3"
          >
            {mode === "activate" && (
              <>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={voornaam}
                    onChange={(e) => setVoornaam(e.target.value)}
                    placeholder="Voornaam"
                    required
                    autoComplete="given-name"
                    autoFocus
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-input bg-card
                               text-sm text-foreground placeholder:text-muted-foreground/50
                               focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring
                               transition-all"
                  />
                </div>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={naam}
                    onChange={(e) => setNaam(e.target.value)}
                    placeholder="Naam"
                    required
                    autoComplete="family-name"
                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-input bg-card
                               text-sm text-foreground placeholder:text-muted-foreground/50
                               focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring
                               transition-all"
                  />
                </div>
              </>
            )}

            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@bedrijf.be"
                required
                autoComplete="email"
                autoFocus={mode !== "activate"}
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-input bg-card
                           text-sm text-foreground placeholder:text-muted-foreground/50
                           focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring
                           transition-all"
              />
            </div>

            {/* Password (login mode only) */}
            {mode === "login" && (
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Wachtwoord"
                  required
                  autoComplete="current-password"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-input bg-card
                             text-sm text-foreground placeholder:text-muted-foreground/50
                             focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring
                             transition-all"
                />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={
                isLoading ||
                !email.trim() ||
                (mode === "activate" && (!voornaam.trim() || !naam.trim())) ||
                (mode === "login" && !password)
              }
              className="stitch-btn-primary flex min-h-12 w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold shadow-md transition-[filter,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <AllphiLoader size={16} />
              ) : (
                buttonLabel[mode]
              )}
            </button>

            {/* Mode switching links */}
            <div className="pt-2 space-y-1.5 text-center text-sm">
              {mode === "login" ? (
                <>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="block w-full text-muted-foreground transition-colors hover:text-primary"
                  >
                    Wachtwoord vergeten?
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("activate")}
                    className="block w-full font-medium text-primary hover:underline"
                  >
                    Eerste keer? Activeer je account
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="block w-full font-medium text-primary hover:underline"
                >
                  Terug naar inloggen
                </button>
              )}
            </div>
          </motion.form>
        ) : (
          <motion.div
            key="sent"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-2xl border border-border bg-card p-6 text-center shadow-[0_20px_40px_rgba(24,28,32,0.06)]"
          >
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-base font-heading font-semibold text-foreground">
              Check je inbox
            </h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {sentMessage[mode]}{" "}
              <strong className="text-foreground">{email}</strong>.
              <br />
              Klik op de link in de e-mail om verder te gaan.
            </p>
            <button
              type="button"
              onClick={() => {
                setIsSent(false);
                setEmail("");
                setVoornaam("");
                setNaam("");
                setPassword("");
              }}
              className="mt-4 text-sm text-primary hover:underline"
            >
              Opnieuw beginnen
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
