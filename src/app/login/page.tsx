"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();
  const authError = searchParams.get("error");

  const supabase = createClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signInError) {
        setError("Inloggen mislukt. Controleer je e-mailadres en probeer opnieuw.");
        return;
      }

      setIsSent(true);
    } catch {
      setError("Er is een onverwachte fout opgetreden.");
    } finally {
      setIsLoading(false);
    }
  };

  const getAuthErrorMessage = (code: string | null) => {
    switch (code) {
      case "no_access":
        return "Je hebt geen toegang tot deze applicatie. Neem contact op met je fleet manager.";
      case "auth_failed":
        return "Authenticatie mislukt. Probeer het opnieuw.";
      default:
        return null;
    }
  };

  const authErrorMessage = getAuthErrorMessage(authError);

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC]">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm"
        >
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-[#2799D7] flex items-center justify-center mx-auto mb-4 shadow-lg shadow-[#2799D7]/20">
              <span className="text-2xl font-heading font-bold text-white">φ</span>
            </div>
            <h1 className="text-2xl font-heading font-bold text-[#163247]">
              Fleet Companion
            </h1>
            <p className="text-sm text-[#5F7382] mt-1.5">
              Log in met je werk e-mailadres
            </p>
          </div>

          {/* Error messages */}
          {(authErrorMessage || error) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700"
            >
              {authErrorMessage || error}
            </motion.div>
          )}

          {!isSent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
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
                    Inloggen via e-mail
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-6 rounded-2xl bg-white border border-[#DCE6EE] shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <h3 className="text-base font-heading font-semibold text-[#163247]">
                Check je inbox
              </h3>
              <p className="text-sm text-[#5F7382] mt-1.5 leading-relaxed">
                We hebben een login-link gestuurd naar{" "}
                <strong className="text-[#163247]">{email}</strong>.
                <br />
                Klik op de link om in te loggen.
              </p>
              <button
                onClick={() => {
                  setIsSent(false);
                  setEmail("");
                }}
                className="mt-4 text-sm text-[#2799D7] hover:underline"
              >
                Ander e-mailadres gebruiken
              </button>
            </motion.div>
          )}

          <p className="text-center text-xs text-[#5F7382] mt-6">
            Alleen medewerkers met een actief profiel hebben toegang.
          </p>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="text-center py-4">
        <p className="text-xs text-[#5F7382]/60">
          AllPhi Fleet Companion
        </p>
      </div>
    </div>
  );
}
