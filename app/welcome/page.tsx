"use client";

import { useEffect, useRef, useState, useCallback, useTransition } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import CityTile, { type CityData } from "@/components/welcome/CityTile";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

type LocationState = "idle" | "loading" | "done" | "denied" | "error";

interface TravelAgentGetResponse {
  message?: string;
  defaultLocation?: string;
}

interface NewsItem {
  title: string;
  snippet?: string;
  source?: string;
  link?: string;
  thumbnail?: string;
  date?: string;
}

interface ActivityItem {
  label: string;
  emoji: string;
}

interface DayTripPlace {
  title: string;
  address?: string;
  rating?: number;
  reviews?: number;
  type?: string;
  thumbnail?: string;
  description?: string;
  link?: string;
  distanceKm?: number;
}

interface DayTripEvent {
  title: string;
  when?: string;
  address?: string;
  link?: string;
  thumbnail?: string;
  venue?: string;
}

interface DayTripData {
  city: string;
  places: DayTripPlace[];
  events: DayTripEvent[];
}

interface VacationSuggestion {
  name: string;
  state: string;
  displayName: string;
  lat: number;
  lng: number;
}

interface VacationResort {
  name: string;
  description?: string;
  link?: string;
  price?: string;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
}

type PlanMode = null | "day-trip" | "vacation";

interface LocalBrief {
  city: string;
  news: NewsItem[];
  activities: ActivityItem[];
}

