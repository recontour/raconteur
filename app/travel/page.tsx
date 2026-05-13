"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import CityTile, { type CityData } from "@/components/welcome/CityTile";

const SF =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

const DOT_TEXTURE = {
  backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
  backgroundSize: "20px 20px",
};

// ── Types ─────────────────────────────────────────────────────────────────────
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
interface ChatOption {
  label: string;
  searchQuery: string;
}
interface SerpEvent {
  title: string;
  date?: { when?: string };
  address?: string[];
  link?: string;
  thumbnail?: string;
  venue?: { name: string; rating?: number };
}
type ChatMessage =
  | { id: string; type: "bot"; content: string }
  | { id: string; type: "options"; options: ChatOption[]; picked?: string }
  | { id: string; type: "option-reply"; content: string; events: SerpEvent[] };

// ── Skeleton shimmer ──────────────────────────────────────────────────────────
function Shimmer({ className }: { className: string }) {
  return (
    <motion.div
      className={`bg-gray-100 rounded-2xl overflow-hidden ${className}`}
      animate={{ opacity: [0.45, 0.9, 0.45] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

// ── Icons ───────────────────────────────────────────────────────────────────
function SparkIcon({ size = 14, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M12 2L13.9 8.9L21 10.8L13.9 12.7L12 19.6L10.1 12.7L3 10.8L10.1 8.9L12 2Z" fill={color} opacity="0.95" />
    </svg>
  );
}

// ── Typing indicator ─────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease }}
      className="flex gap-2.5 items-end"
    >
      <div className="w-7 h-7 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
        <SparkIcon />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 0.18, 0.36].map((d, i) => (
          <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.7, delay: d, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Bot message bubble ───────────────────────────────────────────────────────
function BotBubble({ content, delay = 0 }: { content: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease }}
      className="flex gap-2.5 items-end"
    >
      <div className="w-7 h-7 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
        <SparkIcon />
      </div>
      <div className="flex-1 bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
        <p className="text-[14px] text-[#1d1d1f] leading-relaxed">{content}</p>
      </div>
    </motion.div>
  );
}

// ── Option pills ─────────────────────────────────────────────────────────────
function OptionPills({ options, picked, onSelect }: { options: ChatOption[]; picked?: string; onSelect: (o: ChatOption) => void; }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.18, ease }}
      className="flex flex-col gap-2 pl-9"
    >
      {options.map((opt, i) => {
        const isPicked = picked === opt.label;
        const isDimmed = !!picked && !isPicked;
        return (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: isDimmed ? 0.35 : 1, y: 0 }}
            transition={{ duration: 0.28, delay: 0.22 + i * 0.09, ease }}
            whileTap={!picked ? { scale: 0.97 } : {}}
            onClick={() => !picked && onSelect(opt)}
            className={`w-full text-left px-4 py-3 rounded-2xl text-[14px] font-medium transition-colors ${
              isPicked ? "bg-[#1d1d1f] text-white" : "bg-gray-50 text-[#1d1d1f] active:bg-gray-100"
            }`}
          >
            {opt.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ── Event card (chat context) ─────────────────────────────────────────────────
function ChatEventCard({ event, delay = 0 }: { event: SerpEvent; delay?: number }) {
  return (
    <motion.a
      href={event.link ?? "#"} target="_blank" rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease }}
      whileTap={{ scale: 0.97 }}
      className="flex gap-3 bg-white border border-gray-100 rounded-2xl p-3"
    >
      {event.thumbnail ? (
        <img src={event.thumbnail} alt={event.title} className="w-12 h-12 rounded-xl object-cover shrink-0 bg-gray-100" />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight line-clamp-2">{event.title}</p>
        {event.date?.when && <p className="text-[11px] text-gray-400 truncate">{event.date.when}</p>}
        {event.venue?.name && <p className="text-[11px] text-gray-300 truncate">{event.venue.name}</p>}
      </div>
      <div className="shrink-0 self-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </motion.a>
  );
}

// ── Resort cards (search results) ─────────────────────────────────────────────
function ResortCards({ resorts, label }: { resorts: Resort[]; label: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.25 }}
      className="mt-3 space-y-2.5"
    >
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
        Top stays in {label}
      </p>
      {resorts.map((r, i) => (
        <motion.a
          key={i}
          href={r.link ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.06 }}
          className="flex gap-3 bg-gray-50 rounded-2xl p-3 active:scale-[0.98] transition-transform"
        >
          {r.thumbnail ? (
            <img
              src={r.thumbnail}
              alt={r.name}
              className="w-16 h-16 rounded-xl object-cover shrink-0 bg-gray-200"
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-gray-200 shrink-0 flex items-center justify-center">
              <span className="text-2xl">🏨</span>
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
            <p className="text-sm font-semibold text-[#1d1d1f] leading-tight line-clamp-2">
              {r.name}
            </p>
            {r.rating && (
              <p className="text-xs text-gray-500">
                ★ {r.rating}
                {r.reviews ? ` · ${r.reviews.toLocaleString()} reviews` : ""}
              </p>
            )}
            {r.price && (
              <p className="text-xs text-gray-400">from {r.price} / night</p>
            )}
          </div>
          <div className="shrink-0 self-center">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </div>
        </motion.a>
      ))}
    </motion.div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TravelPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // AI message state
  const [aiMessage, setAiMessage] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(true);

  // Travel history + weather
  const [travelHistory, setTravelHistory] = useState<TravelLogEntry[]>([]);
  const [cityWeatherMap, setCityWeatherMap] = useState<
    Record<string, CityData | "loading">
  >({});
  const [openHistoryIdx, setOpenHistoryIdx] = useState<number | null>(null);

  // Search state
  const [destQuery, setDestQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [resorts, setResorts] = useState<Resort[]>([]);
  const [resortLoading, setResortLoading] = useState(false);
  const [resortError, setResortError] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // City chat state
  const [chatCity, setChatCity] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  // ── Fetch history + AI message on auth ready ───────────────────────────────
  useEffect(() => {
    if (!ready || !user) return;

    user.getIdToken().then(async (token) => {
      // Fetch travel history and AI message in parallel
      const [histRes, agentRes] = await Promise.allSettled([
        fetch("/api/destinations/history", {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch("/api/travel-agent", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (histRes.status === "fulfilled" && histRes.value.ok) {
        const data = (await histRes.value.json()) as {
          history: TravelLogEntry[];
        };
        setTravelHistory(data.history);
        // Pre-fetch weather for each city
        data.history.forEach((entry) => {
          fetchCityWeatherFor(entry.destination, token);
        });
      }

      if (agentRes.status === "fulfilled" && agentRes.value.ok) {
        const data = (await agentRes.value.json()) as { message: string };
        setAiMessage(data.message);
      } else {
        setAiMessage("Find your perfect stay.");
      }

      setAiLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user]);

  // ── Auto-scroll chat to bottom ────────────────────────────────────────────
  useEffect(() => {
    if (chatMessages.length > 0 || chatLoading) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [chatMessages, chatLoading]);

  // ── Debounced autocomplete ─────────────────────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (destQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/destinations?q=${encodeURIComponent(destQuery)}`
        );
        if (res.ok) {
          const data = (await res.json()) as { suggestions: Suggestion[] };
          setSuggestions(data.suggestions);
        }
      } catch { /* silent */ }
    }, 380);
  }, [destQuery]);

  // ── City weather fetch ─────────────────────────────────────────────────────
  const fetchCityWeatherFor = async (destination: string, idToken: string) => {
    setCityWeatherMap((m) => {
      if (m[destination]) return m;
      return { ...m, [destination]: "loading" };
    });
    try {
      const res = await fetch("/api/city", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ city: destination }),
      });
      if (res.ok) {
        const data = (await res.json()) as CityData;
        setCityWeatherMap((m) => ({ ...m, [destination]: data }));
      } else {
        setCityWeatherMap((m) => {
          const n = { ...m };
          delete n[destination];
          return n;
        });
      }
    } catch {
      setCityWeatherMap((m) => {
        const n = { ...m };
        delete n[destination];
        return n;
      });
    }
  };

  const fetchCityWeather = async (destination: string) => {
    if (cityWeatherMap[destination] || !user) return;
    const idToken = await user.getIdToken();
    await fetchCityWeatherFor(destination, idToken);
  };

  // ── Search actions ─────────────────────────────────────────────────────────
  const selectPlace = async (s: Suggestion) => {
    setSelectedPlace(s.name);
    setDestQuery(s.name);
    setSuggestions([]);
    setSearchFocused(false);
    setResortLoading(true);
    setResortError(false);
    setResorts([]);
    searchInputRef.current?.blur();

    try {
      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          placeName: s.displayName,
          destinationName: s.name,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { resorts: Resort[] };
        setResorts(data.resorts);
        if (data.resorts.length === 0) setResortError(true);
        if (data.resorts.length > 0) {
          const newEntry: TravelLogEntry = {
            destination: s.name,
            resorts: data.resorts,
            timestamp: Date.now(),
          };
          const idToken2 = user ? await user.getIdToken() : "";
          setTravelHistory((prev) => [
            newEntry,
            ...prev.filter(
              (e) => e.destination.toLowerCase() !== s.name.toLowerCase()
            ),
          ].slice(0, 5));
          fetchCityWeatherFor(s.name, idToken2);
        }
      } else {
        setResortError(true);
      }
    } catch {
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

  const toggleHistory = (i: number) =>
    setOpenHistoryIdx((prev) => (prev === i ? null : i));

  // ── City chat ──────────────────────────────────────────────────────────────
  const handleCityClick = async (city: string) => {
    setChatCity(city);
    setChatMessages([]);
    setChatLoading(true);
    try {
      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ city, mode: "intro" }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: string; options: ChatOption[] };
        setChatMessages([
          { id: `bot-${Date.now()}`, type: "bot", content: data.message },
          { id: `opts-${Date.now() + 1}`, type: "options", options: data.options },
        ]);
      } else {
        setChatMessages([{ id: "err", type: "bot", content: `${city} is a wonderful destination to explore.` }]);
      }
    } catch {
      setChatMessages([{ id: "err", type: "bot", content: `${city} is a wonderful destination to explore.` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleOptionSelect = async (option: ChatOption) => {
    setChatMessages((prev) =>
      prev.map((m) => (m.type === "options" ? { ...m, picked: option.label } : m))
    );
    setChatLoading(true);
    try {
      const idToken = user ? await user.getIdToken() : "";
      const res = await fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ city: chatCity, mode: "option", option: option.label, searchQuery: option.searchQuery }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: string; events: SerpEvent[] };
        setChatMessages((prev) => [
          ...prev,
          { id: `reply-${Date.now()}`, type: "option-reply", content: data.message, events: data.events },
        ]);
      }
    } catch { /* silent */ }
    finally { setChatLoading(false); }
  };

  const exitChat = () => { setChatCity(null); setChatMessages([]); };

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (!ready) {
    return (
      <div className="h-dvh bg-white flex flex-col px-5 pt-14 pb-10 gap-3" style={{ fontFamily: SF }}>
        <Shimmer className="h-16 rounded-3xl" />
        <Shimmer className="h-14 rounded-2xl" />
        <Shimmer className="h-36 rounded-3xl" />
        <Shimmer className="h-36 rounded-3xl" />
      </div>
    );
  }

  const chatWeather = chatCity ? cityWeatherMap[chatCity] : undefined;

  return (
    <div className="h-dvh bg-white flex flex-col overflow-hidden" style={{ fontFamily: SF }}>
      <AnimatePresence mode="wait">

        {/* ══ BROWSE MODE ═══════════════════════════════════════════════════ */}
        {!chatCity && (
        <motion.div
          key="browse"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.28, ease }}
          className="flex-1 overflow-y-auto px-5 pt-14 pb-10 flex flex-col gap-3"
        >

        {/* ── AI Welcome message ────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {aiLoading ? (
            <motion.div
              key="ai-shimmer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Shimmer className="w-full h-16 rounded-3xl" />
            </motion.div>
          ) : (
            <motion.div
              key="ai-card"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease }}
              className="relative rounded-3xl bg-[#1d1d1f] px-5 py-4 overflow-hidden"
            >
              <div className="absolute inset-0 opacity-[0.06]" style={DOT_TEXTURE} />
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                  <SparkIcon size={15} />
                </div>
                <p className="text-[14px] font-medium text-white/90 leading-snug flex-1">
                  {aiMessage}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Search bar ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.36, delay: 0.07, ease }}
          className="relative"
        >
          <div
            className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors ${
              searchFocused ? "bg-gray-100" : "bg-gray-50"
            }`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#9ca3af"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchInputRef}
              type="text"
              value={destQuery}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setTimeout(() => setSearchFocused(false), 150)}
              onChange={(e) => {
                setDestQuery(e.target.value);
                setSelectedPlace(null);
                setResorts([]);
              }}
              placeholder="Search a destination…"
              className="flex-1 bg-transparent text-[15px] text-[#1d1d1f] placeholder-gray-400 outline-none"
              style={{ fontFamily: SF }}
            />
            {destQuery.length > 0 && (
              <button
                onClick={clearSearch}
                className="shrink-0 text-gray-400 active:text-gray-600"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M1 1L13 13M13 1L1 13"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Autocomplete dropdown */}
          <AnimatePresence>
            {suggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18 }}
                className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onMouseDown={() => selectPlace(s)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 transition-colors border-b border-gray-50 last:border-0"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#9ca3af"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0"
                    >
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#1d1d1f] truncate">
                        {s.name}
                      </p>
                      {s.state && (
                        <p className="text-xs text-gray-400 truncate">
                          {s.state}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Search results ────────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {resortLoading && (
            <motion.div
              key="resort-loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-8"
            >
              <div className="w-6 h-6 border-2 border-black/15 border-t-black rounded-full animate-spin" />
              <p className="text-sm text-gray-400">
                Finding stays in {selectedPlace}…
              </p>
            </motion.div>
          )}
          {!resortLoading && selectedPlace && resorts.length > 0 && (
            <ResortCards
              key="fresh-resorts"
              resorts={resorts}
              label={selectedPlace}
            />
          )}
          {!resortLoading && resortError && (
            <motion.div
              key="no-results"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-6"
            >
              <p className="text-sm text-gray-400">
                No stays found for{" "}
                <span className="font-medium text-[#1d1d1f]">
                  {selectedPlace}
                </span>
                .
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Historic city tiles ───────────────────────────────────────────── */}
        {!selectedPlace && !resortLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, delay: 0.12 }}
            className="flex flex-col gap-3"
          >
            {travelHistory.map((entry, i) => {
              const w = cityWeatherMap[entry.destination];
              const hasData = w && typeof w === "object";
              return (
                <div key={i} className="flex flex-col gap-2">
                  {/* Clickable tile when weather data is ready */}
                  <div
                    className={hasData ? "cursor-pointer" : ""}
                    onClick={() => { if (hasData) handleCityClick(entry.destination); }}
                  >
                    <CityTile
                      data={typeof w === "object" ? w : null}
                      locState={w === "loading" ? "loading" : "idle"}
                      onRequestLocation={() => fetchCityWeather(entry.destination)}
                    />
                  </div>

                  {entry.resorts.length > 0 && (
                    <>
                      <button
                        onClick={() => setOpenHistoryIdx((p) => (p === i ? null : i))}
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
                          <motion.div key="resorts" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                            <ResortCards resorts={entry.resorts} label={entry.destination} />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </>
                  )}
                </div>
              );
            })}

            {travelHistory.length === 0 && !aiLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="text-center py-12">
                <p className="text-sm text-gray-300">No past searches yet</p>
                <p className="text-xs text-gray-200 mt-1">Search a destination above to get started</p>
              </motion.div>
            )}
          </motion.div>
        )}
        </motion.div>
        )}

        {/* ══ CITY CHAT MODE ════════════════════════════════════════════════ */}
        {chatCity && (
          <motion.div
            key={`chat-${chatCity}`}
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.35, ease }}
            className="flex-1 flex flex-col overflow-hidden"
          >
            {/* City header */}
            <div className="relative bg-[#1d1d1f] px-5 pt-12 pb-4 flex-shrink-0 overflow-hidden">
              <div className="absolute inset-0 opacity-[0.06]" style={DOT_TEXTURE} />
              <div className="relative z-10 flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.88 }}
                  onClick={exitChat}
                  className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"
                >
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                    <path d="M1 1L13 13M13 1L1 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </motion.button>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium tracking-widest uppercase text-white/30">Exploring</p>
                  <p className="text-[19px] font-semibold text-white leading-tight truncate">{chatCity}</p>
                </div>
                {chatWeather && typeof chatWeather === "object" && (
                  <div className="text-right shrink-0">
                    <p className="text-[22px] font-light text-white leading-none">{chatWeather.temp}°</p>
                    <p className="text-[10px] text-white/30 mt-0.5 capitalize">{chatWeather.description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Chat scroll area */}
            <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4 bg-white">
              {chatMessages.map((msg, i) => {
                if (msg.type === "bot") {
                  return <BotBubble key={msg.id} content={msg.content} delay={i === 0 ? 0.1 : 0} />;
                }
                if (msg.type === "options") {
                  return (
                    <OptionPills key={msg.id} options={msg.options} picked={msg.picked} onSelect={handleOptionSelect} />
                  );
                }
                if (msg.type === "option-reply") {
                  return (
                    <motion.div key={msg.id} className="flex flex-col gap-3">
                      <BotBubble content={msg.content} />
                      {msg.events.length > 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.28, delay: 0.15 }} className="pl-9 flex flex-col gap-2">
                          <p className="text-[10px] font-medium text-gray-300 uppercase tracking-widest">Events</p>
                          {msg.events.map((ev, j) => (
                            <ChatEventCard key={j} event={ev} delay={j * 0.07} />
                          ))}
                        </motion.div>
                      )}
                    </motion.div>
                  );
                }
                return null;
              })}

              <AnimatePresence>
                {chatLoading && <TypingBubble key="typing" />}
              </AnimatePresence>

              <div ref={chatEndRef} />
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}

