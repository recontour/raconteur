"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, Search, Biohazard, Scroll, Skull } from "lucide-react";

const GENRE_CONFIG: Record<
  string,
  { icon: any; messages: string[]; color: string }
> = {
  noir: {
    icon: Search,
    color: "text-red-500",
    messages: [
      "Checking the shadows for movement...", // Removed cigarette
      "Reviewing the case files...",
      "Pouring another cheap whiskey...",
      "Waiting for a lead...",
      "Listening to the rain...",
    ],
  },
  // ... (Other genres remain the same)
  cyberpunk: {
    icon: Biohazard,
    color: "text-blue-500",
    messages: [
      "Jacking into the matrix...",
      "Bypassing ICE...",
      "Rebooting optics...",
      "Downloading data...",
    ],
  },
  fantasy: {
    icon: Scroll,
    color: "text-amber-500",
    messages: [
      "Consulting scrolls...",
      "Gathering mana...",
      "Sharpening swords...",
      "Speaking with oracles...",
    ],
  },
  horror: {
    icon: Skull,
    color: "text-purple-500",
    messages: [
      "Trying not to look behind you...",
      "The walls are breathing...",
      "Deciphering madness...",
      "Something moved...",
    ],
  },
  default: {
    icon: Loader2,
    color: "text-white",
    messages: ["AI is thinking...", "Generating story...", "Please wait..."],
  },
};

export default function GenreLoader({ genreId }: { genreId: string | null }) {
  const config = GENRE_CONFIG[genreId || "default"] || GENRE_CONFIG.default;
  const Icon = config.icon;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % config.messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [config.messages.length]);

  return (
    // FIX: Added h-full and justify-center to center completely
    <div className="h-full flex flex-col items-center justify-center space-y-8 p-6 text-center">
      <motion.div
        initial={{ y: 0 }}
        animate={{ y: [-10, 0, -10] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
        className={`${config.color}`}
      >
        <Icon
          size={48}
          className={genreId === "default" ? "animate-spin" : ""}
        />
      </motion.div>

      <div className="h-12 relative w-full max-w-xs">
        <motion.p
          key={msgIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.5 }}
          className="text-neutral-400 text-sm tracking-widest uppercase absolute inset-0 flex items-center justify-center"
        >
          {config.messages[msgIndex]}
        </motion.p>
      </div>

      <div className="w-32 h-1 bg-neutral-800 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${config.color.replace("text-", "bg-")}`}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
        />
      </div>
    </div>
  );
}
