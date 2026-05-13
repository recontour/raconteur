"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import CityTile, { type CityData } from "@/components/welcome/CityTile";
import HomeTile from "@/components/welcome/HomeTile";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

interface Suggestion {
  name: string;
  state: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface Resort {
  name: string;
  description?: string;
  link?: string;
  price?: string;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
}

interface TravelLogEntry {
  destination: string;
  resorts: Resort[];
  timestamp: number | null;
}

function ResortCards({ resorts, label }: { resorts: Resort[]; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25 }}
      className="mt-3 space-y-2.5"
    >
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
        Top stays in {label}
      </p>
      {resorts.map((r, i) => (
        <motion.a
          key={i} href={r.link ?? "#"} target="_blank" rel="noopener noreferrer"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.06 }}
          className="flex gap-3 bg-gray-50 rounded-2xl p-3 active:scale-[0.98] transition-transform"
        >
          {r.thumbnail ? (
            <img src={r.thumbnail} alt={r.name} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-gray-200" />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gray-200 shrink-0 flex items-center justify-center">
              <span className="text-2xl">🏨</span>
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <p className="text-sm font-semibold text-[#1d1d1f] leading-tight line-clamp-2">{r.name}</p>
            {r.rating && (
              <p className="text-xs text-gray-500">
                ★ {r.rating}{r.reviews ? ` · ${r.reviews.toLocaleString()} reviews` : ""}
              </p>
            )}
            {r.price && <p className="text-xs text-gray-400">from {r.price} / night</p>}
          </div>
          <div className="shrink-0 self-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </motion.a>
      ))}
    </motion.div>
  );
}

