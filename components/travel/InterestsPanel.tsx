"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { User } from "firebase/auth";
import { ease } from "@/lib/tokens";
import { ActivityIcon } from "./ActivityIcon";
import { ACTIVITIES, type ActivityData } from "./types";

// ── Activity tile (category selector) ─────────────────────────────────────────
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
      className={`relative aspect-square rounded-2xl overflow-hidden flex flex-col justify-end p-4 text-left cursor-pointer transition-all ${
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
          <p className="text-[15px] font-semibold text-white leading-tight tracking-tight">
            {activity.label}
          </p>
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
              <path
                d="M2 6L5 9L10 3"
                stroke="#1d1d1f"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Activity result card ───────────────────────────────────────────────────────
function ActivityResultCard({
  activity,
  selected,
  onSelect,
  delay = 0,
}: {
  activity: ActivityData;
  selected: boolean;
  onSelect: () => void;
  delay?: number;
}) {
  const [imgFailed, setImgFailed] = useState(false);

  // Use provided thumbnail, or derive a deterministic image from the activity id
  const seed = activity.id.replace(/[^a-z0-9]/gi, "").slice(0, 16) || "activity";
  const imgSrc = (!imgFailed && (activity.thumbnail || `https://picsum.photos/seed/${seed}/120/120`)) as string | false;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay, ease }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      disabled={selected}
      className={`text-left border rounded-xl overflow-hidden transition-all ${
        selected
          ? "bg-[#1d1d1f] border-[#1d1d1f] opacity-60 cursor-default"
          : "bg-white border-gray-100 hover:border-gray-200"
      }`}
    >
      <div className="flex gap-2.5 p-2.5">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={activity.title}
            onError={() => setImgFailed(true)}
            className="w-14 h-14 rounded-lg object-cover shrink-0 bg-gray-100"
          />
        ) : (
          <div
            className={`w-14 h-14 rounded-lg shrink-0 flex items-center justify-center ${
              selected ? "bg-white/10" : "bg-gray-100"
            }`}
          >
            <ActivityIcon id={activity.category} stroke={selected ? "white" : "#9ca3af"} />
          </div>
        )}

        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div>
            <p
              className={`text-[13px] font-semibold leading-tight line-clamp-2 ${
                selected ? "text-white" : "text-[#1d1d1f]"
              }`}
            >
              {activity.title}
            </p>
            <p className={`text-[11px] mt-1 ${selected ? "text-white/50" : "text-gray-400"}`}>
              {activity.place.name}
            </p>
          </div>
          <p className={`text-[10px] ${selected ? "text-white/30" : "text-gray-300"}`}>
            {activity.date.when}
          </p>
        </div>

        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="shrink-0 self-center"
            >
              <svg width="16" height="16" viewBox="0 0 12 12" fill="none">
                <path
                  d="M2 6L5 9L10 3"
                  stroke="white"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

