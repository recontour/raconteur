"use client";

import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { motion, AnimatePresence } from "framer-motion";
import { ease } from "@/lib/tokens";

type TileOption = {
  id: string;
  label: string;
};

type InitResponse = {
  sessionId: string;
  initialOptions: TileOption[];
};

type BranchResponse = {
  sessionId: string;
  pathId: string;
  message: string;
  options: TileOption[];
  source: "cache" | "ai";
};

function TopicTile({
  option,
  onClick,
  disabled,
  delay,
}: {
  option: TileOption;
  onClick: () => void;
  disabled?: boolean;
  delay?: number;
}) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className="aspect-square rounded-2xl bg-[#1d1d1f] text-white p-4 text-left flex items-end justify-start disabled:opacity-50"
    >
      <p className="text-[15px] font-semibold leading-tight tracking-tight">{option.label}</p>
    </motion.button>
  );
}

export function BranchingInterestsShell({
  user,
  defaultLocation,
}: {
  user: User | null;
  defaultLocation: string;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [pathId, setPathId] = useState<string>("root");
  const [tiles, setTiles] = useState<TileOption[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyTileId, setBusyTileId] = useState<string | null>(null);
  const [lastSource, setLastSource] = useState<"cache" | "ai" | null>(null);

  const firstScreen = useMemo(() => pathId === "root", [pathId]);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      setLoading(true);
      try {
        const token = user ? await user.getIdToken() : "";
        const res = await fetch("/api/travel-master", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ mode: "init", city: defaultLocation }),
        });

        if (!res.ok) throw new Error("init failed");
        const data = (await res.json()) as InitResponse;
        if (cancelled) return;
        setSessionId(data.sessionId);
        setTiles((data.initialOptions || []).slice(0, 6));
      } catch {
        if (cancelled) return;
        setTiles([
          { id: "adventure", label: "Adventure" },
          { id: "food-drink", label: "Food & Drink" },
          { id: "culture", label: "Culture" },
          { id: "nature", label: "Nature" },
          { id: "nightlife", label: "Nightlife" },
          { id: "wellness", label: "Wellness" },
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    init();
    return () => {
      cancelled = true;
    };
  }, [defaultLocation, user]);

  const handleTileClick = async (option: TileOption) => {
    if (!sessionId || busyTileId) return;
    setBusyTileId(option.id);

    try {
      const token = user ? await user.getIdToken() : "";
      const res = await fetch("/api/travel-master", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          mode: "branch",
          sessionId,
          city: defaultLocation,
          parentPathId: pathId,
          optionId: option.id,
          optionLabel: option.label,
        }),
      });

      if (!res.ok) throw new Error("branch failed");

      const data = (await res.json()) as BranchResponse;
      setPathId(data.pathId || pathId);
      setMessage(data.message || "");
      setTiles((data.options || []).slice(0, 4));
      setLastSource(data.source || null);
    } catch {
      setMessage("I can shape this path for you. Pick another tile and we will keep building your trip.");
      setTiles([
        { id: "local-favorites", label: "Local favorites" },
        { id: "best-time", label: "Best time" },
        { id: "route-ideas", label: "Route ideas" },
        { id: "smart-budget", label: "Smart budget" },
      ]);
    } finally {
      setBusyTileId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] px-1">
        What are you into?
      </p>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-2 gap-3"
          >
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </motion.div>
        ) : (
          <motion.div
            key={pathId}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-3"
          >
            {!firstScreen && message && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-gray-100 px-4 py-3"
              >
                <p className="text-[14px] text-[#1d1d1f] leading-relaxed">{message}</p>
                <p className="mt-2 text-[11px] text-gray-500">
                  Pick one of the 4 tiles below to keep shaping your trip.
                </p>
                {lastSource && (
                  <p className="mt-2 text-[10px] uppercase tracking-[0.12em] text-gray-400">
                    {lastSource === "cache" ? "From saved branch" : "Freshly generated"}
                  </p>
                )}
              </motion.div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {tiles.map((option, i) => (
                <TopicTile
                  key={option.id}
                  option={option}
                  delay={i * 0.05}
                  disabled={!!busyTileId}
                  onClick={() => handleTileClick(option)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
