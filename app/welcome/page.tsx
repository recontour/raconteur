"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import TravelSearch from "@/components/travel/TravelSearch";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

type LocationState = "idle" | "loading" | "done" | "denied";

interface SerpEvent {
  title: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  link?: string;
  thumbnail?: string;
  venue?: { name: string; rating?: number };
}

interface HistoryEntry {
  city: string | null;
  events: SerpEvent[];
  timestamp: number | null;
}

export default function WelcomePage() {
  const [user, setUser]         = useState<User | null>(null);
  const [history, setHistory]   = useState<HistoryEntry | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [city, setCity]         = useState<string | null>(null);
  const [events, setEvents]     = useState<SerpEvent[]>([]);
  const [locState, setLocState] = useState<LocationState>("idle");
  const [ready, setReady]       = useState(false); // true once auth + history fetch done
  const fetchedRef              = useRef(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setReady(true); // not logged in, show page immediately
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(async (token) => {
      try {
        const res = await fetch("/api/events", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json() as { history: HistoryEntry | null };
          console.log("[welcome] history response:", data);
          if (data.history && data.history.events.length > 0) setHistory(data.history);
        } else {
          console.error("[welcome] GET /api/events failed:", res.status, await res.text().catch(() => ""));
        }
      } catch (err) {
        console.error("[welcome] history fetch error:", err);
      } finally {
        setReady(true);
      }
    });
  }, [user]);

  const requestLocation = () => {
    if (!user || !navigator.geolocation || fetchedRef.current) return;
    setLocState("loading");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        fetchedRef.current = true;
        try {
          const idToken = await user.getIdToken();
          const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          if (res.ok) {
            const data = await res.json() as { city?: string; events?: SerpEvent[] };
            setCity(data.city ?? null);
            setEvents((data.events ?? []).slice(0, 4));
            setLocState("done");
          } else {
            setLocState("idle");
          }
        } catch {
          setLocState("idle");
        }
      },
      () => setLocState("denied"),
      { timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const displayEvents  = locState === "done" ? events : (historyOpen ? (history?.events ?? []) : []);
  const displayCity    = locState === "done" ? city   : (history?.city   ?? null);
  const showingHistory = locState !== "done" && historyOpen && displayEvents.length > 0;

  // ── Skeleton shimmer ──────────────────────────────────────────────────────
  const Shimmer = ({ className }: { className: string }) => (
    <motion.div
      className={`bg-gray-100 rounded-xl overflow-hidden ${className}`}
      animate={{ opacity: [0.5, 1, 0.5] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
    />
  );

  if (!ready) {
    return (
      <div className="h-dvh bg-white flex flex-col px-5 pt-14 pb-10 overflow-hidden" style={{ fontFamily: SF }}>
        {/* Hero skeleton */}
        <Shimmer className="w-14 h-14 rounded-2xl mb-5" />
        <Shimmer className="w-56 h-8 mb-3" />
        <Shimmer className="w-40 h-4 mb-10" />
        {/* Card skeletons */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="flex gap-3 bg-gray-50 rounded-2xl p-3 mb-3"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          >
            <div className="w-16 h-16 rounded-xl bg-gray-200 shrink-0" />
            <div className="flex-1 flex flex-col justify-center gap-2">
              <div className="h-3.5 bg-gray-200 rounded-full w-3/4" />
              <div className="h-3 bg-gray-100 rounded-full w-1/2" />
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.35 }}
      className="h-dvh bg-white text-[#1d1d1f] flex flex-col overflow-hidden" style={{ fontFamily: SF }}
    >
      <div className="flex-1 overflow-y-auto px-5 pt-14 pb-10">

        <motion.div
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease }} className="mb-8"
        >
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.45, ease }}
            className="w-14 h-14 rounded-2xl bg-black flex items-center justify-center shadow-md mb-5"
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </motion.div>
          <h1 className="text-[2rem] font-semibold tracking-tight leading-tight text-[#1d1d1f]">
            Live shows &amp; stays,<br />all in one place.
          </h1>
          <p className="text-gray-500 text-[15px] mt-2 leading-relaxed max-w-xs">
            Find shows near you or search a destination to discover top resorts.
          </p>
        </motion.div>

        <AnimatePresence>
          {/* Last search collapsed button — shown when history exists and fresh results are not in yet */}
          {history && locState !== "done" && (
            <motion.div
              key="history-btn"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease }} className="mb-3"
            >
              <button
                onClick={() => setHistoryOpen(v => !v)}
                className="w-full flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-4 active:scale-[0.98] transition-transform text-left"
              >
                <span className="w-10 h-10 rounded-xl bg-gray-200 flex items-center justify-center shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                  </svg>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[15px] font-semibold text-[#1d1d1f]">Last search{history.city ? ` · ${history.city}` : ""}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{history.events.length} show{history.events.length !== 1 ? "s" : ""} saved</p>
                </div>
                <motion.div animate={{ rotate: historyOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </motion.div>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {displayEvents.length > 0 && (
            <motion.div
              key="events"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease }} className="mb-5"
            >
              {showingHistory && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                    {`Last search${displayCity ? ` · ${displayCity}` : ""}`}
                  </p>
                </div>
              )}
              {locState === "done" && (
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-widest">
                    {`Shows near ${displayCity ?? "you"}`}
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {displayEvents.map((ev, i) => (
                  <motion.a
                    key={i} href={ev.link ?? "#"} target="_blank" rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, delay: i * 0.06 }}
                    className="flex gap-3 bg-gray-50 rounded-2xl p-3 active:scale-[0.98] transition-transform"
                  >
                    {ev.thumbnail ? (
                      <img src={ev.thumbnail} alt={ev.title} className="w-16 h-16 rounded-xl object-cover shrink-0 bg-gray-200" />
                    ) : (
                      <div className="w-16 h-16 rounded-xl bg-gray-200 shrink-0 flex items-center justify-center">
                        <span className="text-2xl">&#127925;</span>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                      <p className="text-sm font-semibold text-[#1d1d1f] leading-tight line-clamp-2">{ev.title}</p>
                      {ev.date?.when && <p className="text-xs text-gray-500 truncate">{ev.date.when}</p>}
                      {ev.venue?.name && <p className="text-xs text-gray-400 truncate">{ev.venue.name}</p>}
                    </div>
                    <div className="shrink-0 self-center">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </div>
                  </motion.a>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {locState !== "done" && (
            <motion.div
              key="find-row"
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.3, ease }}
            >
              {locState === "denied" ? (
                <div className="rounded-2xl bg-gray-50 px-5 py-5 text-center">
                  <p className="text-sm font-medium text-[#1d1d1f]">Location access denied</p>
                  <p className="text-xs text-gray-400 mt-1">Enable location in your browser settings and try again.</p>
                </div>
              ) : (
                <button
                  onClick={requestLocation} disabled={locState === "loading"}
                  className="w-full flex items-center gap-4 bg-gray-50 rounded-2xl px-5 py-4 active:scale-[0.98] transition-transform text-left disabled:opacity-60"
                >
                  <span className="w-10 h-10 rounded-xl bg-black flex items-center justify-center shrink-0">
                    {locState === "loading" ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" />
                        <circle cx="12" cy="10" r="3" />
                      </svg>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-[#1d1d1f]">
                      {locState === "loading" ? "Searching\u2026" : showingHistory ? "Refresh near me" : "Find shows near me"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">Uses your location once</p>
                  </div>
                  {locState !== "loading" && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  )}
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <TravelSearch user={user} />

      </div>
    </motion.div>
  );
}
