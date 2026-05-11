"use client";

import { useState, useEffect, useCallback } from "react";
import type { WtfFact } from "./api/wtf-fact/route";

type GameState = "loading" | "ready" | "answered";

export default function Home() {
  const [fact, setFact] = useState<WtfFact | null>(null);
  const [gameState, setGameState] = useState<GameState>("loading");
  const [selectedOption, setSelectedOption] = useState<1 | 2 | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);

  const fetchFact = useCallback(async () => {
    setGameState("loading");
    setSelectedOption(null);
    setIsCorrect(null);
    setFact(null);

    try {
      const res = await fetch("/api/wtf-fact");
      if (!res.ok) throw new Error("Failed to fetch");
      const data: WtfFact = await res.json();
      setFact(data);
      setGameState("ready");
    } catch {
      // retry once on error
      setGameState("loading");
    }
  }, []);

  useEffect(() => {
    fetchFact();
  }, [fetchFact]);

  const handleOptionClick = (option: 1 | 2) => {
    if (gameState !== "ready" || !fact) return;
    const correct = option === fact.correctOption;
    setSelectedOption(option);
    setIsCorrect(correct);
    setGameState("answered");
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-950">
      {/* Mobile container */}
      <div className="relative flex flex-col w-full max-w-100 h-screen bg-neutral-900 overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-10 pb-4 shrink-0">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            WTF Fact
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Which one is the real mind-blower?
          </p>
        </div>

        {/* Context strip */}
        <div className="px-5 pb-4 shrink-0 min-h-14">
          {fact && gameState !== "loading" ? (
            <p className="text-base text-neutral-200 leading-snug">
              {fact.context}
            </p>
          ) : (
            <div className="h-5 w-3/4 rounded bg-neutral-700 animate-pulse" />
          )}
        </div>

        {/* Two square buttons */}
        <div className="flex flex-col flex-1 gap-3 px-5 pb-5">
          {[1, 2].map((opt) => {
            const optNum = opt as 1 | 2;
            const isSelected = selectedOption === optNum;
            const isLoading = gameState === "loading";

            return (
              <button
                key={opt}
                onClick={() => handleOptionClick(optNum)}
                disabled={gameState !== "ready"}
                className={[
                  "flex-1 w-full rounded-2xl flex items-center justify-center p-6 text-center",
                  "transition-all duration-200 active:scale-[0.98]",
                  "focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                  isLoading
                    ? "bg-neutral-800 cursor-not-allowed"
                    : gameState === "ready"
                    ? "bg-indigo-600 hover:bg-indigo-500 cursor-pointer shadow-lg shadow-indigo-900/40"
                    : isSelected
                    ? "bg-neutral-700 cursor-not-allowed"
                    : "bg-neutral-800 cursor-not-allowed opacity-50",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {isLoading ? (
                  <span className="block h-4 w-2/3 rounded bg-neutral-700 animate-pulse" />
                ) : (
                  <span className="text-white font-semibold text-base leading-snug">
                    {opt === 1 ? fact?.option1 : fact?.option2}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Result modal */}
        {gameState === "answered" && fact && (
          <div className="absolute inset-0 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-full bg-neutral-900 rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl">
              {/* Result badge */}
              <div
                className={[
                  "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-bold mb-4",
                  isCorrect
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400",
                ].join(" ")}
              >
                <span>{isCorrect ? "✓" : "✗"}</span>
                <span>{isCorrect ? "That's right!" : "Not quite!"}</span>
              </div>

              {/* Explanation */}
              <p className="text-neutral-200 text-sm leading-relaxed mb-6">
                {fact.fullExplanation}
              </p>

              {/* Next button */}
              <button
                onClick={fetchFact}
                className="w-full bg-indigo-600 hover:bg-indigo-500 active:scale-[0.98] text-white font-bold py-4 rounded-2xl transition-all duration-150 shadow-lg shadow-indigo-900/40"
              >
                Next Fact →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
