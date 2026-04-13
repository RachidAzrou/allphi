"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Mail, Lock, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "activate" | "forgot";

export default function LoginForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
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

  const checkMedewerker = async (): Promise<boolean> => {
    const res = await fetch("/api/auth/check-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });

    if (!res.ok) {
      toast.error("Er ging iets mis bij het controleren van je e-mailadres. Probeer het later opnieuw.");
      return false;
    }

    const { exists } = await res.json();

    if (!exists) {
      toast.error("Je kan alleen inloggen als je door je organisatie bent toegevoegd aan Fleet Companion.");
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

    router.push("/chat");
  };

  const handleActivate = async () => {
    const exists = await checkMedewerker();
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
    setIsSent(false);
  };

  const subtitle: Record<Mode, string> = {
    login: "Log in met je werk e-mailadres",
    activate: "Ontvang een bevestigingsmail om je account te activeren",
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
      className="w-full max-w-sm"
    >
      {/* Logo & Title */}
      <div className="text-center mb-8">
        <img
          src="/icons/allphi-logo.png"
          alt="AllPhi"
          width={64}
          height={64}
          className="w-16 h-16 rounded-full mx-auto mb-4 shadow-lg shadow-[#2799D7]/20"
        />
        <h1 className="text-2xl font-heading font-bold text-[#163247]">
          Fleet Companion
        </h1>
        <p className="text-sm text-[#5F7382] mt-1.5">{subtitle[mode]}</p>
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
            className="space-y-3"
          >
            {/* Email */}
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#5F7382]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="naam@bedrijf.be"
                required
                autoComplete="email"
                autoFocus
                className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#DCE6EE] bg-white
                           text-sm text-[#163247] placeholder:text-[#5F7382]/50
                           focus:outline-none focus:ring-2 focus:ring-[#2799D7]/30 focus:border-[#2799D7]
                           transition-all"
              />
            </div>

            {/* Password (login mode only) */}
            {mode === "login" && (
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#5F7382]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Wachtwoord"
                  required
                  autoComplete="current-password"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#DCE6EE] bg-white
                             text-sm text-[#163247] placeholder:text-[#5F7382]/50
                             focus:outline-none focus:ring-2 focus:ring-[#2799D7]/30 focus:border-[#2799D7]
                             transition-all"
                />
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading || !email.trim() || (mode === "login" && !password)}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl
                         bg-[#2799D7] text-white text-sm font-semibold
                         hover:bg-[#1E7AB0] active:scale-[0.98]
                         disabled:opacity-50 disabled:cursor-not-allowed
                         transition-all duration-150 shadow-lg shadow-[#2799D7]/20"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  {buttonLabel[mode]}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Mode switching links */}
            <div className="pt-2 space-y-1.5 text-center text-sm">
              {mode === "login" ? (
                <>
                  <button
                    type="button"
                    onClick={() => switchMode("forgot")}
                    className="block w-full text-[#5F7382] hover:text-[#2799D7] transition-colors"
                  >
                    Wachtwoord vergeten?
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode("activate")}
                    className="block w-full text-[#2799D7] font-medium hover:underline"
                  >
                    Eerste keer? Activeer je account
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="block w-full text-[#2799D7] font-medium hover:underline"
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
            className="text-center p-6 rounded-2xl bg-white border border-[#DCE6EE] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
          >
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="text-base font-heading font-semibold text-[#163247]">
              Check je inbox
            </h3>
            <p className="text-sm text-[#5F7382] mt-1.5 leading-relaxed">
              {sentMessage[mode]}{" "}
              <strong className="text-[#163247]">{email}</strong>.
              <br />
              Klik op de link in de e-mail om verder te gaan.
            </p>
            <button
              onClick={() => {
                setIsSent(false);
                setEmail("");
                setPassword("");
              }}
              className="mt-4 text-sm text-[#2799D7] hover:underline"
            >
              Ander e-mailadres gebruiken
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
