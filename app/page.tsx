"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import CityTile, { type CityData } from "@/components/welcome/CityTile";
import ReportCard from "@/components/welcome/ReportCard";
import { LocationPickerSheet, type PlaceEntry } from "@/components/welcome/LocationPickerSheet";
import { ease } from "@/lib/tokens";

const LS_KEY = "rc-city-cache";
const LS_BRIEF_KEY = "rc-brief-cache";
const LS_PLACES_KEY = "rc-places";
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_PLACES = 5;

function loadPlaces(): Record<string, PlaceEntry> {
  try {
    const raw = localStorage.getItem(LS_PLACES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PlaceEntry>) : {};
  } catch { return {}; }
}

function savePlace(name: string) {
  try {
    const places = loadPlaces();
    const key = name.toLowerCase().replace(/\s+/g, "-");
    places[key] = { name, addedAt: Date.now() };
    const entries = Object.entries(places);
    if (entries.length > MAX_PLACES) {
      entries.sort((a, b) => a[1].addedAt - b[1].addedAt);
      for (const [k] of entries.slice(0, entries.length - MAX_PLACES)) delete places[k];
    }
    localStorage.setItem(LS_PLACES_KEY, JSON.stringify(places));
  } catch {}
}
const BRIEF_TTL_MS = 6 * 60 * 60 * 1000;

type LocationState = "idle" | "loading" | "done" | "denied" | "error";
type BriefState = "idle" | "loading" | "done" | "error";

interface CityCache { data: CityData; cachedAt: number; }
interface BriefCache { city: string; data: BriefData; cachedAt: number; }
interface BriefData {
  paragraphs: string[];
  images: string[];
}

function loadCache(): CityCache | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CityCache;
    if (Date.now() - parsed.cachedAt > WEEK_MS) { localStorage.removeItem(LS_KEY); return null; }
    return parsed;
  } catch { return null; }
}

function saveCache(data: CityData) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ data, cachedAt: Date.now() })); } catch {}
}