export default function TravelSearch({ user }: { user: User | null }) {
  const [mode, setMode]                     = useState<"browse" | "search">("browse");
  const [destQuery, setDestQuery]           = useState("");
  const [suggestions, setSuggestions]       = useState<Suggestion[]>([]);
  const [selectedPlace, setSelectedPlace]   = useState<string | null>(null);
  const [resorts, setResorts]               = useState<Resort[]>([]);
  const [resortLoading, setResortLoading]   = useState(false);
  const [resortError, setResortError]       = useState(false);
  const [travelHistory, setTravelHistory]   = useState<TravelLogEntry[]>([]);
  const [openHistoryIdx, setOpenHistoryIdx] = useState<number | null>(null);
  const [cityWeatherMap, setCityWeatherMap] = useState<Record<string, CityData | "loading">>({});
  const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input when entering search mode
  useEffect(() => {
    if (mode === "search") {
      const t = setTimeout(() => searchInputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [mode]);

  // Fetch travel history on mount, then auto-fetch weather for each city
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(async (token) => {
      try {
        const res = await fetch("/api/destinations/history", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { history: TravelLogEntry[] };
          setTravelHistory(data.history);
          // Kick off weather fetches for each city (non-blocking)
          data.history.forEach((entry) => {
            fetchCityWeatherFor(entry.destination, token);
          });
        }
      } catch { /* silent */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Debounced autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (destQuery.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations?q=${encodeURIComponent(destQuery)}`);
        if (res.ok) {
          const data = await res.json() as { suggestions: Suggestion[] };
          setSuggestions(data.suggestions);
        }
      } catch { /* silent */ }
    }, 380);
  }, [destQuery]);

  const selectPlace = async (s: Suggestion) => {
    setSelectedPlace(s.name);
    setDestQuery(s.name);
    setSuggestions([]);
    setResortLoading(true);
    setResortError(false);
    setResorts([]);
    try {
      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ placeName: s.displayName, destinationName: s.name }),
      });
      if (res.ok) {
        const data = await res.json() as { resorts: Resort[] };
        console.log("[TravelSearch] resorts received:", data.resorts.length);
        setResorts(data.resorts);
        if (data.resorts.length === 0) setResortError(true);
        // Prepend to local history (deduped by destination name)
        if (data.resorts.length > 0) {
          const newEntry: TravelLogEntry = { destination: s.name, resorts: data.resorts, timestamp: Date.now() };
          const idToken2 = user ? await user.getIdToken() : "";
          setTravelHistory((prev) => [
            newEntry,
            ...prev.filter((e) => e.destination.toLowerCase() !== s.name.toLowerCase()),
          ].slice(0, 5));
          // Pre-fetch weather for the new city
          fetchCityWeatherFor(s.name, idToken2);
        }
      } else {
        const err = await res.json().catch(() => ({})) as { error?: string };
        console.error("[TravelSearch] POST failed:", res.status, err);
        setResortError(true);
      }
    } catch (err) {
      console.error("[TravelSearch] fetch error:", err);
      setResortError(true);
    } finally {
      setResortLoading(false);
    }
  };

  const clearSearch = () => {
    setDestQuery("");
    setSuggestions([]);
    setSelectedPlace(null);
    setResorts([]);
    setResortError(false);
  };

  const exitSearch = () => {
    clearSearch();
    setMode("browse");
  };

  const toggleHistory = (i: number) =>
    setOpenHistoryIdx((prev) => (prev === i ? null : i));

  // Standalone fetch that takes an already-resolved token (for bulk on-load use)
  const fetchCityWeatherFor = async (destination: string, idToken: string) => {
    setCityWeatherMap((m) => {
      if (m[destination]) return m; // already fetched / loading
      return { ...m, [destination]: "loading" };
    });
    try {
      const res = await fetch("/api/city", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ city: destination }),
      });
      if (res.ok) {
        const data = await res.json() as CityData;
        setCityWeatherMap((m) => ({ ...m, [destination]: data }));
      } else {
        setCityWeatherMap((m) => { const n = { ...m }; delete n[destination]; return n; });
      }
    } catch {
      setCityWeatherMap((m) => { const n = { ...m }; delete n[destination]; return n; });
    }
  };

  const fetchCityWeather = async (destination: string) => {
    if (cityWeatherMap[destination] || !user) return;
    const idToken = await user.getIdToken();
    await fetchCityWeatherFor(destination, idToken);
  };

  return (
    <AnimatePresence mode="wait">

      {/* ── BROWSE MODE: history city tiles + search tile ────────────── */}
      {mode === "browse" && (
        <motion.div
          key="browse"
          initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.28, ease }}
          className="flex flex-col gap-3 mt-2"
        >
          {travelHistory.map((entry, i) => {
            const w = cityWeatherMap[entry.destination];
            return (
              <div key={i} className="flex flex-col gap-2">
                <CityTile
                  data={typeof w === "object" ? w : null}
                  locState={w === "loading" ? "loading" : "idle"}
                  onRequestLocation={() => fetchCityWeather(entry.destination)}
                />
                {entry.resorts.length > 0 && (
                  <>
                    <button
                      onClick={() => toggleHistory(i)}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 rounded-2xl active:scale-[0.98] transition-transform text-left"
                    >
                      <p className="text-[13px] font-medium text-[#1d1d1f]">
                        {entry.resorts.length} stay{entry.resorts.length !== 1 ? "s" : ""} in {entry.destination}
                      </p>
                      <motion.div animate={{ rotate: openHistoryIdx === i ? 90 : 0 }} transition={{ duration: 0.2 }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {openHistoryIdx === i && (
                        <motion.div
                          key="resorts"
                          initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                        >
                          <ResortCards resorts={entry.resorts} label={entry.destination} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                )}
              </div>
            );
          })}

          {/* Search tile */}
          <HomeTile
            label="Search Destinations"
            subtitle="Find your next stay"
            variant="light"
            onClick={() => setMode("search")}
            icon={
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            }
          />
        </motion.div>
      )}

      {/* ── SEARCH MODE: search bar + results only ────────────────────── */}
      {mode === "search" && (
        <motion.div
          key="search"
          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.28, ease }}
          className="flex flex-col gap-3 mt-2"
        >
          {/* Search bar row with inline back */}
          <div className="flex items-center gap-3">
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={exitSearch}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </motion.button>

            <div className="relative flex-1">
              <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={destQuery}
                  onChange={(e) => { setDestQuery(e.target.value); setSelectedPlace(null); setResorts([]); }}
                  placeholder="Search a destination…"
                  className="flex-1 bg-transparent text-[15px] text-[#1d1d1f] placeholder-gray-400 outline-none"
    
                />
                {destQuery.length > 0 && (
                  <button onClick={clearSearch} className="shrink-0 text-gray-400 active:text-gray-600">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {suggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => selectPlace(s)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                          <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
                        </svg>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1d1d1f] truncate">{s.name}</p>
                          {s.state && <p className="text-xs text-gray-400 truncate">{s.state}</p>}
                        </div>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Results */}
          <AnimatePresence mode="wait">
            {resortLoading && (
              <motion.div
                key="resort-loading"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-12"
              >
                <div className="w-6 h-6 border-2 border-black/15 border-t-black rounded-full animate-spin" />
                <p className="text-sm text-gray-400">Finding resorts in {selectedPlace}…</p>
              </motion.div>
            )}
            {!resortLoading && selectedPlace && resorts.length > 0 && (
              <ResortCards key="fresh-resorts" resorts={resorts} label={selectedPlace} />
            )}
            {!resortLoading && resortError && (
              <motion.div
                key="no-results"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <p className="text-sm text-gray-400">No stays found for <span className="font-medium text-[#1d1d1f]">{selectedPlace}</span>.</p>
              </motion.div>
            )}
            {!resortLoading && !selectedPlace && !resortError && (
              <motion.p
                key="hint"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center text-[12px] text-gray-300 py-8"
              >
                Type a city or resort destination
              </motion.p>
            )}
          </AnimatePresence>
        </motion.div>
      )}

    </AnimatePresence>
  );
}
