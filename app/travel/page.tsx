"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { auth } from "@/lib/firebase";
import CityTile, { type CityData } from "@/components/welcome/CityTile";
import { ease } from "@/lib/tokens";
import { Shimmer } from "@/components/ui/Shimmer";

// ── Types ─────────────────────────────────────────────────────────────────────
type LocationState = "idle" | "loading" | "done" | "denied" | "error";

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

// ── Activity tiles data ───────────────────────────────────────────────────────
const ACTIVITIES = [
  { id: "adventure",  label: "Adventure",    sub: "Go beyond the map"          },
  { id: "romance",    label: "Romance",       sub: "Moments worth remembering"  },
  { id: "whats-on",   label: "What's On",     sub: "Live now, near you"         },
  { id: "food",       label: "Food & Drink",  sub: "Taste the local story"      },
  { id: "culture",    label: "Culture",       sub: "Art, history, wonder"       },
] as const;

// ── Activity icons ────────────────────────────────────────────────────────────
function ActivityIcon({ id }: { id: string }) {
  const s = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" as const, stroke: "white", strokeWidth: 1.4, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (id === "adventure") return (
    <svg {...s}><path d="M3 18l5-9 4 6 3-4 6 7H3z" /><circle cx="17" cy="5" r="2" /></svg>
  );
  if (id === "romance") return (
    <svg {...s}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" /></svg>
  );
  if (id === "whats-on") return (
    <svg {...s}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
  );
  if (id === "food") return (
    <svg {...s}><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" /><line x1="7" y1="2" x2="7" y2="22" /><path d="M21 15V2a5 5 0 0 0-5 5v6h3" /><line x1="19" y1="15" x2="19" y2="22" /></svg>
  );
  // culture
  return (
    <svg {...s}><line x1="2" y1="22" x2="22" y2="22" /><polyline points="4 11 12 3 20 11" /><line x1="4" y1="11" x2="4" y2="22" /><line x1="20" y1="11" x2="20" y2="22" /><rect x="9" y="15" width="6" height="7" /></svg>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────
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

// ── Bot bubble ────────────────────────────────────────────────────────────────
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

// ── Option pills ──────────────────────────────────────────────────────────────
function OptionPills({ options, picked, onSelect }: {
  options: ChatOption[];
  picked?: string;
  onSelect: (o: ChatOption) => void;
}) {
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
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: isDimmed ? 0.35 : 1, y: 0 }}
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

// ── Chat event card ───────────────────────────────────────────────────────────
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

