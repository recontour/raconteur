"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { signOut } from "firebase/auth";
import { useAuth } from "./auth";
import { auth } from "@/lib/firebase";
import { useRouter, usePathname } from "next/navigation";

// ── Constants ─────────────────────────────────────────────────────────────────
const LS_THEME = "rc-app-theme";
type Theme = "dark" | "light";
const ORIGIN = "calc(100% - 35px) 35px";
const SF = "-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif";

// ── Motion ────────────────────────────────────────────────────────────────────
const ease = [0.22, 1, 0.36, 1] as [number, number, number, number];
const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.24 } },
  exit:   { transition: { staggerChildren: 0.03, staggerDirection: -1 as const } },
};
const fadeUp = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0,  transition: { duration: 0.38, ease } },
  exit:    { opacity: 0, y: 8,  transition: { duration: 0.14 } },
};

// ── Icons ─────────────────────────────────────────────────────────────────────
function XIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
      <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="2" x2="12" y2="4" /><line x1="12" y1="20" x2="12" y2="22" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="2" y1="12" x2="4" y2="12" /><line x1="20" y1="12" x2="22" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

// ── UserBubble ────────────────────────────────────────────────────────────────
export function UserBubble() {
  const { user } = useAuth();
  const router   = useRouter();

  const pathname = usePathname();

  const [open,     setOpen]     = useState(false);
  const [theme,    setTheme]    = useState<Theme>("dark");
  const [imgError, setImgError] = useState(false);

  // Restore saved theme
  useEffect(() => {
    try {
      const s = localStorage.getItem(LS_THEME) as Theme | null;
      if (s === "dark" || s === "light") setTheme(s);
    } catch {}
  }, []);

  // Lock scroll while overlay open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const close = () => setOpen(false);

  const toggleTheme = () => setTheme(prev => {
    const next: Theme = prev === "dark" ? "light" : "dark";
    try { localStorage.setItem(LS_THEME, next); } catch {}
    return next;
  });

  const handleLogout = async () => {
    close();
    await signOut(auth);
    router.replace("/invite");
  };

  const handleLogin = () => {
    close();
    router.push("/invite");
  };

  // ── Gate page: no bubble ────────────────────────────────────────────────────
  if (pathname === "/") return null;

  // ── Derived ────────────────────────────────────────────────────────────────
  const photo       = user && !imgError && user.photoURL ? user.photoURL : null;
  const initial     = user ? (user.displayName ?? user.email ?? "?").slice(0, 1).toUpperCase() : "?";
  const isDark      = theme === "dark";

  const overlayBg    = isDark ? "rgba(8,8,8,0.94)"             : "rgba(248,248,248,0.94)";
  const textPrimary  = isDark ? "#f5f5f7"                      : "#1d1d1f";
  const textSub      = isDark ? "rgba(255,255,255,0.40)"       : "rgba(0,0,0,0.38)";
  const textDanger   = isDark ? "#ff453a"                      : "#ff3b30";
  const divider      = isDark ? "rgba(255,255,255,0.07)"       : "rgba(0,0,0,0.07)";
  const rowBg        = isDark ? "rgba(255,255,255,0.05)"       : "rgba(0,0,0,0.04)";
  const rowTap       = isDark ? "rgba(255,255,255,0.10)"       : "rgba(0,0,0,0.08)";
  const dangerTap    = isDark ? "rgba(255,67,58,0.12)"         : "rgba(255,59,48,0.09)";
  const toggleBg     = isDark ? "rgba(255,255,255,0.07)"       : "rgba(0,0,0,0.05)";
  const toggleBorder = isDark ? "rgba(255,255,255,0.09)"       : "rgba(0,0,0,0.09)";
  const bubbleBg     = open
    ? (isDark ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.09)")
    : (photo ? "transparent" : "#1d1d1f");

  return (
    <>
      <motion.button
        onClick={() => setOpen(v => !v)}
        initial={{ opacity: 0, scale: 0.55 }}
        animate={{ opacity: 1, scale: 1 }}
        whileTap={{ scale: 0.84 }}
        transition={{ type: "spring", damping: 22, stiffness: 340 }}
        aria-label={open ? "Close menu" : "Open menu"}
        style={{
          position: "fixed", top: 16, right: 16, zIndex: 10000,
          width: 38, height: 38, borderRadius: "50%",
          border: "none", padding: 0, outline: "none",
          cursor: "pointer", overflow: "hidden",
          background: bubbleBg,
          boxShadow: open
            ? "0 0 0 2px rgba(255,255,255,0.20)"
            : "0 2px 14px rgba(0,0,0,0.30), 0 0 0 1.5px rgba(255,255,255,0.10)",
          WebkitTapHighlightColor: "transparent",
          fontFamily: SF, fontSize: 15, fontWeight: 600, color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span key="x"
              initial={{ opacity: 0, rotate: -45, scale: 0.4 }}
              animate={{ opacity: 1, rotate: 0,   scale: 1   }}
              exit={{   opacity: 0, rotate:  45, scale: 0.4 }}
              transition={{ duration: 0.18, ease }}
              style={{ display: "flex", color: textPrimary }}
            >
              <XIcon />
            </motion.span>
          ) : photo ? (
            <motion.div key="photo"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.14 }}
              style={{ width: "100%", height: "100%" }}
            >
              <img src={photo} alt="" referrerPolicy="no-referrer" onError={() => setImgError(true)}
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </motion.div>
          ) : (
            <motion.span key="initial"
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
              transition={{ duration: 0.14 }}
            >
              {initial}
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            key="overlay"
            initial={{ clipPath: `circle(19px at ${ORIGIN})` }}
            animate={{ clipPath: `circle(200% at ${ORIGIN})`  }}
            exit={{    clipPath: `circle(19px at ${ORIGIN})` }}
            transition={{ duration: 0.52, ease }}
            style={{
              position: "fixed", inset: 0, zIndex: 9999,
              background: overlayBg,
              backdropFilter: "blur(56px) saturate(180%)",
              WebkitBackdropFilter: "blur(56px) saturate(180%)",
              overflowY: "auto", fontFamily: SF,
            }}
          >
            <motion.div
              variants={stagger} initial="hidden" animate="visible" exit="exit"
              style={{
                minHeight: "100dvh", maxWidth: 390, margin: "0 auto",
                display: "flex", flexDirection: "column",
                paddingTop:    "max(env(safe-area-inset-top,    0px), 16px)",
                paddingBottom: "max(env(safe-area-inset-bottom, 0px), 40px)",
              }}
            >
              <motion.div variants={fadeUp}
                style={{ display: "flex", alignItems: "center", padding: "10px 20px 0" }}
              >
                <motion.button
                  onClick={toggleTheme}
                  whileTap={{ scale: 0.80 }}
                  transition={{ type: "spring", damping: 20, stiffness: 440 }}
                  style={{
                    width: 36, height: 36, borderRadius: "50%",
                    border: `1px solid ${toggleBorder}`, background: toggleBg,
                    color: textPrimary, display: "flex", alignItems: "center",
                    justifyContent: "center", cursor: "pointer", outline: "none",
                    WebkitTapHighlightColor: "transparent",
                  }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span key={theme}
                      initial={{ opacity: 0, rotate: -30, scale: 0.6 }}
                      animate={{ opacity: 1, rotate: 0,   scale: 1   }}
                      exit={{   opacity: 0, rotate:  30, scale: 0.6 }}
                      transition={{ duration: 0.16, ease }}
                      style={{ display: "flex" }}
                    >
                      {isDark ? <SunIcon /> : <MoonIcon />}
                    </motion.span>
                  </AnimatePresence>
                </motion.button>
              </motion.div>

              {user ? (
                <motion.div variants={fadeUp}
                  style={{ display: "flex", alignItems: "center", gap: 16, padding: "40px 28px 28px" }}
                >
                  <div style={{
                    width: 58, height: 58, borderRadius: "50%", flexShrink: 0,
                    overflow: "hidden", background: "#1d1d1f",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: isDark ? "0 0 0 1.5px rgba(255,255,255,0.09)" : "0 0 0 1.5px rgba(0,0,0,0.09)",
                  }}>
                    {photo ? (
                      <img src={photo} alt="" referrerPolicy="no-referrer"
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <span style={{ fontSize: 24, fontWeight: 600, color: "#fff" }}>{initial}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <p style={{
                      fontSize: 20, fontWeight: 600, color: textPrimary,
                      margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {user.displayName || "User"}
                    </p>
                    <p style={{
                      fontSize: 13, color: textSub, margin: "4px 0 0", lineHeight: 1,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {user.email}
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div variants={fadeUp}
                  style={{ padding: "40px 28px 28px", display: "flex", flexDirection: "column", gap: 8 }}
                >
                  <p style={{
                    fontSize: 28, fontWeight: 700, color: textPrimary,
                    margin: 0, letterSpacing: "-0.03em", lineHeight: 1.15,
                  }}>
                    Welcome to<br />Raconteur.
                  </p>
                  <p style={{
                    fontSize: 15, color: textSub, margin: "6px 0 0",
                    lineHeight: 1.5, letterSpacing: "-0.01em",
                  }}>
                    Sign in below to start writing your story.
                  </p>
                </motion.div>
              )}

              <motion.div variants={fadeUp}
                style={{ height: 1, background: divider, margin: "0 24px 8px" }}
              />

              <motion.div variants={fadeUp}
                style={{ padding: "4px 16px", display: "flex", flexDirection: "column", gap: 6 }}
              >
                {user ? (
                  <>
                    <motion.button
                      variants={fadeUp}
                      onClick={() => { close(); router.push("/profile"); }}
                      whileTap={{ scale: 0.97, backgroundColor: rowTap }}
                      transition={{ type: "spring", damping: 18, stiffness: 480 }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 14,
                        padding: "16px 18px", borderRadius: 18,
                        border: `1px solid ${divider}`, background: rowBg,
                        cursor: "pointer", color: textPrimary, fontFamily: SF,
                        fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em",
                        textAlign: "left", outline: "none",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.65, flexShrink: 0 }}>
                        <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                      </svg>
                      Profile
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: "auto", opacity: 0.25 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </motion.button>

                    <motion.button
                      variants={fadeUp}
                      onClick={handleLogout}
                      whileTap={{ scale: 0.97, backgroundColor: dangerTap }}
                      transition={{ type: "spring", damping: 18, stiffness: 480 }}
                      style={{
                        width: "100%", display: "flex", alignItems: "center", gap: 14,
                        padding: "16px 18px", borderRadius: 18,
                        border: `1px solid ${isDark ? "rgba(255,67,58,0.15)" : "rgba(255,59,48,0.12)"}`,
                        background: isDark ? "rgba(255,67,58,0.06)" : "rgba(255,59,48,0.04)",
                        cursor: "pointer", color: textDanger, fontFamily: SF,
                        fontSize: 16, fontWeight: 500, letterSpacing: "-0.01em",
                        textAlign: "left", outline: "none",
                        WebkitTapHighlightColor: "transparent",
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.75, flexShrink: 0 }}>
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                      Sign Out
                    </motion.button>
                  </>
                ) : (
                  <motion.button
                    variants={fadeUp}
                    onClick={handleLogin}
                    whileTap={{ scale: 0.96 }}
                    transition={{ type: "spring", damping: 18, stiffness: 480 }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                      padding: "18px 24px", borderRadius: 22,
                      border: "none",
                      background: isDark
                        ? "linear-gradient(135deg, #f5f5f7 0%, #d1d1d6 100%)"
                        : "linear-gradient(135deg, #1d1d1f 0%, #3a3a3c 100%)",
                      cursor: "pointer",
                      color: isDark ? "#1d1d1f" : "#f5f5f7",
                      fontFamily: SF,
                      fontSize: 16, fontWeight: 600, letterSpacing: "-0.02em",
                      outline: "none",
                      WebkitTapHighlightColor: "transparent",
                      boxShadow: isDark
                        ? "0 8px 32px rgba(255,255,255,0.12), 0 2px 8px rgba(255,255,255,0.06)"
                        : "0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.09)",
                    }}
                  >
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                      <polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
                    </svg>
                    Sign In
                  </motion.button>
                )}
              </motion.div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
