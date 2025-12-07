"use client";

import React from "react";
import { motion } from "framer-motion";
import { Book, Search, Cpu, Wand2, Eye, Sparkles } from "lucide-react";

const GENRES = [
  {
    id: "noir",
    label: "Noir Detective",
    prompt: "A gritty, rainy 1940s detective mystery.",
    icon: Search,
    gradient: "from-amber-900/20 via-neutral-900/10 to-transparent",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk",
    prompt: "A neon-soaked futuristic corporate espionage thriller.",
    icon: Cpu,
    gradient: "from-cyan-900/20 via-purple-900/10 to-transparent",
  },
  {
    id: "fantasy",
    label: "Dark Fantasy",
    prompt: "A medieval mystery involving magic and old gods.",
    icon: Wand2,
    gradient: "from-purple-900/20 via-indigo-900/10 to-transparent",
  },
  {
    id: "horror",
    label: "Cosmic Horror",
    prompt: "A Lovecraftian investigation in a small fishing town.",
    icon: Eye,
    gradient: "from-emerald-900/20 via-teal-900/10 to-transparent",
  },
];

interface GenreSelectorProps {
  onSelect: (genreId: string, prompt: string) => void;
  onContinue: () => void;
  hasExistingStory: boolean;
  loading: boolean;
}

export default function GenreSelector({
  onSelect,
  onContinue,
  hasExistingStory,
  loading,
}: GenreSelectorProps) {
  return (
    <div className="h-full flex flex-col relative">
      {/* Main Content - Centered Vertically */}
      <div className="flex-1 flex flex-col items-center justify-center space-y-8 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center space-y-3"
        >
          <h2 className="text-4xl font-serif font-bold text-white tracking-tight">
            Choose Your Tale
          </h2>
          <p className="text-neutral-400 text-sm max-w-xs mx-auto leading-relaxed">
            Pick a genre. The AI will generate a unique starting point for you.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 w-full max-w-sm z-10">
          {GENRES.map((g, i) => {
            const IconComponent = g.icon;
            return (
              <motion.button
                key={g.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                disabled={loading}
                onClick={() => onSelect(g.id, g.prompt)}
                className="relative p-2 rounded-2xl border border-neutral-800 bg-[#1a1a1a] hover:bg-neutral-100 hover:border-white hover:text-black transition-all duration-300 text-left group shadow-lg overflow-hidden active:scale-95"
              >
                {/* Animated gradient background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${g.gradient} opacity-40 group-hover:opacity-0 transition-opacity duration-500`}
                />

                {/* Hover gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-white/5 via-white/10 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="relative z-10 flex items-start gap-3">
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    <div className="w-10 h-10 rounded-lg bg-neutral-900 group-hover:bg-white/20 border border-neutral-800 group-hover:border-white/30 flex items-center justify-center transition-all duration-300">
                      <IconComponent
                        size={20}
                        className="text-neutral-400 group-hover:text-neutral-800 transition-colors duration-300"
                      />
                    </div>
                  </div>

                  {/* Text content */}
                  <div className="flex-1 min-w-0">
                    <span className="block font-bold text-xl mb-1.5 text-white group-hover:text-black transition-colors duration-300">
                      {g.label}
                    </span>
                    <span className="text-xs text-neutral-500 group-hover:text-neutral-600 leading-tight block transition-colors duration-300">
                      {g.prompt}
                    </span>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Bottom Action Area - Innovative "My Story" Button */}
      {hasExistingStory && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-6 bg-gradient-to-t from-[#111] via-[#111] to-transparent"
        >
          <div className="relative">
            {/* Ambient glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 blur-xl rounded-2xl" />

            <button
              onClick={onContinue}
              disabled={loading}
              className="relative w-full group overflow-hidden rounded-2xl"
            >
              {/* Animated background */}
              <div className="absolute inset-0 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-800 group-hover:from-amber-900/40 group-hover:via-orange-900/40 group-hover:to-amber-900/40 transition-all duration-500" />

              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />

              {/* Border gradient */}
              <div className="absolute inset-0 rounded-2xl border-2 border-neutral-700 group-hover:border-amber-500/50 transition-colors duration-300" />

              <div className="relative flex items-center justify-between py-3 px-6">
                <div className="flex items-center gap-3">
                  {/* Animated book icon */}
                  <div className="relative">
                    <Book
                      size={22}
                      className="text-neutral-300 group-hover:text-amber-400 transition-all duration-300 group-hover:scale-110"
                    />
                    <Sparkles
                      size={12}
                      className="absolute -top-1 -right-1 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    />
                  </div>

                  <div className="text-left">
                    <div className="text-white font-bold text-base tracking-wide group-hover:text-amber-100 transition-colors duration-300">
                      Continue Your Story
                    </div>
                    <div className="text-neutral-400 text-xs mt-0.5 group-hover:text-neutral-300 transition-colors duration-300">
                      Pick up where you left off
                    </div>
                  </div>
                </div>

                {/* Arrow indicator */}
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-neutral-700/50 group-hover:bg-amber-500/20 border border-neutral-600 group-hover:border-amber-500/50 flex items-center justify-center transition-all duration-300 group-hover:translate-x-1">
                    <svg
                      className="w-4 h-4 text-neutral-400 group-hover:text-amber-400 transition-colors duration-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 7l5 5m0 0l-5 5m5-5H6"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
