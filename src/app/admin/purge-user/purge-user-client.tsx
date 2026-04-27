"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppHeader } from "@/components/app-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TbTrash } from "react-icons/tb";

type PurgeResult =
  | { ok: true; userId: string; deleted: unknown }
  | { ok: false; error: string };

export function PurgeUserClient(props: { userEmail: string; userDisplayName: string }) {
  const [email, setEmail] = useState("razrou@outlook.be");
  const [confirm, setConfirm] = useState(false);
  const [fleetManagerEmployee, setFleetManagerEmployee] = useState(false);
  const [busy, setBusy] = useState(false);

  const canRun = useMemo(
    () => !!email.trim() && confirm && !busy,
    [email, confirm, busy],
  );

  const run = async () => {
    if (!canRun) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/purge-user-data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          scope: fleetManagerEmployee ? "fleet_manager_employee" : "user",
        }),
      });
      const json = (await res.json()) as PurgeResult;
      if (!json.ok) {
        toast.error(json.error || "Verwijderen mislukt");
        return;
      }
      toast.success("Verwijderd");
    } catch (e) {
      console.error(e);
      toast.error("Verwijderen mislukt");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader userEmail={props.userEmail} userDisplayName={props.userDisplayName} />

      <main className="app-page-shell app-page-shell-wide">
        <header className="touch-manipulation pt-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card text-primary shadow-sm"
                aria-hidden="true"
              >
                <TbTrash className="h-6 w-6" aria-hidden="true" />
              </span>
              <h1 className="font-heading text-[1.375rem] font-bold leading-[1.15] tracking-tight text-foreground sm:text-[1.625rem]">
                Gebruikersdata
              </h1>
            </div>
            <p className="mt-1 text-sm leading-snug text-muted-foreground">
              Verwijdert chat-berichten + bijlagen, en ongeval-aangiftes + scans voor een gebruiker.
            </p>
          </div>
        </header>

        <section className="mt-8 sm:mt-10" aria-label="Gebruikersdata">
          <h2 className="px-1 pb-2 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">
            Verwijderen
          </h2>

          <div className="app-ios-group">
            <div className="px-4 py-4">
              <div className="grid gap-4">
                <label className="grid gap-1.5">
                  <span className="text-[12px] font-semibold text-muted-foreground">E-mailadres</span>
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    autoComplete="off"
                    inputMode="email"
                  />
                </label>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    checked={confirm}
                    onChange={(e) => setConfirm(e.target.checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    Ik bevestig dat ik alle berichten en aangiftes voor dit e-mailadres wil verwijderen.
                  </span>
                </label>

                <label className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 rounded border-border"
                    checked={fleetManagerEmployee}
                    onChange={(e) => setFleetManagerEmployee(e.target.checked)}
                  />
                  <span className="text-sm text-muted-foreground">
                    Ook fleetmanager-medewerker opruimen (fleet manager replies/broadcasts + medewerker record).
                  </span>
                </label>

                <div className="flex flex-col items-stretch gap-1 sm:items-end">
                  <Button
                    onClick={() => void run()}
                    disabled={!canRun}
                    variant="outline"
                    className="h-10 border border-destructive bg-destructive text-white shadow-sm hover:bg-destructive/90 active:bg-destructive sm:w-auto"
                  >
                    {busy ? "Bezig…" : "Verwijderen"}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Let op: dit is onomkeerbaar.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