function loadBriefCache(city: string): BriefData | null {
  try {
    const raw = localStorage.getItem(LS_BRIEF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as BriefCache;
    if (parsed.city.toLowerCase() !== city.toLowerCase()) return null;
    if (Date.now() - parsed.cachedAt > BRIEF_TTL_MS) { localStorage.removeItem(LS_BRIEF_KEY); return null; }
    // Discard cache entries that predate the paragraphs/images format
    if (!parsed.data.paragraphs?.length || !parsed.data.images?.length) {
      localStorage.removeItem(LS_BRIEF_KEY);
      return null;
    }
    return parsed.data;
  } catch { return null; }
}

function saveBriefCache(city: string, data: BriefData) {
  try { localStorage.setItem(LS_BRIEF_KEY, JSON.stringify({ city, data, cachedAt: Date.now() })); } catch {}
}

export default function HomePage() {
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [locState, setLocState] = useState<LocationState>("idle");
  const [brief, setBrief] = useState<BriefData | null>(null);
  const [briefState, setBriefState] = useState<BriefState>("idle");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [savedPlaces, setSavedPlaces] = useState<Record<string, PlaceEntry>>({});

  useEffect(() => { setSavedPlaces(loadPlaces()); }, []);

  const handleLocationSelect = async (cityName: string) => {
    setLocState("loading");
    setCityData(null);
    setBrief(null);
    setBriefState("idle");
    try {
      const res = await fetch("/api/city", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: cityName }),
      });
      if (!res.ok) { setLocState("error"); return; }
      const data = (await res.json()) as CityData;
      setCityData(data);
      setLocState("done");
      saveCache(data);
      savePlace(cityName);
      setSavedPlaces(loadPlaces());
    } catch { setLocState("error"); }
  };

  useEffect(() => {
    const cached = loadCache();
    if (cached) {
      setCityData(cached.data);
      setLocState("done");
      // Do NOT restore brief from localStorage — always fetch latest from DB
    }
  }, []);

  // Auto-fetch brief whenever city becomes available (catches both cache-hit and fresh location)
  useEffect(() => {
    if (locState === "done" && cityData && briefState === "idle") {
      fetchBrief();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locState, cityData]);

  const requestLocation = () => {
    if (locState === "loading") return;
    if (!navigator.geolocation) { setLocState("error"); return; }
    setLocState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/city", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          if (!res.ok) { setLocState("error"); return; }
          const data = (await res.json()) as CityData;
          setCityData(data); setLocState("done"); saveCache(data);
        } catch { setLocState("error"); }
      },
      (err) => { setLocState(err.code === 1 ? "denied" : "error"); },
      { timeout: 12_000, maximumAge: 60_000 }
    );
  };

  const fetchBrief = async () => {
    if (!cityData || briefState === "loading") return;
    setBriefState("loading");
    try {
      const res = await fetch("/api/local-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: cityData.city }),
      });
      if (!res.ok) { setBriefState("error"); return; }
      const data = await res.json() as { paragraphs?: string[]; images?: string[] };
      const briefData: BriefData = {
        paragraphs: data.paragraphs ?? [],
        images: data.images ?? [],
      };
      setBrief(briefData);
      saveBriefCache(cityData.city, briefData);
      setBriefState("done");
    } catch { setBriefState("error"); }
  };

  return (
    <>
      {/* Location picker is a modal — lives outside the scroll tree */}
      <LocationPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        savedPlaces={savedPlaces}
        onSelect={handleLocationSelect}
      />

      <div className={`bg-white flex flex-col ${locState === "done" ? "h-dvh overflow-hidden" : "min-h-dvh"}`}>

        {/* ── Top section (sticky header once city is loaded) ───────────── */}
        <div className="shrink-0 bg-white">

          {/* Logo: fades away the moment city data arrives */}
          <AnimatePresence>
            {locState !== "done" && (
              <motion.div
                key="logo"
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.45, ease }}
                className="flex items-center gap-3 px-5 pt-14 pb-4 max-w-sm mx-auto"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.ico" alt="Raconteur" width={32} height={32} className="w-8 h-8" />
                <p className="text-[14px] font-semibold tracking-tight text-[#1d1d1f]">Raconteur</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* CityTile: wide card pre-load → full-width sticky header post-load */}
          <div className={
            locState === "done"
              ? "px-5 pt-14 pb-5"
              : "px-5 pt-1 pb-2 max-w-sm mx-auto"
          }>
            <CityTile
              data={cityData}
              locState={locState}
              onRequestLocation={requestLocation}
              onChangeLocation={() => setPickerOpen(true)}
            />
          </div>

          {/* Hairline separator under header */}
          <AnimatePresence>
            {locState === "done" && (
              <motion.div
                key="divider"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="h-px bg-gray-100"
              />
            )}
          </AnimatePresence>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex flex-col items-center gap-5 px-5 pt-5 pb-12 max-w-sm mx-auto">

            <AnimatePresence mode="wait">
              {locState === "done" && briefState === "idle" && (
                <motion.button
                  key="brief-btn"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, transition: { duration: 0.25, ease } }}
                  transition={{ duration: 0.55, ease }}
                  onClick={fetchBrief}
                  className="w-full py-3.5 rounded-xl bg-[#f5f5f7] text-[#1d1d1f] text-[14px] font-medium text-center active:scale-[0.98] transition-transform select-none flex items-center justify-center gap-2"
                >
                  <span className="text-[12px] opacity-50">✦</span>
                  <span>City Brief</span>
                </motion.button>
              )}

              {(briefState === "loading" || (briefState === "done" && brief)) && (
                <motion.div
                  key="brief-card"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease }}
                  className="w-full"
                >
                  <ReportCard
                    city={cityData?.city}
                    paragraphs={brief?.paragraphs ?? []}
                    images={brief?.images ?? []}
                    loading={briefState === "loading"}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {locState === "done" && (
                <motion.a
                  href="/travel"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  transition={{ duration: 0.55, delay: 0.1, ease }}
                  className="w-full py-4 rounded-2xl bg-[#1d1d1f] text-white text-[15px] font-semibold text-center active:scale-[0.98] transition-transform select-none flex flex-col items-center gap-1"
                >
                  <span className="flex items-center gap-2">
                    <span className="text-[12px] opacity-40">✦</span>
                    <span>What will be your next story?</span>
                  </span>
                  <span className="text-[11px] font-normal opacity-40 tracking-wide">Plan with your travel guru</span>
                </motion.a>
              )}
            </AnimatePresence>

          </div>
        </div>

      </div>
    </>
  );
}
