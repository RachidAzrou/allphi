"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Lock, ArrowRight, Loader2 } from "lucide-react";

export default function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      toast.error("Je wachtwoord moet minstens 8 tekens lang zijn.");
      return;
    }

    if (password !== confirm) {
      toast.error("De wachtwoorden komen niet overeen.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        console.error("[set-password] API error:", data.error);
        toast.error("Wachtwoord instellen mislukt. Probeer het opnieuw.");
        return;
      }

      toast.success("Wachtwoord ingesteld! Je wordt doorgestuurd.");
      router.push("/chat");
    } catch {
      toast.error("Er is een onverwachte fout opgetreden.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-sm"
    >
      <div className="text-center mb-8">
        <img
          src="/icons/allphi-logo.png"
          alt="AllPhi"
          width={64}
          height={64}
          className="w-16 h-16 rounded-full mx-auto mb-4 shadow-lg shadow-[#2799D7]/20"
        />
        <h1 className="text-2xl font-heading font-bold text-[#163247]">
          Wachtwoord instellen
        </h1>
        <p className="text-sm text-[#5F7382] mt-1.5">
          Kies een wachtwoord voor je Fleet Companion account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#5F7382]" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nieuw wachtwoord"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#DCE6EE] bg-white
                       text-sm text-[#163247] placeholder:text-[#5F7382]/50
                       focus:outline-none focus:ring-2 focus:ring-[#2799D7]/30 focus:border-[#2799D7]
                       transition-all"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#5F7382]" />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Bevestig wachtwoord"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-[#DCE6EE] bg-white
                       text-sm text-[#163247] placeholder:text-[#5F7382]/50
                       focus:outline-none focus:ring-2 focus:ring-[#2799D7]/30 focus:border-[#2799D7]
                       transition-all"
          />
        </div>

        <p className="text-xs text-[#5F7382] pl-1">Minstens 8 tekens</p>

        <button
          type="submit"
          disabled={isLoading || !password || !confirm}
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
              Wachtwoord opslaan
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
