"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "firebase/auth";
import { ease } from "@/lib/tokens";
import type { CityData } from "@/components/welcome/CityTile";
import type { ChatMessage, ChatOption, SerpEvent } from "./types";

// ── Spark icon ─────────────────────────────────────────────────────────────────
function SparkIcon({ size = 14, color = "white" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2L13.9 8.9L21 10.8L13.9 12.7L12 19.6L10.1 12.7L3 10.8L10.1 8.9L12 2Z"
        fill={color}
        opacity="0.95"
      />
    </svg>
  );
}

// ── Typing bubble ──────────────────────────────────────────────────────────────
function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.28, ease }}
      className="flex gap-2.5 items-end"
    >
      <div className="w-7 h-7 rounded-full bg-[#1d1d1f] flex items-center justify-center shrink-0">
        <SparkIcon />
      </div>
      <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1.5 items-center">
        {[0, 0.18, 0.36].map((d, i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-gray-400"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.7, delay: d, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
    </motion.div>
  );
}

// ── Bot bubble ─────────────────────────────────────────────────────────────────
function BotBubble({ content, delay = 0 }: { content: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
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

// ── Option pills ───────────────────────────────────────────────────────────────
function OptionPills({
  options,
  picked,
  onSelect,
}: {
  options: ChatOption[];
  picked?: string;
  onSelect: (o: ChatOption) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
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
              isPicked
                ? "bg-[#1d1d1f] text-white"
                : "bg-gray-50 text-[#1d1d1f] active:bg-gray-100"
            }`}
          >
            {opt.label}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ── Event card ─────────────────────────────────────────────────────────────────
function EventCard({ event, delay = 0 }: { event: SerpEvent; delay?: number }) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <motion.a
      href={event.link ?? "#"}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease }}
      whileTap={{ scale: 0.97 }}
      className="flex gap-3 bg-white border border-gray-100 rounded-2xl p-3"
    >
      {event.thumbnail && !imgFailed ? (
        <img
          src={event.thumbnail}
          alt={event.title}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-12 h-12 rounded-xl object-cover shrink-0 bg-gray-100"
        />
      ) : (
        <div className="w-12 h-12 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center">
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round"
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
      )}
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
        <p className="text-[13px] font-semibold text-[#1d1d1f] leading-tight line-clamp-2">
          {event.title}
        </p>
        {event.date?.when && (
          <p className="text-[11px] text-gray-400 truncate">{event.date.when}</p>
        )}
        {event.venue?.name && (
          <p className="text-[11px] text-gray-300 truncate">{event.venue.name}</p>
        )}
      </div>
      <div className="shrink-0 self-center">
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="#d1d5db" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
    </motion.a>
  );
}

// ── ChatPanel ──────────────────────────────────────────────────────────────────
export function ChatPanel({
  user,
  city,
  weather,
  onExit,
}: {
  user: User | null;
  city: string;
  weather?: CityData;
  onExit: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0 || loading) {
      setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 80);
    }
  }, [messages, loading]);

  // Kick off the intro message on mount
  useEffect(() => {
    const init = async () => {
      try {
        const token = user ? await user.getIdToken() : "";
        const res = await fetch("/api/travel-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ city, mode: "intro" }),
        });
        if (res.ok) {
          const data = (await res.json()) as { message: string; options: ChatOption[] };
          setMessages([
            { id: `bot-${Date.now()}`, type: "bot", content: data.message },
            { id: `opts-${Date.now() + 1}`, type: "options", options: data.options },
          ]);
        } else {
          setMessages([{ id: "err", type: "bot", content: `${city} is a wonderful destination to explore.` }]);
        }
      } catch {
        setMessages([{ id: "err", type: "bot", content: `${city} is a wonderful destination to explore.` }]);
      } finally {
        setLoading(false);
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const handleOptionSelect = async (option: ChatOption) => {
    setMessages((prev) =>
      prev.map((m) => (m.type === "options" ? { ...m, picked: option.label } : m))
    );
    setLoading(true);
    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ city, mode: "option", option: option.label, searchQuery: option.searchQuery }),
      });
      if (res.ok) {
        const data = (await res.json()) as { message: string; events: SerpEvent[] };
        setMessages((prev) => [
          ...prev,
          { id: `reply-${Date.now()}`, type: "option-reply", content: data.message, events: data.events },
        ]);
      }
    } catch {/* silent */} finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      key={`chat-${city}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.35, ease }}
      className="flex-1 flex flex-col overflow-hidden w-full max-w-sm"
    >
      {/* Header */}
      <div className="relative bg-[#1d1d1f] px-5 pt-12 pb-4 shrink-0">
        <div className="flex items-center gap-3">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onExit}
            className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center shrink-0"
          >
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
              <path d="M1 1L13 13M13 1L1 13" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </motion.button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-medium tracking-[0.12em] uppercase text-white/30">Exploring</p>
            <p className="text-[19px] font-semibold text-white leading-tight truncate tracking-tight">
              {city}
            </p>
          </div>
          {weather && (
            <div className="text-right shrink-0">
              <p className="text-[22px] font-light text-white leading-none">{weather.temp}°</p>
              <p className="text-[10px] text-white/30 mt-0.5 capitalize">{weather.description}</p>
            </div>
          )}
        </div>
      </div>

      {/* Scroll area */}
      <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4 bg-white">
        {messages.map((msg, i) => {
          if (msg.type === "bot") {
            return <BotBubble key={msg.id} content={msg.content} delay={i === 0 ? 0.1 : 0} />;
          }
          if (msg.type === "options") {
            return (
              <OptionPills
                key={msg.id}
                options={msg.options}
                picked={msg.picked}
                onSelect={handleOptionSelect}
              />
            );
          }
          if (msg.type === "option-reply") {
            return (
              <motion.div key={msg.id} className="flex flex-col gap-3">
                <BotBubble content={msg.content} />
                {msg.events.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.28, delay: 0.15 }}
                    className="pl-9 flex flex-col gap-2"
                  >
                    <p className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">
                      Events
                    </p>
                    {msg.events.map((ev, j) => (
                      <EventCard key={j} event={ev} delay={j * 0.07} />
                    ))}
                  </motion.div>
                )}
              </motion.div>
            );
          }
          return null;
        })}

        <AnimatePresence>
          {loading && <TypingBubble key="typing" />}
        </AnimatePresence>

        <div ref={endRef} />
      </div>
    </motion.div>
  );
}
