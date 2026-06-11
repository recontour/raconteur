"use client";

import { useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  GoogleAuthProvider,
  signInWithPopup,
  linkWithPopup,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { saveSummerCache, type SummerCachePayload } from "@/app/actions/summer";
import SummerRing from "./SummerRing";
import styles from "./SummerHead.module.css";

// ─── Device fingerprinting (exported so StoryInterface can call on page_load) ─

export async function collectDeviceSnapshot(
  sessionId: string,
  userId: string | null | undefined,
  event: string,
): Promise<SummerCachePayload> {
  const nav  = navigator as Navigator & Record<string, unknown>;
  const conn = (
    (nav["connection"] ?? nav["mozConnection"] ?? nav["webkitConnection"]) as Record<string, unknown> | null
  );

  // WebGL GPU info
  let gpuRenderer: string | undefined;
  let gpuVendor:   string | undefined;
  let webglVersion: number | undefined;
  try {
    const cvs = document.createElement("canvas");
    const gl2 = cvs.getContext("webgl2") as WebGL2RenderingContext | null;
    const gl1 = gl2 ? null : (cvs.getContext("webgl") as WebGLRenderingContext | null);
    const gl  = gl2 ?? gl1;
    webglVersion = gl2 ? 2 : (gl1 ? 1 : 0);
    if (gl) {
      const ext = gl.getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        gpuRenderer = (gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) as string) || undefined;
        gpuVendor   = (gl.getParameter(ext.UNMASKED_VENDOR_WEBGL)   as string) || undefined;
      }
    }
  } catch { /* ignore */ }

  // Audio context sample rate (no audio plays — just reads the rate)
  let audioContextSampleRate: number | undefined;
  try {
    const ac = new AudioContext();
    audioContextSampleRate = ac.sampleRate;
    await ac.close();
  } catch { /* ignore */ }

  // Battery API (async, non-critical)
  let batteryLevel:    number  | undefined;
  let batteryCharging: boolean | undefined;
  try {
    const getBattery = (
      navigator as { getBattery?: () => Promise<{ level: number; charging: boolean }> }
    ).getBattery;
    if (typeof getBattery === "function") {
      const b = await getBattery.call(navigator);
      batteryLevel    = b.level;
      batteryCharging = b.charging;
    }
  } catch { /* ignore */ }

  // Navigation timing
  let navigationTiming: Record<string, number> | undefined;
  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const t = performance.timing;
    if (t?.navigationStart) {
      navigationTiming = {
        domContentLoaded: t.domContentLoadedEventEnd - t.navigationStart,
        domComplete:      t.domComplete              - t.navigationStart,
        loadEvent:        t.loadEventEnd             - t.navigationStart,
      };
    }
  } catch { /* ignore */ }

  // JS heap memory (Chrome-only)
  let memoryJsHeapSizeLimit: number | undefined;
  let memoryTotalJsHeapSize: number | undefined;
  let memoryUsedJsHeapSize:  number | undefined;
  try {
    const mem = (performance as Performance & {
      memory?: { jsHeapSizeLimit: number; totalJSHeapSize: number; usedJSHeapSize: number };
    }).memory;
    if (mem) {
      memoryJsHeapSizeLimit = mem.jsHeapSizeLimit;
      memoryTotalJsHeapSize = mem.totalJSHeapSize;
      memoryUsedJsHeapSize  = mem.usedJSHeapSize;
    }
  } catch { /* ignore */ }

  const prefersColorScheme   = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const prefersReducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  const localStorageAvailable = (() => {
    try { localStorage.setItem("_sc", "1"); localStorage.removeItem("_sc"); return true; } catch { return false; }
  })();
  const sessionStorageAvailable = (() => {
    try { sessionStorage.setItem("_sc", "1"); sessionStorage.removeItem("_sc"); return true; } catch { return false; }
  })();

  return {
    sessionId,
    userId:                  userId ?? null,
    event,
    timestamp:               Date.now(),
    userAgent:               navigator.userAgent    || undefined,
    platform:                navigator.platform     || undefined,
    language:                navigator.language     || undefined,
    languages:               Array.from(navigator.languages ?? []),
    vendor:                  navigator.vendor       || undefined,
    hardwareConcurrency:     navigator.hardwareConcurrency,
    deviceMemory:            nav["deviceMemory"] as number | undefined,
    maxTouchPoints:          navigator.maxTouchPoints,
    cookieEnabled:           navigator.cookieEnabled,
    doNotTrack:              navigator.doNotTrack,
    onLine:                  navigator.onLine,
    screenWidth:             screen.width,
    screenHeight:            screen.height,
    colorDepth:              screen.colorDepth,
    pixelDepth:              screen.pixelDepth,
    devicePixelRatio:        window.devicePixelRatio,
    viewportWidth:           window.innerWidth,
    viewportHeight:          window.innerHeight,
    orientation:             screen.orientation?.type,
    connectionType:          conn?.["effectiveType"] as string  | undefined,
    connectionDownlink:      conn?.["downlink"]      as number  | undefined,
    connectionRtt:           conn?.["rtt"]           as number  | undefined,
    connectionSaveData:      conn?.["saveData"]      as boolean | undefined,
    timezone:                Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset:          new Date().getTimezoneOffset(),
    prefersColorScheme,
    prefersReducedMotion,
    navigationTiming,
    memoryJsHeapSizeLimit,
    memoryTotalJsHeapSize,
    memoryUsedJsHeapSize,
    gpuRenderer,
    gpuVendor,
    webglVersion,
    audioContextSampleRate,
    batteryLevel,
    batteryCharging,
    localStorageAvailable,
    sessionStorageAvailable,
    referrer:        document.referrer || undefined,
    href:            window.location.href,
    historyLength:   window.history.length,
    screenLeft:      window.screenLeft,
    screenTop:       window.screenTop,
    pluginCount:     navigator.plugins.length,
    characterSet:    document.characterSet,
  };
}

