"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AllphiLoader } from "@/components/allphi-loader";

export default function SetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const isWijzigen = searchParams.get("wijzigen") === "1";
  const supabase = createClient();

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

      toast.success(
        isWijzigen
          ? "Wachtwoord gewijzigd! Je wordt doorgestuurd."
          : "Wachtwoord ingesteld! Je wordt doorgestuurd.",
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user?.email) {
        const { data: medewerker } = await supabase
          .from("medewerkers")
          .select("role, rol")
          .ilike("emailadres", user.email)
          .maybeSingle();

        const role = (medewerker as { role?: string | null; rol?: string | null } | null)
          ? (medewerker as { role?: string | null; rol?: string | null }).role ??
            (medewerker as { role?: string | null; rol?: string | null }).rol ??
            "medewerker"
          : "medewerker";

        const isFleet = role === "fleet_manager" || role === "management";
        router.push(isFleet ? "/inbox" : "/chat");
      } else {
        router.push("/chat");
      }
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
      className="w-full max-w-sm touch-manipulation"
    >
      <div className="text-center mb-8">
        <div
          className="stitch-gradient-fill mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full shadow-lg shadow-[0_12px_40px_rgba(0,98,142,0.22)]"
          aria-hidden={true}
        >
          <Lock className="h-8 w-8 text-primary-foreground" strokeWidth={1.75} />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">
          {isWijzigen ? "Wachtwoord wijzigen" : "Wachtwoord instellen"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {isWijzigen
            ? "Vul hieronder je nieuwe wachtwoord in."
            : "Kies een wachtwoord voor je Fleet Companion account."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="touch-manipulation space-y-3">
        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Nieuw wachtwoord"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            className="w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <div className="relative">
          <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground" />
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Bevestig wachtwoord"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-xl border border-input bg-card py-3 pl-11 pr-4 text-sm text-foreground transition-all placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/30"
          />
        </div>

        <p className="pl-1 text-xs text-muted-foreground">Minstens 8 tekens</p>

        <button
          type="submit"
          disabled={isLoading || !password || !confirm}
          className="stitch-btn-primary flex min-h-12 w-full items-center justify-center rounded-xl px-4 py-3 text-sm font-semibold shadow-md transition-[filter,transform] duration-150 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <AllphiLoader size={16} />
          ) : (
            isWijzigen ? "Nieuw wachtwoord opslaan" : "Wachtwoord opslaan"
          )}
        </button>

        <button
          type="button"
          disabled={isLoading}
          onClick={() => router.push("/chat")}
          className="w-full rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          Annuleren
        </button>
      </form>
    </motion.div>
  );
}
