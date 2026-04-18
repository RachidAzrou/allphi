"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrowserQRCodeReader } from "@zxing/browser";
import { Keyboard, QrCode } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AppHeader } from "@/components/app-header";
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
      <div className="flex min-h-[100dvh] flex-col bg-[#F7F9FC]">
        <AppHeader userEmail="" userDisplayName="" />
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-10">
          <div className="w-full rounded-2xl border border-black/[0.06] bg-white p-6 text-center shadow-[0_2px_12px_rgba(39,153,215,0.06)]">
            <h2 className="font-heading text-xl font-semibold text-[#163247]">
              Dossier koppelen…
            </h2>
            <p className="mt-2 text-[14px] leading-relaxed text-[#5F7382]">
              Even geduld, we koppelen je aan het dossier van partij A.
            </p>
            {status === "error" || error ? (
              <p className="mt-3 text-[13px] font-medium text-red-600">
                {error ?? "Er ging iets mis. Vraag partij A om de QR opnieuw te tonen."}
              </p>
            ) : (
              <div
                className="mx-auto mt-4 h-6 w-6 animate-spin rounded-full border-2 border-[#2799D7]/30 border-t-[#2799D7]"
                aria-hidden
              />
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F7F9FC]">
      <AppHeader userEmail="" userDisplayName="" />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-6 md:px-6 lg:px-8">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#163247]">
            Dossier koppelen (partij B)
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-[#5F7382]">
            Scan de QR-code van partij A om mee in te vullen, of voer de code
            manueel in.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
          <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-white shadow-[0_2px_12px_rgba(39,153,215,0.06)]">
            <div className="flex items-center justify-between gap-2 border-b border-[#2799D7]/12 bg-gradient-to-r from-[#E8F4FB] via-white to-[#F7F9FC] px-4 py-3">
              <div className="flex items-center gap-2 text-[#163247]">
                <QrCode className="size-5 text-[#2799D7]" strokeWidth={1.75} />
                <p className="font-heading text-[15px] font-semibold">
                  QR scannen
                </p>
              </div>
              <p className="text-[12px] text-[#5F7382]">
                {status === "joining" ? "Koppelen…" : "Camera"}
              </p>
            </div>
            <div className="p-4">
              <video
                ref={videoRef}
                className="aspect-[4/3] w-full rounded-xl bg-black/[0.05] object-cover"
                muted
                playsInline
              />
            </div>
          </div>

          <div className="rounded-2xl border border-black/[0.06] bg-white px-4 py-4 shadow-[0_2px_12px_rgba(39,153,215,0.06)]">
            <div className="flex items-center gap-2 text-[#163247]">
              <Keyboard className="size-5 text-[#2799D7]" strokeWidth={1.75} />
              <p className="font-heading text-[15px] font-semibold">
                Code manueel invoeren
              </p>
            </div>
            <p className="mt-1 text-[13px] text-[#5F7382]">
              Plak de link uit de QR-code, of gebruik het formaat{" "}
              <span className="font-mono">rid:secret</span>.
            </p>
            <div className="mt-3 flex gap-2">
              <Input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="Plak link of rid:secret"
              />
              <Button
                type="button"
                className="bg-[#2799D7] text-white hover:bg-[#1e7bb0]"
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
              <p className="mt-3 text-[13px] font-medium text-red-600">{error}</p>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

