"use client";

import React, { useRef } from "react";
import { BottomCTA } from "./BottomCTA";

interface Props {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  showLastName: boolean;
  setShowLastName: (v: boolean) => void;
  keyboardOffset: number;
  onContinue: () => void;
  inputCls: string;
}

export function StepName({
  firstName, setFirstName,
  lastName, setLastName,
  showLastName, setShowLastName,
  keyboardOffset, onContinue, inputCls,
}: Props) {
  const firstNameRef = useRef<HTMLInputElement>(null);
  const lastNameRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center px-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            What&apos;s your name?
          </h2>
          <p className="text-gray-500 text-base">
            This is how you&apos;ll appear to your readers.
          </p>
        </div>

        <div className="space-y-3">
          <input
            ref={firstNameRef}
            type="text"
            placeholder="First name"
            value={firstName}
            autoComplete="given-name"
            onChange={(e) => setFirstName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && firstName.trim()) {
                if (showLastName) lastNameRef.current?.focus();
                else onContinue();
              }
            }}
            className={inputCls}
          />
          {showLastName && (
            <input
              ref={lastNameRef}
              type="text"
              placeholder="Last name"
              value={lastName}
              autoComplete="family-name"
              onChange={(e) => setLastName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && firstName.trim()) onContinue();
              }}
              className={inputCls}
            />
          )}
          {!showLastName && (
            <button
              onClick={() => {
                setShowLastName(true);
                setTimeout(() => lastNameRef.current?.focus(), 260);
              }}
              className="text-[15px] text-gray-500 font-medium pl-1 active:opacity-50 transition-opacity"
            >
              + Add last name
            </button>
          )}
        </div>
      </div>

      <BottomCTA offset={keyboardOffset}>
        <button
          onClick={onContinue}
          disabled={!firstName.trim()}
          className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg disabled:opacity-40 active:scale-[0.98] shadow-sm select-none transition-all"
        >
          Continue
        </button>
      </BottomCTA>
    </div>
  );
}
