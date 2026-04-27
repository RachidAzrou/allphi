"use client";

import { useState } from "react";
import { Locate } from "lucide-react";
import { t, type OngevalLang } from "@/lib/ongeval/i18n";

type LocationValue = {
  straat: string;
  huisnummer: string;
  postcode: string;
  stad: string;
  land: string;
};

type LocationPickerProps = {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  lang?: OngevalLang;
  disabled?: boolean;
};

type NominatimAddress = {
  road?: string;
  house_number?: string;
  pedestrian?: string;
  footway?: string;
  cycleway?: string;
  residential?: string;
  postcode?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  municipality?: string;
  country?: string;
};

type NominatimResult = {
  place_id?: number;
  lat?: string;
  lon?: string;
  display_name?: string;
  address?: NominatimAddress;
};

function mapAddress(addr: NominatimAddress | undefined): LocationValue {
  if (!addr) {
    return { straat: "", huisnummer: "", postcode: "", stad: "", land: "" };
  }
  const road =
    addr.road ||
    addr.pedestrian ||
    addr.footway ||
    addr.cycleway ||
    addr.residential ||
    "";
  const stad =
    addr.city ||
    addr.town ||
    addr.village ||
    addr.hamlet ||
    addr.municipality ||
    "";
  return {
    straat: road,
    huisnummer: addr.house_number ?? "",
    postcode: addr.postcode ?? "",
    stad,
    land: addr.country ?? "",
  };
}

/**
 * Licht-gewicht locatiekiezer:
 *  - "Gebruik huidige locatie" met browser Geolocation + Nominatim reverse.
 *
 * Nominatim verplicht fair-use: 1 req/s, User-Agent/Referrer en debounce. We
 * sturen `accept-language=nl`.
 */
export function LocationPicker({ value, onChange, lang = "nl", disabled = false }: LocationPickerProps) {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const acceptLang = lang === "fr" ? "fr" : lang === "en" ? "en" : "nl";

  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError(t(lang, "location.picker.unavailable"));
      return;
    }
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setError(t(lang, "location.picker.insecure"));
      return;
    }
    if (locating || disabled) return;
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=${acceptLang}&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
          );
          if (res.status === 429) {
            throw new Error("rate_limited");
          }
          if (!res.ok) throw new Error("reverse_failed");
          const data = (await res.json()) as NominatimResult;
          const mapped = mapAddress(data.address);
          const hasAny =
            mapped.straat.trim() ||
            mapped.huisnummer.trim() ||
            mapped.postcode.trim() ||
            mapped.stad.trim() ||
            mapped.land.trim();
          if (!hasAny) {
            setError(t(lang, "location.picker.no_address"));
            return;
          }
          onChange({ ...value, ...mapped });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          setError(
            msg === "rate_limited"
              ? t(lang, "location.picker.rate_limited")
              : t(lang, "location.picker.geocode_failed"),
          );
        } finally {
          setLocating(false);
        }
      },
      (err) => {
        setLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          setError(t(lang, "location.picker.permission_denied"));
        } else {
          setError(t(lang, "location.picker.locate_failed"));
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={locating || disabled}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-card px-3 text-[14px] font-semibold text-primary shadow-sm transition-colors hover:bg-secondary disabled:opacity-50"
      >
        <Locate className="size-4" strokeWidth={2} />
        {locating
          ? t(lang, "location.picker.locating")
          : t(lang, "location.picker.use_current")}
      </button>
      {error ? (
        <p className="text-[12px] text-destructive">{error}</p>
      ) : null}
    </div>
  );
}
