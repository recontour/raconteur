"use client";

import React from "react";
import { BottomCTA } from "./BottomCTA";

interface Props {
  enteredName: string;
  googleName: string;
  keyboardOffset: number;
  onSelect: (name: string) => void;
}

export function StepNameConflict({ enteredName, googleName, keyboardOffset, onSelect }: Props) {
  return (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center px-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Choose your name
          </h2>
          <p className="text-gray-500 text-base">
            Your Google account has a different name. Which one would you like to use?
          </p>
        </div>

        <div className="space-y-4 pt-4">
          <button
            onClick={() => onSelect(enteredName)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-black transition-colors text-left flex flex-col gap-1"
          >
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">You entered</span>
            <span className="text-lg font-medium text-black">{enteredName}</span>
          </button>

          <button
            onClick={() => onSelect(googleName)}
            className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-black transition-colors text-left flex flex-col gap-1"
          >
            <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">From Google</span>
            <span className="text-lg font-medium text-black">{googleName}</span>
          </button>
        </div>
      </div>
      
      <BottomCTA offset={keyboardOffset}>
        <div className="w-full py-4 hidden" />
      </BottomCTA>
    </div>
  );
}