// ── Loading animation ──────────────────────────────────────────────────────────
function LoadingActivities() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex flex-col items-center justify-center py-12 gap-4"
    >
      <div className="flex gap-1.5 items-center">
        {[0, 0.15, 0.3].map((delay, i) => (
          <motion.div
            key={i}
            className="w-2 h-2 rounded-full bg-gray-300"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.2, delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>
      <p className="text-xs text-gray-400 font-medium">Discovering activities…</p>
    </motion.div>
  );
}

// ── InterestsPanel ─────────────────────────────────────────────────────────────
// Captures "What are you into?" — saves interest tags + activity picks to
// userIndex so the AI can use them as RAG context for personalised suggestions.
export function InterestsPanel({
  user,
  defaultLocation,
}: {
  user: User | null;
  defaultLocation: string;
}) {
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [results, setResults] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickedActivityId, setPickedActivityId] = useState<string | null>(null);

  // ── Tap a category tile ────────────────────────────────────────────────────
  const handleCategoryTap = async (categoryId: string) => {
    if (!user || !defaultLocation) return;

    setActiveCategory(categoryId);
    setResults([]);
    setLoading(true);

    // Mark category as visited in local state
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev : [...prev, categoryId]
    );

    try {
      const token = await user.getIdToken();

      // Persist interest tag to userIndex for RAG context
      // Fire-and-forget — non-blocking
      fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mode: "add-interest", interest: categoryId }),
      }).catch(() => {/* non-fatal */});

      const res = await fetch("/api/activity-search", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ category: categoryId, city: defaultLocation, limit: 5 }),
      });

      if (res.ok) {
        const data = (await res.json()) as { activities: ActivityData[] };
        setResults(data.activities);
      }
    } catch (err) {
      console.error("[InterestsPanel] fetch failed:", err);
    } finally {
      setLoading(false);
    }
  };

  // ── Pick an activity card ──────────────────────────────────────────────────
  const handleActivityPick = async (activity: ActivityData) => {
    if (!user) return;
    setPickedActivityId(activity.id);

    try {
      const token = await user.getIdToken();
      await fetch("/api/travel-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          mode: "add-activity",
          activityId: activity.id,
          category: activity.category,
          city: activity.place.name,
          activityData: activity,
        }),
      });

      // Return to grid after brief confirmation
      setTimeout(() => {
        setActiveCategory(null);
        setResults([]);
        setPickedActivityId(null);
      }, 600);
    } catch (err) {
      console.error("[InterestsPanel] pick failed:", err);
      setPickedActivityId(null);
    }
  };

  return (
    <AnimatePresence mode="wait">
      {!activeCategory ? (
        // ── Category grid ────────────────────────────────────────────────────
        <motion.div
          key="grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4"
        >
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em] px-1">
            What are you into?
          </p>

          <div className="grid grid-cols-2 gap-3">
            {ACTIVITIES.map((act, i) => (
              <ActivityTile
                key={act.id}
                activity={act}
                selected={selectedCategories.includes(act.id)}
                onToggle={() => handleCategoryTap(act.id)}
                delay={0.1 + i * 0.06}
              />
            ))}

            {/* More — 6th cell placeholder */}
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.32, delay: 0.1 + ACTIVITIES.length * 0.06, ease }}
              whileTap={{ scale: 0.95 }}
              className="relative aspect-square rounded-2xl bg-gray-50 flex flex-col items-center justify-center gap-2 active:bg-gray-100 transition-colors"
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="#9ca3af" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="1" />
                <circle cx="19" cy="12" r="1" />
                <circle cx="5" cy="12" r="1" />
              </svg>
              <p className="text-[13px] font-medium text-gray-400">More</p>
            </motion.button>
          </div>
        </motion.div>
      ) : (
        // ── Activity results ─────────────────────────────────────────────────
        <motion.div
          key="results"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.25 }}
          className="flex flex-col gap-2 -mx-6 px-6"
        >
          {/* Header row */}
          <div className="flex items-center justify-between px-1">
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => { setActiveCategory(null); setResults([]); setPickedActivityId(null); }}
              className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center shrink-0 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M1 1L13 13M13 1L1 13" stroke="#1d1d1f" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </motion.button>
            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-[0.14em]">
              {ACTIVITIES.find((a) => a.id === activeCategory)?.label ?? "Activities"}
            </p>
            <div className="w-7" />
          </div>

          {loading && <LoadingActivities />}

          {!loading && results.length > 0 && (
            <div className="flex flex-col gap-2">
              {results.map((activity, i) => (
                <ActivityResultCard
                  key={activity.id}
                  activity={activity}
                  selected={pickedActivityId === activity.id}
                  onSelect={() => handleActivityPick(activity)}
                  delay={i * 0.07}
                />
              ))}
            </div>
          )}

          {!loading && results.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-8 text-center"
            >
              <p className="text-sm text-gray-400">No activities found</p>
              <p className="text-xs text-gray-300 mt-1">Try a different category</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
