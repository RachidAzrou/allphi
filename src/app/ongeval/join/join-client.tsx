"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrowserQRCodeReader } from "@zxing/browser";
import { Keyboard, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
import { AllphiLoader } from "@/components/allphi-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function parseJoinPayload(text: string): { rid: string; secret: string } | null {
  try {
    const url = new URL(text);
    const rid = url.searchParams.get("rid") ?? "";
    const secret = url.searchParams.get("s") ?? "";
    if (!rid || !secret) return null;
    return { rid, secret };
  } catch {
    const parts = text.split(":").map((s) => s.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { rid: parts[0], secret: parts[1] };
    }
    return null;
  }
}

export function JoinClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  const presetRid = searchParams.get("rid");
  const presetSecret = searchParams.get("s");
  const hasPreset = Boolean(presetRid && presetSecret);

  const [manual, setManual] = useState("");
  const [status, setStatus] = useState<
    "idle" | "scanning" | "joining" | "error"
  >(hasPreset ? "joining" : "idle");
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(
    async (rid: string, secret: string) => {
      setStatus("joining");
      setError(null);

      const { data, error: joinErr } = await supabase.rpc(
        "ongeval_join_with_secret",
        { rid, secret },
      );

      const ok = Boolean((data as { ok?: boolean } | null)?.ok);
      if (joinErr || !ok) {
        setStatus("error");
        setError("Ongeldige code. Vraag partij A om de QR opnieuw te tonen.");
        return;
      }

      router.push(`/ongeval/${rid}?s=${encodeURIComponent(secret)}`);
    },
    [router, supabase],
  );

  useEffect(() => {
    if (presetRid && presetSecret) {
      void join(presetRid, presetSecret);
    }
  }, [join, presetRid, presetSecret]);

  useEffect(() => {
    if (hasPreset) return;
    if (status === "joining") return;
    setStatus("scanning");
    setError(null);

    const reader = new BrowserQRCodeReader();
    let cancelled = false;

    (async () => {
      try {
        const video = videoRef.current;
        if (!video) return;
        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (res, err) => {
            if (cancelled) return;
            if (res) {
              const parsed = parseJoinPayload(res.getText());
              if (parsed) {
                cancelled = true;
                try {
                  controlsRef.current?.stop();
                } catch {
                  /* ignore */
                }
                void join(parsed.rid, parsed.secret);
              }
            }
            if (err) {
              // ignore decode errors
            }
          },
        );
        controlsRef.current = controls as unknown as { stop: () => void };
      } catch {
        if (cancelled) return;
        setStatus("idle");
        setError(
          "Kon camera niet starten. Gebruik de manuele code-invoer hieronder.",
        );
      }
    })();

    return () => {
      cancelled = true;
      try {
        controlsRef.current?.stop();
      } catch {
        /* ignore */
      }
    };
  }, [hasPreset, join, status]);

  if (hasPreset) {
    return (
      <div className="app-canvas flex min-h-[100dvh] flex-col">
        <AppHeader userEmail="" userDisplayName="" />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-safe py-10 safe-bottom">
          <div className="app-card w-full rounded-2xl p-6 text-center">
            <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
              Dossier koppelen…
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
              Even geduld, we koppelen je aan het dossier van partij A.
            </p>
            {status === "error" || error ? (
              <p className="mt-3 text-[13px] font-medium text-destructive">
                {error ?? "Er ging iets mis. Vraag partij A om de QR opnieuw te tonen."}
              </p>
            ) : (
              <div className="mx-auto mt-4 flex items-center justify-center">
                <AllphiLoader size={24} />
              </div>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app-canvas flex min-h-[100dvh] flex-col">
      <AppHeader userEmail="" userDisplayName="" />
      <main className="app-page-shell gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight text-foreground">
            Dossier koppelen (partij B)
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Scan de QR-code van partij A om mee in te vullen, of voer de code
            manueel in.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          <div className="app-card overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-gradient-to-r from-secondary via-card to-muted/30 px-4 py-3">
              <div className="flex items-center gap-2 text-foreground">
                <QrCode className="size-5 text-primary" strokeWidth={1.75} />
                <p className="font-heading text-[15px] font-semibold">
                  QR scannen
                </p>
              </div>
              <p className="text-[12px] text-muted-foreground">
                {status === "joining" ? "Koppelen…" : "Camera"}
              </p>
            </div>
            <div className="p-4">
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full rounded-xl bg-muted object-cover"
                muted
                playsInline
              />
            </div>
          </div>

          <div className="app-card rounded-2xl px-4 py-4">
            <div className="flex items-center gap-2 text-foreground">
              <Keyboard className="size-5 text-primary" strokeWidth={1.75} />
              <p className="font-heading text-[15px] font-semibold">
                Code manueel invoeren
              </p>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              Plak de link uit de QR-code, of gebruik het formaat{" "}
              <span className="font-mono">rid:secret</span>.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Plak link of rid:secret"
                className="min-h-12 touch-manipulation sm:min-h-10 sm:flex-1"
              />
              <Button
                type="button"
                className="min-h-12 w-full touch-manipulation sm:min-h-10 sm:w-auto sm:shrink-0"
                onClick={() => {
                  const parsed = parseJoinPayload(manual.trim());
                  if (!parsed) {
                    setError("Onbekend formaat. Plak de link of rid:secret.");
                    return;
                  }
                  void join(parsed.rid, parsed.secret);
                }}
                disabled={status === "joining"}
              >
                Koppel
              </Button>
            </div>
            {error ? (
              <p className="mt-3 text-[13px] font-medium text-destructive">{error}</p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

