"use client";

import { useEffect, useRef, useState } from "react";
import { Locate, MapPin, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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
 *  - Vrije-tekst zoekbalk met autocomplete via Nominatim search.
 *
 * Nominatim verplicht fair-use: 1 req/s, User-Agent/Referrer en debounce. We
 * sturen `accept-language=nl` en respecteren de debounce van 450 ms.
 */
export function LocationPicker({ value, onChange, lang = "nl", disabled = false }: LocationPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestQueryRef = useRef("");
  const acceptLang = lang === "fr" ? "fr" : lang === "en" ? "en" : "nl";

  useEffect(() => {
    const trimmed = query.trim();
    latestQueryRef.current = trimmed;
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&accept-language=${acceptLang}&q=${encodeURIComponent(trimmed)}`,
          { headers: { "Accept": "application/json" } },
        );
        if (!res.ok) throw new Error("search_failed");
        const data = (await res.json()) as NominatimResult[];
        if (latestQueryRef.current === trimmed) {
          setResults(Array.isArray(data) ? data : []);
        }
      } catch {
        // Stil: autocomplete is secundair.
      } finally {
        setSearching(false);
      }
    }, 450);
    return () => window.clearTimeout(timer);
  }, [query, acceptLang]);

  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError(t(lang, "location.picker.unavailable"));
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&accept-language=${acceptLang}&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`,
          );
          if (!res.ok) throw new Error("reverse_failed");
          const data = (await res.json()) as NominatimResult;
          const mapped = mapAddress(data.address);
          onChange({ ...value, ...mapped });
        } catch {
          setError(t(lang, "location.picker.geocode_failed"));
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

  const applyResult = (r: NominatimResult) => {
    const mapped = mapAddress(r.address);
    onChange({ ...value, ...mapped });
    setQuery(r.display_name ?? "");
    setResults([]);
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={useCurrentLocation}
        disabled={locating || disabled}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#2799D7]/25 bg-white px-3 text-[14px] font-semibold text-[#2799D7] shadow-sm transition-colors hover:bg-[#E8F4FB] disabled:opacity-50"
      >
        <Locate className="size-4" strokeWidth={2} />
        {locating
          ? t(lang, "location.picker.locating")
          : t(lang, "location.picker.use_current")}
      </button>
      <div className="relative">
        <div className="flex items-center gap-2 rounded-xl border border-black/[0.08] bg-white px-3">
          <Search className="size-4 text-[#5F7382]" strokeWidth={2} />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(lang, "location.picker.search_placeholder")}
            disabled={disabled}
            className="h-11 flex-1 border-0 bg-transparent px-0 text-[14px] shadow-none focus-visible:ring-0"
          />
        </div>
        {results.length > 0 ? (
          <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-black/[0.08] bg-white shadow-lg">
            {results.map((r) => (
              <button
                key={r.place_id}
                type="button"
                onClick={() => applyResult(r)}
                className="flex w-full items-start gap-2 border-b border-black/[0.04] px-3 py-2 text-left last:border-b-0 hover:bg-[#F4F8FB]"
              >
                <MapPin className="mt-0.5 size-4 shrink-0 text-[#2799D7]" strokeWidth={2} />
                <span className="text-[13px] leading-snug text-[#163247]">
                  {r.display_name}
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {searching ? (
          <p className="mt-1 text-[11px] text-[#5F7382]">
            {t(lang, "location.picker.searching")}
          </p>
        ) : null}
      </div>
      {error ? (
        <p className="text-[12px] text-[#B42318]">{error}</p>
      ) : null}
    </div>
  );
}