// ── Activity tile ─────────────────────────────────────────────────────────────
function ActivityTile({
  activity,
  selected,
  onToggle,
  delay = 0,
}: {
  activity: (typeof ACTIVITIES)[number];
  selected: boolean;
  onToggle: () => void;
  delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.32, delay, ease }}
      whileTap={{ scale: 0.95 }}
      onClick={onToggle}
      className={`relative aspect-square rounded-2xl overflow-hidden flex flex-col justify-end p-4 text-left ${
        selected ? "ring-2 ring-white/40" : ""
      }`}
      style={{ background: "#1d1d1f" }}
    >
      {selected && <div className="absolute inset-0 bg-white/6" />}

      <div className="relative z-10 h-full flex flex-col justify-between">
        <div className="opacity-60">
          <ActivityIcon id={activity.id} />
        </div>
        <div>
          <p className="text-[15px] font-semibold text-white leading-tight tracking-tight">{activity.label}</p>
          <p className="text-[11px] text-white/35 mt-1 leading-tight">{activity.sub}</p>
        </div>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.18 }}
            className="absolute top-3 right-3 w-5 h-5 rounded-full bg-white flex items-center justify-center"
          >
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
              <path d="M2 6L5 9L10 3" stroke="#1d1d1f" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function TravelPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  // Location / header tile
  const [locState, setLocState] = useState<LocationState>("idle");
  const [cityData, setCityData] = useState<CityData | null>(null);
  const [defaultLocation, setDefaultLocation] = useState("");

  // Activity selection
  const [selectedActivities, setSelectedActivities] = useState<string[]>([]);

  // City chat
  const [chatCity, setChatCity] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  const hasFetchedRef = useRef(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Auth ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  // ── Boot: load default location ────────────────────────────────────────────
  useEffect(() => {
    if (!ready || !user || hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    user.getIdToken().then(async (token) => {
      try {
        const agentRes = await fetch("/api/travel-agent", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!agentRes.ok) return;
        const agentData = (await agentRes.json()) as { defaultLocation?: string };
        const location = agentData.defaultLocation?.trim() ?? "";
        if (!location) return;

        setDefaultLocation(location);
        setLocState("loading");

        const cityRes = await fetch("/api/city", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ city: location }),
        });
        if (cityRes.ok) {
          setCityData((await cityRes.json()) as CityData);
          setLocState("done");
        } else {
          setLocState("idle");
        }
      } catch {
        setLocState("idle");
      }
    });
  }, [ready, user]);

  // ── Auto-scroll chat ───────────────────────────────────────────────────────
  useEffect(() => {
    if (chatMessages.length > 0 || chatLoading) {
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [chatMessages, chatLoading]);

  // ── GPS location request ───────────────────────────────────────────────────
  const requestLocation = () => {
    if (!user || !navigator.geolocation || locState === "loading") return;
    setLocState("loading");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const token = await user.getIdToken();
          const cityRes = await fetch("/api/city", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          });
          if (!cityRes.ok) { setLocState("error"); return; }
          const payload = (await cityRes.json()) as CityData;
          setDefaultLocation(payload.city);
          setCityData(payload);
          setLocState("done");
          fetch("/api/travel-agent", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ defaultLocation: payload.city, defaultAddress: payload.city }),
          }).catch(() => { /* non-fatal */ });
        } catch {
          setLocState("error");
        }
      },
      (err) => { setLocState(err.code === 1 ? "denied" : "error"); },
      { timeout: 12_000, maximumAge: 60_000 }
    );
  };

  // ── Activity toggle ────────────────────────────────────────────────────────
  const toggleActivity = (id: string) => {
    setSelectedActivities((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  // ── City chat ──────────────────────────────────────────────────────────────
  const startChat = async (city: string) => {
    setChatCity(city);
    setChatMessages([]);
    setChatLoading(true);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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
      <div className="h-dvh bg-white flex flex-col items-center pt-14 pb-10">
        <div className="w-full max-w-sm px-6 flex flex-col gap-4">
          <Shimmer className="h-28 rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            {[...Array(6)].map((_, i) => <Shimmer key={i} className="aspect-square rounded-2xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const chatWeather = chatCity === defaultLocation ? cityData : undefined;

  return (
    <div className="h-dvh bg-white flex flex-col items-center overflow-hidden">
      <AnimatePresence mode="wait">

        {/* ══ BROWSE MODE ═══════════════════════════════════════════════════ */}
        {!chatCity && (
          <motion.div
            key="browse"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.28, ease }}
            className="flex-1 overflow-y-auto w-full max-w-sm px-6 pt-14 pb-10 flex flex-col gap-4"
          >

            {/* ── Location header tile ───────────────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease }}
            >
              <CityTile
                data={cityData}
                locState={locState}
                onRequestLocation={requestLocation}
                onChangeLocation={locState === "done" ? requestLocation : undefined}
              />
            </motion.div>

            {/* ── Section label ──────────────────────────────────────────── */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: 0.15, ease }}
              className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] px-1"
            >
              What are you into?
            </motion.p>

            {/* ── Activity grid ──────────────────────────────────────────── */}
            <div className="grid grid-cols-2 gap-3">
              {ACTIVITIES.map((act, i) => (
                <ActivityTile
                  key={act.id}
                  activity={act}
                  selected={selectedActivities.includes(act.id)}
                  onToggle={() => toggleActivity(act.id)}
                  delay={0.1 + i * 0.06}
                />
              ))}

              {/* More button — 6th cell */}
              <motion.button
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.32, delay: 0.1 + ACTIVITIES.length * 0.06, ease }}
                whileTap={{ scale: 0.95 }}
                onClick={() => { /* TODO */ }}
                className="relative aspect-square rounded-2xl bg-gray-50 flex flex-col items-center justify-center gap-2 active:bg-gray-100 transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                </svg>
                <p className="text-[13px] font-medium text-gray-400">More</p>
              </motion.button>
            </div>

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
            className="flex-1 flex flex-col overflow-hidden w-full max-w-sm"
          >
            {/* Chat header */}
            <div className="relative bg-[#1d1d1f] px-5 pt-12 pb-4 shrink-0">
              <div className="flex items-center gap-3">
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
                  <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-white/30">Exploring</p>
                  <p className="text-[19px] font-semibold text-white leading-tight truncate tracking-tight">{chatCity}</p>
                </div>
                {chatWeather && (
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
                  return <OptionPills key={msg.id} options={msg.options} picked={msg.picked} onSelect={handleOptionSelect} />;
                }
                if (msg.type === "option-reply") {
                  return (
                    <motion.div key={msg.id} className="flex flex-col gap-3">
                      <BotBubble content={msg.content} />
                      {msg.events.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          transition={{ duration: 0.28, delay: 0.15 }}
                          className="pl-9 flex flex-col gap-2"
                        >
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Events</p>
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