// ─── Google icon ──────────────────────────────────────────────────────────────

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" style={{ flexShrink: 0 }}>
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

interface SummerHeadProps {
  expanded:   boolean;
  onExpanded: () => void;
  user:       User | null;
}

export default function SummerHead({ expanded, onExpanded, user }: SummerHeadProps) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [authBusy,  setAuthBusy]  = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [mounted,   setMounted]   = useState(false);

  // Portal needs the DOM to be ready
  useEffect(() => { setMounted(true); }, []);
  // Close panel when going back to expanded
  useEffect(() => { if (expanded) setPanelOpen(false); }, [expanded]);

  const hasGoogle = user?.providerData.some((p) => p.providerId === "google.com") ?? false;

  // ── First tap: unlock iOS audio + collect full device snapshot ────────────
  const handleFirstTap = useCallback(async () => {
    try {
      const ac = new AudioContext();
      await ac.resume();
    } catch { /* ignore */ }

    const sessionId = localStorage.getItem("rc_anon_session_id") ?? "unknown";
    collectDeviceSnapshot(sessionId, user?.uid ?? null, "summer_first_tap")
      .then((payload) => saveSummerCache(payload))
      .catch(() => { /* non-fatal */ });

    onExpanded();
  }, [onExpanded, user?.uid]);

  // ── Compact tap: toggle panel ─────────────────────────────────────────────
  const handleCompactTap = useCallback(() => {
    setAuthError(null);
    setPanelOpen((o) => !o);
  }, []);

  // ── Google sign-in (no user) ──────────────────────────────────────────────
  const handleSignInGoogle = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      setPanelOpen(false);
    } catch (err) {
      setAuthError("Google sign-in failed. Try again.");
      console.error(err);
    } finally {
      setAuthBusy(false);
    }
  };

  // ── Link Google (phone-only user) ─────────────────────────────────────────
  const handleLinkGoogle = async () => {
    if (!auth.currentUser) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      await linkWithPopup(auth.currentUser, new GoogleAuthProvider());
      setPanelOpen(false);
    } catch (err) {
      setAuthError("Couldn't link Google. Already used?");
      console.error(err);
    } finally {
      setAuthBusy(false);
    }
  };

  // ── Panel left-cell content ───────────────────────────────────────────────
  const renderPanelCard = () => {
    if (!user) {
      return (
        <>
          <p className={styles.panelHint}>Sign in to save your progress across devices.</p>
          {authError && <p className={styles.panelError}>{authError}</p>}
          <button
            className={styles.panelGoogleBtn}
            onClick={handleSignInGoogle}
            disabled={authBusy}
          >
            <GoogleIcon />
            <span>{authBusy ? "Opening…" : "Sign in with Google"}</span>
          </button>
        </>
      );
    }

    if (!hasGoogle) {
      return (
        <>
          <p className={styles.panelHint}>Link Google to access your story from any device.</p>
          {authError && <p className={styles.panelError}>{authError}</p>}
          <button
            className={styles.panelGoogleBtn}
            onClick={handleLinkGoogle}
            disabled={authBusy}
          >
            <GoogleIcon />
            <span>{authBusy ? "Opening…" : "Link Google"}</span>
          </button>
        </>
      );
    }

    // Google-linked profile
    return (
      <div className={styles.profileInner}>
        {user.photoURL && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt={user.displayName ?? "Profile"}
            className={styles.profilePhoto}
            referrerPolicy="no-referrer"
          />
        )}
        <div className={styles.profileText}>
          <span className={styles.profileName}>{user.displayName ?? "Hello!"}</span>
          <span className={styles.profileBadge}>Google linked ✓</span>
        </div>
      </div>
    );
  };

  const content = (
    <>
      {/* ── Animated morphing wrapper ─────────────────────────────────────── */}
      <div
        className={`${styles.wrapper} ${expanded ? styles.wrapperExpanded : styles.wrapperCompact}`}
      >
        <button
          className={styles.button}
          onClick={expanded ? handleFirstTap : handleCompactTap}
          aria-label={expanded ? "Start Summer" : "Summer options"}
        >
          {/* Dark backdrop so ring pops against the light WebGL bg */}
          {expanded && <div className={styles.ringBackdrop} />}
          {/* active=false keeps the idle radar sweep visible (sweep lives in 1-uActivity) */}
          <SummerRing active={false} size={200} />
          {/* Inline glyph — no file dependency */}
          <div className={`${styles.favicon} ${expanded ? styles.faviconExpanded : styles.faviconCompact}`}>
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg"
              style={{ width: "100%", height: "100%" }}>
              <text
                x="50%" y="54%"
                dominantBaseline="middle" textAnchor="middle"
                fontFamily="-apple-system, BlinkMacSystemFont, SF Pro Display, Helvetica, Arial"
                fontWeight="700"
                fontSize="22"
                fill="rgba(255,255,255,0.92)"
              >S</text>
            </svg>
          </div>
        </button>

        {/* Labels — rendered only when expanded, overflow visible below ring */}
        {expanded && (
          <div className={styles.labels}>
            <p className={styles.labelName}>SUMMER</p>
            <p className={styles.labelTag}>Tap to begin</p>
          </div>
        )}
      </div>

      {/* ── Pop-under panel (compact + open) ─────────────────────────────── */}
      {!expanded && panelOpen && (
        <div className={styles.panel}>
          <div className={styles.panelCard}>
            {renderPanelCard()}
          </div>
          <button
            className={styles.panelClose}
            onClick={() => setPanelOpen(false)}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  );

  // Render as a portal so position:fixed isn't clipped by StoryInterface's
  // overflow:hidden root div
  if (!mounted) return null;
  return createPortal(content, document.body);
}
