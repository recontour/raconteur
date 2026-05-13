"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ease } from "@/lib/tokens";

export interface PlaceEntry {
  name: string;
  addedAt: number;
}

interface Suggestion {
  name: string;
  state: string;
  displayName: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  savedPlaces: Record<string, PlaceEntry>;
  onSelect: (cityName: string) => void;
}

export function LocationPickerSheet({ open, onClose, savedPlaces, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [, startTransition] = useTransition();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSuggestions([]);
      setTimeout(() => inputRef.current?.focus(), 180);
    }
  }, [open]);

  const handleQueryChange = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json() as { suggestions: Suggestion[] };
          startTransition(() => setSuggestions(data.suggestions.slice(0, 5)));
        }
      } catch { /* silent */ }
    }, 350);
  };

  const recent = Object.values(savedPlaces)
    .sort((a, b) => b.addedAt - a.addedAt)
    .slice(0, 5);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="loc-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            key="loc-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ duration: 0.35, ease }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-xl px-5 pb-10 pt-4 max-h-[72dvh] overflow-y-auto"
          >
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-black/10 mx-auto mb-5" />

            <p className="text-[17px] font-semibold text-[#1d1d1f] mb-4">Choose a location</p>

            {/* Search input */}
            <div className="relative mb-3">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
                width="16" height="16" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Search city…"
                className="w-full pl-9 pr-4 py-3 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-black text-[#1d1d1f] text-[15px] bg-gray-50 placeholder:text-gray-400"
              />
            </div>

            {/* Autocomplete suggestions */}
            {suggestions.length > 0 && (
              <div className="mb-3 space-y-0.5">
                {suggestions.map((s) => (
                  <button
                    key={s.name + s.state}
                    onClick={() => { onSelect(s.name); onClose(); }}
                    className="w-full text-left px-3 py-3 rounded-xl active:bg-gray-100 transition-colors flex flex-col"
                  >
                    <span className="text-[14px] font-medium text-[#1d1d1f]">{s.name}</span>
                    {s.state && (
                      <span className="text-[11px] text-gray-400">{s.state}</span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Recent / saved places */}
            {recent.length > 0 && suggestions.length === 0 && (
              <>
                <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400 mb-2">
                  Recent
                </p>
                <div className="space-y-0.5">
                  {recent.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => { onSelect(p.name); onClose(); }}
                      className="w-full text-left px-3 py-3 rounded-xl active:bg-gray-100 transition-colors flex items-center gap-3"
                    >
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#666"
                          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17.657 16.657 13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                          <circle cx="12" cy="11" r="3" />
                        </svg>
                      </div>
                      <span className="text-[14px] font-medium text-[#1d1d1f]">{p.name}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Empty hint */}
            {recent.length === 0 && suggestions.length === 0 && !query && (
              <p className="text-[13px] text-gray-400 text-center py-6">
                Start typing to search for a city
              </p>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
