"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

const CORRECT_CODE = "4646";
const LS_THEME = "rc-gate-theme";
const SS_ACCESS = "rc-gate-access";

type Theme = "dark" | "light";
type Status = "idle" | "error" | "success";

const ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["", "0", "⌫"],
] as const;

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function BackspaceIcon() {
  return (
    <svg width="22" height="17" viewBox="0 0 22 17" fill="none">
      <path d="M7.5 1L1 8.5L7.5 16M1 8.5H21" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SpinnerIcon({ color }: { color: string }) {
  return (
    <motion.svg
      width="32" height="32" viewBox="0 0 32 32" fill="none"
      animate={{ rotate: 360 }}
      transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
      style={{ display: "block" }}
    >
      <circle cx="16" cy="16" r="13" stroke={color} strokeOpacity="0.13" strokeWidth="2" />
      <path d="M16 3A13 13 0 0 1 29 16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </motion.svg>
  );
}

export default function GatePage() {
  const [digits, setDigits] = useState<string[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const router = useRouter();

  // Restore theme + check cached access on mount
  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem(LS_THEME) as Theme | null;
      if (saved === "dark" || saved === "light") setTheme(saved);
    } catch {}
    try {
      if (sessionStorage.getItem(SS_ACCESS) === "true") {
        router.replace("/invite");
      }
    } catch {}
  }, [router]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem(LS_THEME, next); } catch {}
      return next;
    });
  }, []);

  const handlePress = useCallback((key: string) => {
    if (status !== "idle" || digits.length >= 4) return;
    const next = [...digits, key];
    setDigits(next);
    if (next.length === 4) {
      if (next.join("") === CORRECT_CODE) {
        setStatus("success");
        try { sessionStorage.setItem(SS_ACCESS, "true"); } catch {}
        setTimeout(() => router.push("/invite"), 950);
      } else {
        setStatus("error");
        setTimeout(() => {
          setDigits([]);
          setStatus("idle");
        }, 820);
      }
    }
  }, [status, digits, router]);

  const handleBackspace = useCallback(() => {
    if (status !== "idle") return;
    setDigits((prev) => prev.slice(0, -1));
  }, [status]);

  const isDark = theme === "dark";
  const bg = isDark ? "#000" : "#fff";
  const fg = isDark ? "#fff" : "#000";
  const keyBg = isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.05)";
  const keyTap = isDark ? "rgba(255,255,255,0.18)" : "rgba(0,0,0,0.13)";
  const border = isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.10)";
  const labelColor = isDark ? "rgba(255,255,255,0.36)" : "rgba(0,0,0,0.36)";
  const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

  if (!mounted) return null;

  return (
    <motion.div
      animate={{ backgroundColor: bg }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{ backgroundColor: bg, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100dvh" }}
    >
      {/* PC-width guard — mirrors invite page constraint */}
      <div
        style={{ color: fg, fontFamily: SF, WebkitFontSmoothing: "antialiased" as React.CSSProperties["WebkitFontSmoothing"] }}
        className="relative flex flex-col w-full max-w-97.5 h-dvh overflow-hidden"
      >

          {/* Theme toggle — top-right */}
          <div className="absolute top-0 right-0 p-5 z-20">
            <motion.button
              onClick={toggleTheme}
              whileTap={{ scale: 0.82 }}
              transition={{ type: "spring", damping: 20, stiffness: 450 }}
              style={{
                width: 38, height: 38,
                borderRadius: "50%",
                border: `1px solid ${border}`,
                background: keyBg,
                color: fg,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", outline: "none",
                WebkitTapHighlightColor: "transparent",
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={theme}
                  initial={{ opacity: 0, rotate: -35, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 35, scale: 0.6 }}
                  transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                  style={{ display: "flex" }}
                >
                  {isDark ? <SunIcon /> : <MoonIcon />}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Central content */}
          <div
            className="flex flex-col flex-1 items-center justify-center"
            style={{ gap: 52, paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
          >
            {/* Logo + label */}
            <motion.div
              initial={{ opacity: 0, y: -14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}
            >
              <motion.div
                animate={{ background: fg }}
                transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                style={{
                  width: 52, height: 52, borderRadius: 18,
                  background: fg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: isDark
                    ? "0 0 0 1px rgba(255,255,255,0.08), 0 8px 32px rgba(255,255,255,0.06)"
                    : "0 0 0 1px rgba(0,0,0,0.06), 0 8px 32px rgba(0,0,0,0.08)",
                }}
              >
                <motion.span
                  animate={{ color: bg }}
                  transition={{ duration: 0.45 }}
                  style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.04em", color: bg }}
                >
                  R
                </motion.span>
              </motion.div>

              <p style={{ color: labelColor, fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 500, margin: 0 }}>
                Enter passcode
              </p>
            </motion.div>

            {/* 4-dot indicator */}
            <motion.div
              animate={status === "error" ? { x: [0, -11, 11, -8, 8, -5, 5, -2, 2, 0] } : { x: 0 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              style={{ display: "flex", gap: 20 }}
            >
              {Array.from({ length: 4 }).map((_, i) => {
                const filled = i < digits.length;
                const errColor = "#ff453a";
                const dotBg = status === "error"
                  ? errColor
                  : status === "success" && filled
                    ? fg
                    : filled ? fg : "transparent";
                const dotBorder = status === "error" ? errColor : fg;

                return (
                  <motion.div
                    key={i}
                    animate={{ backgroundColor: dotBg, borderColor: dotBorder, scale: status === "success" && filled ? [1, 1.45, 1] : 1 }}
                    transition={{
                      backgroundColor: { duration: 0.18 },
                      borderColor: { duration: 0.18 },
                      scale: { duration: 0.32, delay: status === "success" ? i * 0.08 : 0, ease: [0.22, 1, 0.36, 1] },
                    }}
                    style={{
                      width: 13, height: 13,
                      borderRadius: "50%",
                      border: `1.5px solid ${fg}`,
                    }}
                  />
                );
              })}
            </motion.div>

            {/* Keypad grid / Loading state */}
            <AnimatePresence mode="wait">
              {status === "success" ? (
                <motion.div
                  key="unlocking"
                  initial={{ opacity: 0, scale: 0.78 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 18,
                    height: 390, justifyContent: "center",
                  }}
                >
                  <SpinnerIcon color={fg} />
                  <p style={{ color: labelColor, fontSize: 11, letterSpacing: "0.20em", textTransform: "uppercase", fontWeight: 500, margin: 0 }}>
                    Unlocking
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key="keypad"
                  initial={{ opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8, scale: 0.97 }}
                  transition={{ duration: 0.6, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
                  style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 292, alignItems: "center" }}
                >
                  {ROWS.map((row, ri) => (
                    <div key={ri} style={{ display: "flex", gap: 14 }}>
                      {row.map((key, ki) => {
                        const isBS = key === "⌫";
                        const isEmpty = key === "";

                        if (isEmpty) {
                          return <div key={ki} style={{ width: 88, height: 88 }} />;
                        }

                        return (
                          <motion.button
                            key={ki}
                            onClick={() => isBS ? handleBackspace() : handlePress(key)}
                            whileTap={{ scale: 0.84, backgroundColor: keyTap }}
                            transition={{ type: "spring", damping: 16, stiffness: 520 }}
                            style={{
                              width: 88, height: 88,
                              borderRadius: "50%",
                              border: `1px solid ${border}`,
                              background: keyBg,
                              color: fg,
                              display: "flex", alignItems: "center", justifyContent: "center",
                              cursor: "pointer",
                              fontSize: isBS ? undefined : 30,
                              fontWeight: 300,
                              letterSpacing: "-0.02em",
                              outline: "none",
                              userSelect: "none",
                              WebkitTapHighlightColor: "transparent",
                              flexShrink: 0,
                              fontFamily: SF,
                            }}
                          >
                            {isBS ? <BackspaceIcon /> : key}
                          </motion.button>
                        );
                      })}
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Success fade-out overlay */}
          <AnimatePresence>
            {status === "success" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.42, duration: 0.44, ease: [0.22, 1, 0.36, 1] }}
                style={{ position: "absolute", inset: 0, backgroundColor: bg, zIndex: 30 }}
              />
            )}
          </AnimatePresence>

      </div>

      <style>{`
        html, body { height: 100%; margin: 0; }
        * { -webkit-tap-highlight-color: transparent; box-sizing: border-box; }
      `}</style>
    </motion.div>
  );
}


