"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomCTA } from "./BottomCTA";

interface Props {
  phone: string[];
  setPhone: (v: string[]) => void;
  focusedPhone: number | null;
  setFocusedPhone: (v: number | null) => void;
  otpError: string;
  sendingOtp: boolean;
  keyboardOffset: number;
  onSend: () => void;
  onBack: () => void;
  recaptchaRef: React.RefObject<HTMLDivElement | null>;
}

export function StepPhone({
  phone, setPhone, focusedPhone, setFocusedPhone,
  otpError, sendingOtp, keyboardOffset, onSend, onBack, recaptchaRef,
}: Props) {
  const phoneRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center px-6 space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold tracking-widest text-gray-400 uppercase">
            +91 &middot; India
          </p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Your phone number.
          </h2>
          <p className="text-gray-500 text-base">
            We&apos;ll send a one-time code to verify it&apos;s you.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {([0, 5] as const).map((rowStart) => (
            <div key={rowStart} className="flex gap-2">
              {Array.from({ length: 5 }, (_, k) => rowStart + k).map((i) => (
                <div key={i} className="relative flex-1" style={{ height: 60 }}>
                  <motion.div
                    variants={{
                      empty:   { backgroundColor: "#f2f2f7", scale: 1 },
                      focused: { backgroundColor: "#e5e5ea", scale: 1 },
                      filled:  { backgroundColor: "#1d1d1f", scale: 1 },
                    }}
                    initial="empty"
                    animate={phone[i] ? "filled" : focusedPhone === i ? "focused" : "empty"}
                    transition={{ type: "spring", damping: 20, stiffness: 600 }}
                    className="absolute inset-0 rounded-xl"
                  />
                  <input
                    ref={(el) => { phoneRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={phone[i]}
                    onFocus={() => setFocusedPhone(i)}
                    onBlur={() => setFocusedPhone(null)}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (!val) return;
                      const next = [...phone];
                      next[i] = val[val.length - 1];
                      setPhone(next);
                      if (i < 9) phoneRefs.current[i + 1]?.focus();
                      else phoneRefs.current[9]?.blur();
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace") {
                        if (phone[i]) {
                          const next = [...phone]; next[i] = ""; setPhone(next);
                        } else if (i > 0) {
                          phoneRefs.current[i - 1]?.focus();
                        }
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 10);
                      const next = Array(10).fill("") as string[];
                      pasted.split("").forEach((ch, idx) => { next[idx] = ch; });
                      setPhone(next);
                      if (pasted.length >= 10) phoneRefs.current[9]?.blur();
                      else phoneRefs.current[Math.min(pasted.length, 9)]?.focus();
                    }}
                    className="absolute inset-0 w-full h-full text-center text-xl font-semibold bg-transparent focus:outline-none"
                    style={{
                      color: phone[i] ? "#fff" : "#1d1d1f",
                      caretColor: "transparent",
                      zIndex: 1,
                      WebkitTapHighlightColor: "transparent",
                    }}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <AnimatePresence>
          {otpError && (
            <motion.p
              key="phone-error"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="text-red-500 text-sm"
            >
              {otpError}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      <BottomCTA offset={keyboardOffset}>
        <div className="space-y-3">
          <motion.button
            onClick={onSend}
            disabled={phone.join("").length < 10 || sendingOtp}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg disabled:opacity-40 shadow-sm select-none transition-opacity"
          >
            {sendingOtp ? "Sending…" : "Send Code"}
          </motion.button>
          <button
            onClick={onBack}
            className="w-full py-4 border border-gray-200 rounded-xl text-[#1d1d1f] font-medium text-lg active:scale-[0.98] transition-all"
          >
            Back
          </button>
        </div>
      </BottomCTA>

      <div ref={recaptchaRef} />
    </div>
  );
}
