"use client";

import { motion } from "framer-motion";

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

// OWM air pollution index: 1 = Good … 5 = Very Poor
const AQI_META: Record<number, { label: string; color: string }> = {
  1: { label: "Good",      color: "#22c55e" },
  2: { label: "Fair",      color: "#a3e635" },
  3: { label: "Moderate",  color: "#eab308" },
  4: { label: "Poor",      color: "#f97316" },
  5: { label: "Very Poor", color: "#ef4444" },
};

export interface CityData {
  temp: number;
  feelsLike: number;
  icon: string;
  description: string;
  city: string;
  aqi: number; // 1–5
}

interface CityTileProps {
  data: CityData | null;
  locState: "idle" | "loading" | "done" | "denied";
  onRequestLocation: () => void;
}

// AQI ring dimensions
const R = 26;
const CIRC = 2 * Math.PI * R; // ≈ 163.4

const DOT_TEXTURE = {
  backgroundImage: "radial-gradient(circle, white 1px, transparent 1px)",
  backgroundSize: "20px 20px",
};

export default function CityTile({ data, locState, onRequestLocation }: CityTileProps) {
  const meta = data ? (AQI_META[data.aqi] ?? AQI_META[3]) : null;
  const canRequest = !data && locState !== "loading" && locState !== "denied";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: 0.22, ease }}
      onClick={canRequest ? onRequestLocation : undefined}
      className={`
        relative w-full h-36 rounded-[28px] overflow-hidden bg-[#1d1d1f]
        flex items-center px-5 gap-5
        ${canRequest ? "cursor-pointer active:scale-[0.98] transition-transform" : ""}
      `}
    >
      {/* Dot-grid texture */}
      <div className="absolute inset-0 opacity-[0.06]" style={DOT_TEXTURE} />

      {data && meta ? (
        /* ── DATA STATE ──────────────────────────────────────────────────── */
        <>
          {/* AQI ring */}
          <div className="relative z-10 flex flex-col items-center gap-1.5 shrink-0">
            <div className="relative w-17.5 h-17.5">
              <svg width="70" height="70" viewBox="0 0 70 70">
                {/* faded track */}
                <circle
                  cx="35" cy="35" r={R}
                  fill="none"
                  stroke={meta.color}
                  strokeWidth="6"
                  opacity={0.18}
                />
                {/* progress arc — draws in on mount */}
                <motion.circle
                  cx="35" cy="35" r={R}
                  fill="none"
                  stroke={meta.color}
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  transform="rotate(-90 35 35)"
                  initial={{ strokeDashoffset: CIRC }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 1.4, ease }}
                />
              </svg>

              {/* Label inside ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <p
                  className="text-[10px] font-bold leading-none tracking-tight"
                  style={{ color: meta.color }}
                >
                  {meta.label}
                </p>
              </div>
            </div>

            <p className="text-[9px] uppercase tracking-[0.14em] text-white/30">Air Quality</p>
          </div>

          {/* Divider */}
          <div className="w-px h-14 bg-white/10 shrink-0" />

          {/* Weather */}
          <div className="relative z-10 flex-1 flex flex-col justify-center gap-0.5">
            <p className="text-[10px] uppercase tracking-[0.12em] text-white/35 mb-0.5">
              {data.city}
            </p>
            <div className="flex items-center gap-0.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://openweathermap.org/img/wn/${data.icon}@2x.png`}
                alt={data.description}
                width={48}
                height={48}
                className="-ml-2 -my-2 shrink-0"
              />
              <span className="text-[36px] font-semibold text-white leading-none tracking-tight">
                {data.temp}°
              </span>
            </div>
            <p className="text-[12px] text-white/45">
              Feels like {data.feelsLike}°C
            </p>
          </div>
        </>
      ) : (
        /* ── EMPTY / LOADING / DENIED STATE ─────────────────────────────── */
        <div className="relative z-10 flex items-center gap-4 w-full">
          <div className="w-10 h-10 rounded-full bg-white/8 flex items-center justify-center shrink-0">
            {locState === "loading" ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            ) : locState === "denied" ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17.657 16.657 13.414 20.9a1.998 1.998 0 0 1-2.827 0l-4.244-4.243a8 8 0 1 1 11.314 0z" />
                <circle cx="12" cy="11" r="3" />
              </svg>
            )}
          </div>

          <div>
            <p className="text-[15px] font-semibold text-white">
              {locState === "loading"
                ? "Getting weather…"
                : locState === "denied"
                ? "Location access denied"
                : "Local weather & air quality"}
            </p>
            <p className="text-[11px] text-white/40 mt-0.5">
              {locState === "denied"
                ? "Enable location in Settings and retry"
                : locState === "loading"
                ? "Checking conditions near you"
                : "Tap to see conditions near you"}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
