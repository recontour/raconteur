"use client";

import React, { useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BottomCTA } from "./BottomCTA";

interface Props {
  otp: string[];
  setOtp: (v: string[]) => void;
  phone: string[];
  focusedOtp: number | null;
  setFocusedOtp: (v: number | null) => void;
  otpError: string;
  verifyingOtp: boolean;
  sendingOtp: boolean;
  keyboardOffset: number;
  onVerify: () => void;
  onResend: () => void;
  onBack: () => void;
}

export function StepOtp({
  otp, setOtp, phone, focusedOtp, setFocusedOtp,
  otpError, verifyingOtp, sendingOtp, keyboardOffset,
  onVerify, onResend, onBack,
}: Props) {
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  return (
    <div className="flex flex-col h-full w-full max-w-sm mx-auto">
      <div className="flex-1 flex flex-col justify-center px-6 space-y-8">
        <div className="space-y-2">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1d1d1f]">
            Enter the code.
          </h2>
          <p className="text-gray-500 text-base">
            Sent to +91&nbsp;{phone.join("")}
          </p>
        </div>

        <div className="flex gap-2.5">
          {otp.map((digit, i) => (
            <div key={i} className="relative flex-1" style={{ height: 62 }}>
              <motion.div
                variants={{
                  empty:   { backgroundColor: "#f2f2f7", scale: 1 },
                  focused: { backgroundColor: "#e5e5ea", scale: 1 },
                  filled:  { backgroundColor: "#1d1d1f", scale: 1 },
                }}
                initial="empty"
                animate={digit ? "filled" : focusedOtp === i ? "focused" : "empty"}
                transition={{ type: "spring", damping: 20, stiffness: 600 }}
                className="absolute inset-0 rounded-2xl"
              />
              <input
                ref={(el) => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete={i === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                onFocus={() => setFocusedOtp(i)}
                onBlur={() => setFocusedOtp(null)}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, "");
                  if (!val) return;
                  const next = [...otp];
                  next[i] = val[val.length - 1];
                  setOtp(next);
                  if (i < 5) {
                    otpRefs.current[i + 1]?.focus();
                  } else {
                    otpRefs.current[5]?.blur();
                    if (next.every((d) => d)) setTimeout(onVerify, 50);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Backspace") {
                    if (otp[i]) {
                      const next = [...otp]; next[i] = ""; setOtp(next);
                    } else if (i > 0) {
                      otpRefs.current[i - 1]?.focus();
                    }
                  }
                }}
                onPaste={(e) => {
                  e.preventDefault();
                  const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
                  const next = [...otp];
                  pasted.split("").forEach((ch, idx) => { next[idx] = ch; });
                  setOtp(next);
                  if (pasted.length >= 6) {
                    otpRefs.current[5]?.blur();
                    setTimeout(onVerify, 50);
                  } else {
                    otpRefs.current[Math.min(pasted.length, 5)]?.focus();
                  }
                }}
                className="absolute inset-0 w-full h-full text-center text-2xl font-semibold bg-transparent focus:outline-none"
                style={{
                  color: digit ? "#fff" : "#1d1d1f",
                  caretColor: "transparent",
                  zIndex: 1,
                  WebkitTapHighlightColor: "transparent",
                }}
              />
            </div>
          ))}
        </div>

        <AnimatePresence>
          {otpError && (
            <motion.p
              key="otp-error"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="text-red-500 text-sm"
            >
              {otpError}
            </motion.p>
          )}
        </AnimatePresence>

        <button
          onClick={onResend}
          disabled={sendingOtp}
          className="text-[15px] text-gray-400 font-medium active:opacity-50 transition-opacity self-start"
        >
          {sendingOtp ? "Resending…" : "Resend code"}
        </button>
      </div>

      <BottomCTA offset={keyboardOffset}>
        <div className="space-y-3">
          <motion.button
            onClick={onVerify}
            disabled={otp.join("").length < 6 || verifyingOtp}
            whileTap={{ scale: 0.97 }}
            className="w-full py-4 bg-black text-white rounded-xl font-medium text-lg disabled:opacity-40 shadow-sm select-none transition-opacity"
          >
            {verifyingOtp ? "Verifying…" : "Verify"}
          </motion.button>
          <button
            onClick={onBack}
            className="w-full py-4 border border-gray-200 rounded-xl text-[#1d1d1f] font-medium text-lg active:scale-[0.98] transition-all"
          >
            Back
          </button>
        </div>
      </BottomCTA>
    </div>
  );
}