export default function WelcomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [bootReady, setBootReady] = useState(false);

  const [welcomeMessage, setWelcomeMessage] = useState<string>("");
  const [messageReady, setMessageReady] = useState(false);

  const [defaultLocation, setDefaultLocation] = useState<string>("");
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [locState, setLocState] = useState<LocationState>("idle");

  const [localBrief, setLocalBrief] = useState<LocalBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);

  // Plan modes
  const [planMode, setPlanMode] = useState<PlanMode>(null);

  // Day-trip state
  const [dayTrip, setDayTrip] = useState<DayTripData | null>(null);
  const [dayTripLoading, setDayTripLoading] = useState(false);

  // Vacation state
  const [vacQuery, setVacQuery] = useState("");
  const [vacSuggestions, setVacSuggestions] = useState<VacationSuggestion[]>([]);
  const [vacResorts, setVacResorts] = useState<VacationResort[]>([]);
  const [vacCity, setVacCity] = useState<string | null>(null);
  const [vacLoading, setVacLoading] = useState(false);
  const [, startTransition] = useTransition();
  const vacDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFetchedTileRef = useRef(false);

  const fetchLocalBrief = useCallback(async (city: string, token: string) => {
    setBriefLoading(true);
    try {
      const res = await fetch("/api/local-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ city }),
      });
      if (res.ok) setLocalBrief((await res.json()) as LocalBrief);
    } catch { /* non-fatal */ }
    finally { setBriefLoading(false); }
  }, []);

  const handleDayTrip = async () => {
    if (!user || !defaultLocation) return;
    setPlanMode("day-trip");
    setDayTrip(null);
    setDayTripLoading(true);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/day-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ city: defaultLocation }),
      });
      if (res.ok) setDayTrip((await res.json()) as DayTripData);
    } catch { /* non-fatal */ }
    finally { setDayTripLoading(false); }
  };

  const handleVacationSearch = (q: string) => {
    setVacQuery(q);
    setVacResorts([]);
    setVacCity(null);
    if (vacDebounceRef.current) clearTimeout(vacDebounceRef.current);
    if (q.trim().length < 2) { setVacSuggestions([]); return; }
    vacDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = (await res.json()) as { suggestions: VacationSuggestion[] };
          startTransition(() => setVacSuggestions(data.suggestions));
        }
      } catch { /* silent */ }
    }, 350);
  };

  const handleVacationSelect = async (s: VacationSuggestion) => {
    if (!user) return;
    setVacQuery(s.name);
    setVacSuggestions([]);
    setVacCity(s.name);
    setVacLoading(true);
    setVacResorts([]);
    try {
      const token = await user.getIdToken();
      const res = await fetch("/api/destinations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ placeName: s.displayName, destinationName: s.name }),
      });
      if (res.ok) {
        const data = (await res.json()) as { resorts: VacationResort[] };
        setVacResorts(data.resorts);
      }
    } catch { /* non-fatal */ }
    finally { setVacLoading(false); }
  };

  const exitPlanMode = () => {
    setPlanMode(null);
    setDayTrip(null);
    setVacQuery("");
    setVacSuggestions([]);
    setVacResorts([]);
    setVacCity(null);
  };

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) {
        setWelcomeMessage("What will be your next story? Discover the world's best destinations.");
        setMessageReady(true);
        setBootReady(true);
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (!user || bootReady) return;

    const run = async () => {
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/travel-agent", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          setWelcomeMessage("What will be your next story? Discover the world's best destinations.");
          setMessageReady(true);
          return;
        }

        const data = (await res.json()) as TravelAgentGetResponse;
        const message = typeof data.message === "string" ? data.message.trim() : "";
        const location = typeof data.defaultLocation === "string" ? data.defaultLocation.trim() : "";

        setWelcomeMessage(
          message || "What will be your next story? Discover the world's best destinations."
        );
        setMessageReady(true);
        setDefaultLocation(location);

        if (location && !hasFetchedTileRef.current) {
          hasFetchedTileRef.current = true;
          setLocState("loading");

          const cityRes = await fetch("/api/city", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ city: location }),
          });

          if (cityRes.ok) {
            const cityPayload = (await cityRes.json()) as CityData;
            setCityData(cityPayload);
            setLocState("done");
            fetchLocalBrief(location, token);
          } else {
            setLocState("idle");
          }
        }
      } catch {
        setWelcomeMessage("What will be your next story? Discover the world's best destinations.");
        setMessageReady(true);
      } finally {
        setBootReady(true);
      }
    };

    run();
  }, [bootReady, user]);

  const requestCurrentLocation = async () => {
    if (!user || !navigator.geolocation || locState === "loading") return;

    setLocState("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const token = await user.getIdToken();

          // Use /api/city directly with coordinates — no client-side geocoding API key needed
          const cityRes = await fetch("/api/city", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          });

          if (!cityRes.ok) {
            setLocState("error");
            return;
          }

          const cityPayload = (await cityRes.json()) as CityData;
          const cityName = cityPayload.city;

          // Persist location to the user profile
          const saveRes = await fetch("/api/travel-agent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              defaultLocation: cityName,
              defaultAddress: cityName,
            }),
          });

          if (!saveRes.ok) {
            setLocState("error");
            return;
          }

          setDefaultLocation(cityName);
          setCityData(cityPayload);
          setLocState("done");
          fetchLocalBrief(cityName, token);
        } catch {
          setLocState("error");
        }
      },
      (err) => {
        if (err.code === 1) {
          setLocState("denied");
          return;
        }
        setLocState("error");
      },
      { timeout: 12_000, maximumAge: 60_000 }
    );
  };

  if (!bootReady || !messageReady) {
    return (
      <div className="h-dvh bg-white flex flex-col items-center overflow-hidden">
        <div className="w-full max-w-sm px-6 pt-14 pb-10">
          <motion.div
            className="bg-gray-100 rounded-3xl h-28"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.35 }}
      className="h-dvh bg-white text-[#1d1d1f] flex flex-col items-center overflow-hidden"
    >
      <div className="flex-1 overflow-y-auto w-full max-w-sm px-6 pt-14 pb-10 space-y-4">
        <AnimatePresence>
          {!localBrief && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.45, ease }}
              className="rounded-3xl bg-[#1d1d1f] p-6"
            >
              <p className="text-white text-[17px] leading-relaxed">{welcomeMessage}</p>
            </motion.section>
          )}
        </AnimatePresence>

        {!defaultLocation && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease, delay: 0.08 }}
            className="text-xs uppercase tracking-widest text-gray-400"
          >
            Select current location to load city weather and AQI
          </motion.p>
        )}

        {!user ? null : (
          <CityTile data={cityData} locState={locState} onRequestLocation={requestCurrentLocation} />
        )}

        {/* ── Plan buttons ─────────────────────────────────────────────── */}
        {locState === "done" && !planMode && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease, delay: 0.1 }}
            className="flex gap-3"
          >
            <button
              onClick={handleDayTrip}
              className="flex-1 flex flex-col gap-1 items-start px-4 py-4 rounded-2xl bg-[#1d1d1f] text-white active:scale-[0.97] transition-transform"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5 opacity-70">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4l3 3" />
              </svg>
              <span className="text-[14px] font-semibold leading-tight">Day trip</span>
              <span className="text-[11px] text-white/40 leading-snug">Places &amp; events near you</span>
            </button>
            <button
              onClick={() => setPlanMode("vacation")}
              className="flex-1 flex flex-col gap-1 items-start px-4 py-4 rounded-2xl bg-gray-100 text-[#1d1d1f] active:scale-[0.97] transition-transform"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1d1d1f" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="mb-0.5 opacity-40">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.18h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.78a16 16 0 0 0 5.55 5.55l1.67-1.85a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7a2 2 0 0 1 1.72 2.09z" />
              </svg>
              <span className="text-[14px] font-semibold leading-tight">Vacation</span>
              <span className="text-[11px] text-[#1d1d1f]/40 leading-snug">Find stays anywhere</span>
            </button>
          </motion.div>
        )}

        {/* ── Back button when in plan mode ────────────────────────────── */}
        {planMode && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={exitPlanMode}
            className="flex items-center gap-2 text-[13px] text-gray-400 active:text-gray-600 -mb-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back
          </motion.button>
        )}

        {/* ── Day trip results ──────────────────────────────────────────── */}
        {planMode === "day-trip" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease }}
            className="flex flex-col gap-4"
          >
            {dayTripLoading && (
              <div className="flex flex-col gap-2.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="h-18 rounded-2xl bg-gray-100"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }}
                  />
                ))}
              </div>
            )}

            {!dayTripLoading && dayTrip && (
              <>
                {dayTrip.places.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2.5">
                      Near {dayTrip.city}
                    </p>
                    <div className="flex flex-col gap-2.5">
                      {dayTrip.places.map((p, i) => (
                        <motion.a
                          key={i}
                          href={p.link ?? "#"}
                          target={p.link ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, delay: i * 0.06, ease }}
                          className="flex gap-3 bg-gray-50 rounded-2xl p-3 active:scale-[0.98] transition-transform"
                        >
                          {p.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.thumbnail} alt="" width={56} height={56}
                              className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-200" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0z" /><circle cx="12" cy="10" r="3" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] leading-snug line-clamp-1">{p.title}</p>
                            {p.type && <p className="text-[11px] text-gray-400 truncate">{p.type}</p>}
                            <div className="flex items-center gap-2">
                              {p.rating && (
                                <span className="text-[11px] text-gray-500">★ {p.rating}</span>
                              )}
                              {p.distanceKm !== undefined && (
                                <span className="text-[11px] text-gray-400">{p.distanceKm} km away</span>
                              )}
                            </div>
                          </div>
                        </motion.a>
                      ))}
                    </div>
                  </div>
                )}

                {dayTrip.events.length > 0 && (
                  <div>
                    <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2.5">
                      Events this week
                    </p>
                    <div className="flex flex-col gap-2.5">
                      {dayTrip.events.map((ev, i) => (
                        <motion.a
                          key={i}
                          href={ev.link ?? "#"}
                          target={ev.link ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.28, delay: 0.1 + i * 0.06, ease }}
                          className="flex gap-3 bg-gray-50 rounded-2xl p-3 active:scale-[0.98] transition-transform"
                        >
                          {ev.thumbnail ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={ev.thumbnail} alt="" width={56} height={56}
                              className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-200" />
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="4" width="18" height="18" rx="2" />
                                <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                              </svg>
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                            <p className="text-[13px] font-semibold text-[#1d1d1f] leading-snug line-clamp-2">{ev.title}</p>
                            {ev.when && <p className="text-[11px] text-gray-400">{ev.when}</p>}
                            {ev.venue && <p className="text-[11px] text-gray-300 truncate">{ev.venue}</p>}
                          </div>
                        </motion.a>
                      ))}
                    </div>
                  </div>
                )}

                {dayTrip.places.length === 0 && dayTrip.events.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">Nothing found near {dayTrip.city} right now.</p>
                )}
              </>
            )}
          </motion.div>
        )}

        {/* ── Vacation search ───────────────────────────────────────────── */}
        {planMode === "vacation" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease }}
            className="flex flex-col gap-3"
          >
            {/* Search input */}
            <div className="relative">
              <div className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-gray-50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  autoFocus
                  type="text"
                  value={vacQuery}
                  onChange={(e) => handleVacationSearch(e.target.value)}
                  placeholder="Where do you want to go?"
                  className="flex-1 bg-transparent text-[15px] text-[#1d1d1f] placeholder-gray-400 outline-none"
                />
                {vacQuery.length > 0 && (
                  <button onClick={() => { setVacQuery(""); setVacSuggestions([]); setVacResorts([]); setVacCity(null); }}
                    className="text-gray-400 shrink-0">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Suggestions dropdown */}
              <AnimatePresence>
                {vacSuggestions.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    {vacSuggestions.map((s, i) => (
                      <button key={i} onMouseDown={() => handleVacationSelect(s)}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-50 border-b border-gray-50 last:border-0">
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

            {/* Loading */}
            {vacLoading && (
              <div className="flex flex-col gap-2.5 mt-1">
                {[0, 1, 2].map((i) => (
                  <motion.div key={i} className="h-18 rounded-2xl bg-gray-100"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.12 }} />
                ))}
              </div>
            )}

            {/* Resort results */}
            {!vacLoading && vacResorts.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2.5">
                  Top stays in {vacCity}
                </p>
                <div className="flex flex-col gap-2.5">
                  {vacResorts.map((r, i) => (
                    <motion.a key={i} href={r.link ?? "#"} target={r.link ? "_blank" : undefined} rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.28, delay: i * 0.07, ease }}
                      className="flex gap-3 bg-gray-50 rounded-2xl p-3 active:scale-[0.98] transition-transform"
                    >
                      {r.thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={r.thumbnail} alt="" width={56} height={56}
                          className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-200" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="2" y="7" width="20" height="14" rx="2" />
                            <path d="M16 7V5a2 2 0 0 0-4 0v2M8 11h.01M12 11h.01M16 11h.01" />
                          </svg>
                        </div>
                      )}
                      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                        <p className="text-[13px] font-semibold text-[#1d1d1f] leading-snug line-clamp-2">{r.name}</p>
                        {r.rating && <p className="text-[11px] text-gray-500">★ {r.rating}{r.reviews ? ` · ${r.reviews.toLocaleString()} reviews` : ""}</p>}
                        {r.price && <p className="text-[11px] text-gray-400">from {r.price} / night</p>}
                      </div>
                      <div className="shrink-0 self-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </motion.a>
                  ))}
                </div>
              </div>
            )}

            {!vacLoading && vacCity && vacResorts.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-8">No stays found for {vacCity}.</p>
            )}
          </motion.div>
        )}

        {/* ── News brief (hidden in plan mode) ─────────────────────────── */}
        {!planMode && locState === "done" && (briefLoading || localBrief) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease, delay: 0.05 }}
            className="flex flex-col gap-3"
          >
            <p className="text-[10px] uppercase tracking-widest text-gray-400">
              Travel Brief · {localBrief?.city ?? defaultLocation}
            </p>

            {briefLoading && !localBrief ? (
              <div className="flex flex-col gap-2.5">
                {[0, 1].map((i) => (
                  <motion.div key={i} className="h-18 rounded-2xl bg-gray-100"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {localBrief?.news.map((item, i) => (
                  <motion.a key={i} href={item.link ?? "#"} target={item.link ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: i * 0.07, ease }}
                    className="flex gap-3 bg-gray-50 rounded-2xl p-3 active:scale-[0.98] transition-transform"
                  >
                    {item.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.thumbnail} alt="" width={56} height={56}
                        className="w-14 h-14 rounded-xl object-cover shrink-0 bg-gray-200" />
                    ) : (
                        <div className="w-14 h-14 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                      </div>
                    )}
                    <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
                      <p className="text-[13px] font-semibold text-[#1d1d1f] leading-snug line-clamp-2">{item.title}</p>
                      {item.snippet && (
                        <p className="text-[11px] text-gray-400 leading-snug line-clamp-2">{item.snippet}</p>
                      )}
                      <div className="flex items-center gap-1.5">
                        {item.source && <span className="text-[10px] text-gray-300 font-medium truncate">{item.source}</span>}
                        {item.source && item.date && <span className="text-[10px] text-gray-200">·</span>}
                        {item.date && <span className="text-[10px] text-gray-300 truncate">{item.date}</span>}
                      </div>
                    </div>
                  </motion.a>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
