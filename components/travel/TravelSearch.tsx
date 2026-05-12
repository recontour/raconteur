"use client";

import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";
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

export default function TravelSearch({ user }: { user: User | null }) {
  const [destQuery, setDestQuery]         = useState("");
  const [suggestions, setSuggestions]     = useState<Suggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [resorts, setResorts]             = useState<Resort[]>([]);
  const [resortLoading, setResortLoading] = useState(false);
  const debounceRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    setResorts([]);
    try {
      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ placeName: s.displayName }),
      });
      if (res.ok) {
        const data = await res.json() as { resorts: Resort[] };
        setResorts(data.resorts);
      }
    } catch { /* silent */ } finally {
      setResortLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease }} className="mt-6"
    >
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Plan a trip</p>

      {/* Search input */}
      <div className="relative mb-3">
        <div className="flex items-center gap-3 bg-gray-50 rounded-2xl px-4 py-3.5">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={destQuery}
            onChange={(e) => { setDestQuery(e.target.value); setSelectedPlace(null); }}
            placeholder="Search a destination…"
            className="flex-1 bg-transparent text-[15px] text-[#1d1d1f] placeholder-gray-400 outline-none"
            style={{ fontFamily: SF }}
          />
          {destQuery.length > 0 && (
            <button
              onClick={() => { setDestQuery(""); setSuggestions([]); setSelectedPlace(null); setResorts([]); }}
              className="shrink-0 text-gray-400 active:text-gray-600"
            >
              <svg width="15" height="15" viewBox="0 0 14 14" fill="none">
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

      {/* Resort results */}
      <AnimatePresence mode="wait">
        {resortLoading && (
          <motion.div
            key="resort-loading"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-3 py-8"
          >
            <div className="w-6 h-6 border-2 border-black/15 border-t-black rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Finding resorts in {selectedPlace}…</p>
          </motion.div>
        )}
        {!resortLoading && resorts.length > 0 && (
          <motion.div
            key="resorts"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3"
          >
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
              Top stays in {selectedPlace}
            </p>
            {resorts.map((r, i) => (
              <motion.a
                key={i} href={r.link ?? "#"} target="_blank" rel="noopener noreferrer"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: i * 0.07 }}
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
        )}
      </AnimatePresence>
    </motion.div>
  );
}
