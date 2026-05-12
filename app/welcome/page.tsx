"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { motion } from "framer-motion";

const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif";

const TILES = [
  {
    id: "write",
    label: "Write",
    sub: "Start a new story",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    id: "inspire",
    label: "Inspire",
    sub: "AI story starters & twists",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z" />
      </svg>
    ),
  },
  {
    id: "characters",
    label: "Characters",
    sub: "Build depth & voice",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
      </svg>
    ),
  },
  {
    id: "rhythm",
    label: "Rhythm",
    sub: "Pacing & prose flow",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
] as const;

const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];

export default function WelcomePage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setReady(true);
    });
    return unsub;
  }, []);

  const name = user?.displayName?.split(" ")[0] ?? "there";

  return (
    <div style={{ minHeight: "100dvh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SF }}>
      {/* PC width guard */}
      <div style={{ width: "100%", maxWidth: 390, height: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>

        {/* Ambient glow */}
        <div style={{
          position: "absolute", top: -120, left: "50%", transform: "translateX(-50%)",
          width: 340, height: 340, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,255,255,0.045) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        {/* Content */}
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          padding: "0 20px",
          paddingTop: "max(env(safe-area-inset-top, 0px), 64px)",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 36px)",
        }}>

          {/* Header */}
          {ready && (
            <>
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease }}
                style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 36 }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/favicon.ico" alt="" style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0 }} />
                <div>
                  <p style={{ fontSize: 11, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.30)", fontWeight: 600, margin: 0 }}>
                    Raconteur
                  </p>
                  <p style={{ fontSize: 19, fontWeight: 600, color: "#f5f5f7", margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                    Good&nbsp;
                    {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 18 ? "afternoon" : "evening"},&nbsp;{name}.
                  </p>
                </div>
              </motion.div>

              {/* Tiles */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
                {TILES.map((tile, i) => (
                  <motion.button
                    key={tile.id}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.52, delay: 0.08 + i * 0.07, ease }}
                    whileTap={{ scale: 0.975 }}
                    style={{
                      flex: 1,
                      display: "flex", alignItems: "center", gap: 18,
                      padding: "0 22px",
                      borderRadius: 20,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.04)",
                      cursor: "pointer", outline: "none",
                      WebkitTapHighlightColor: "transparent",
                      color: "#f5f5f7",
                      fontFamily: SF,
                      textAlign: "left",
                      minHeight: 0,
                    }}
                  >
                    <span style={{
                      width: 44, height: 44, borderRadius: 14, flexShrink: 0,
                      border: "1px solid rgba(255,255,255,0.10)",
                      background: "rgba(255,255,255,0.07)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "rgba(255,255,255,0.80)",
                    }}>
                      {tile.icon}
                    </span>
                    <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <span style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.01em", color: "#f5f5f7", lineHeight: 1 }}>
                        {tile.label}
                      </span>
                      <span style={{ fontSize: 13, color: "rgba(255,255,255,0.36)", lineHeight: 1 }}>
                        {tile.sub}
                      </span>
                    </span>
                    <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.18)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </span>
                  </motion.button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

