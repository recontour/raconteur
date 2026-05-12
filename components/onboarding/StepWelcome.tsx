"use client";

import React from "react";
import { BottomCTA } from "./BottomCTA";

interface Props {
  onStart: () => void;
}

export function StepWelcome({ onStart }: Props) {
  return (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-black flex items-center justify-center shadow-lg mb-2">
          <span
            style={{
              fontFamily: "'SF Pro Display', -apple-system, sans-serif",
              fontSize: 28, fontWeight: 700, color: "#fff",
              letterSpacing: "-0.5px", lineHeight: 1,
            }}
          >
            R
          </span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-[#1d1d1f]">
          Welcome to<br />Raconteur.
        </h1>
        <p className="text-gray-500 text-lg leading-relaxed">
          Your personal storytelling companion. Let&apos;s get you set up.
        </p>
      </div>
      <BottomCTA offset={0}>
        <button
          onClick={onStart}
          className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg active:scale-[0.98] shadow-sm select-none transition-all"
        >
          Get Started
        </button>
      </BottomCTA>
    </div>
  );
}
