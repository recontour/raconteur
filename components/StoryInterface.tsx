"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/helper/auth";
import { useAuthFlow, type AuthStep } from "@/hooks/useAuthFlow";
import { getWelcomeText } from "@/app/actions/user";
import styles from "./StoryInterface.module.css";

// ─── Story meta ───────────────────────────────────────────────────────────────

const STORY_META = {
  id:       "omelas",
  title:    "The Ones Who Walk Away from Omelas",
  author:   "Ursula K. Le Guin",
  chapters: 12,
} as const;

// ─── Static scene definitions ─────────────────────────────────────────────────

type SceneId = "welcome" | "entertainment" | "news" | "whatsup" | "story";

interface SceneOption { label: string; next: SceneId; }
interface SceneDef    { hero: string; subtext?: string; options: SceneOption[]; }

const SCENES: Record<SceneId, SceneDef> = {
  welcome: {
    hero: "Welcome to Raconteur",
    options: [
      { label: "Entertainment",               next: "entertainment" },
      { label: "News",                        next: "news"          },
      { label: "What's Up?",                  next: "whatsup"       },
      { label: "I want to listen to a story", next: "story"         },
    ],
  },
  entertainment: {
    hero: "Entertainment",
    subtext: "More coming soon.",
    options: [{ label: "← Back", next: "welcome" }],
  },
  news: {
    hero: "News",
    subtext: "More coming soon.",
    options: [{ label: "← Back", next: "welcome" }],
  },
  whatsup: {
    hero: "What's Up?",
    options: [
      { label: "Tech",   next: "entertainment" },
      { label: "Sports", next: "entertainment" },
      { label: "Music",  next: "entertainment" },
      { label: "Movies", next: "entertainment" },
      { label: "Travel", next: "entertainment" },
      { label: "Food",   next: "entertainment" },
    ],
  },
  story: { hero: "", options: [] }, // rendered separately
};

// ─── Digit input row ──────────────────────────────────────────────────────────

function DigitInputRow({
  count,
  value,
  onChange,
  autoFocus,
  cols,
}: {
  count: number;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  cols?: number;
}) {
  const refs   = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: count }, (_, i) => value[i] ?? "");
  const isGrid = !!cols;

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const ch      = e.target.value.replace(/\D/g, "").slice(-1);
    const updated = [...digits];
    updated[i]    = ch;
    onChange(updated.join(""));
    if (ch && i < count - 1) refs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      const updated = [...digits];
      updated[i - 1] = "";
      onChange(updated.join(""));
      refs.current[i - 1]?.focus();
    }
  };

  const handleFocus = (el: HTMLInputElement | null) => {
    el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className={isGrid ? styles.digitGrid : styles.digitRow}>
      {Array.from({ length: count }, (_, i) => (
        <input
          key={i}
          ref={(el) => { refs.current[i] = el; }}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digits[i]}
          autoFocus={autoFocus && i === 0}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onFocus={() => handleFocus(refs.current[i])}
          className={isGrid ? styles.digitBoxLg : styles.digitBox}
        />
      ))}
    </div>
  );
}

// ─── WebGL background ─────────────────────────────────────────────────────────

const BG_FRAG = `
  precision mediump float;
  uniform vec2  uRes;
  uniform float uTime;
  float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=0.5;
    for(int i=0;i<3;i++){v+=a*n(p);p=p*2.1+vec2(1.3,0.7);a*=0.5;}
    return v;
  }
  void main(){
    vec2  uv = gl_FragCoord.xy / uRes;
    float t  = uTime * 0.030;
    vec2  p  = uv * 2.6;
    float n1 = fbm(p + vec2(t,         t * 0.60));
    float n2 = fbm(p + vec2(-t * 0.45, t * 0.33) + n1 * 0.40);
    float n3 = fbm(p + n2 * 0.58);
    vec3 base = vec3(0.983, 0.981, 0.975);
    vec3 warm = vec3(0.971, 0.967, 0.954);
    vec3 col  = base;
    col = mix(col, warm, n1 * 0.28);
    col = mix(col, warm, n2 * 0.18);
    col = mix(col, warm, n3 * 0.12);
    float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 0.08;
    col *= vig;
    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

function setupBg(el: HTMLDivElement): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
  renderer.setSize(el.clientWidth, el.clientHeight);
  const cvs = renderer.domElement;
  cvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  el.appendChild(cvs);

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat    = new THREE.ShaderMaterial({
    vertexShader:   "void main(){gl_Position=vec4(position,1.0);}",
    fragmentShader: BG_FRAG,
    uniforms: {
      uRes:  { value: new THREE.Vector2(el.clientWidth, el.clientHeight) },
      uTime: { value: 0 },
    },
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const onResize = () => {
    renderer.setSize(el.clientWidth, el.clientHeight);
    mat.uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  };
  window.addEventListener("resize", onResize);

  let raf = 0, paused = false;
  const onVis = () => { paused = document.hidden; };
  document.addEventListener("visibilitychange", onVis);

  (function tick() {
    if (!paused) {
      mat.uniforms.uTime.value = performance.now() * 0.001;
      renderer.render(scene, camera);
    }
    raf = requestAnimationFrame(tick);
  })();

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
    renderer.dispose();
    cvs.remove();
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoryInterface() {
  const bgRef  = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [sceneId,        setSceneId]        = useState<SceneId>("welcome");
  const [exiting,        setExiting]        = useState(false);
  const [sceneKey,       setSceneKey]       = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [welcomeText,    setWelcomeText]    = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("rc_welcome_text") || "What would you like to do today?";
    }
    return "What would you like to do today?";
  });

  const { user } = useAuth();
  const authFlow = useAuthFlow(() => { router.push("/book"); });

  // Animate when auth step advances internally (OTP sent, verified, etc.)
  const prevAuthStep = useRef<AuthStep>(null);
  useEffect(() => {
    const curr = authFlow.authStep;
    const prev = prevAuthStep.current;
    if (prev !== null && curr !== null && curr !== prev) {
      setSceneKey((k) => k + 1);
    }
    prevAuthStep.current = curr;
  }, [authFlow.authStep]);

  useEffect(() => {
    getWelcomeText().then((text) => {
      setWelcomeText(text);
      localStorage.setItem("rc_welcome_text", text);
    }).catch(() => { /* non-fatal */ });
  }, []);

  useEffect(() => {
    if (!bgRef.current) return;
    return setupBg(bgRef.current);
  }, []);

  // Shrink root height with virtual keyboard so inputs stay visible
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      document.documentElement.style.setProperty(
        "--vp-h",
        `${Math.round(vv.height)}px`,
      );
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  // Reset options on every scene transition
  useEffect(() => {
    setUserMenuOpen(false);
  }, [sceneKey]);

  // ── Navigation ────────────────────────────────────────────────────────────

  const transition = useCallback((action: () => void) => {
    setExiting(true);
    setTimeout(() => {
      action();
      setSceneKey((k) => k + 1);
      setExiting(false);
    }, 280);
  }, []);

  const navigate = useCallback(
    (next: SceneId) => transition(() => setSceneId(next)),
    [transition],
  );

  const exitAuth = useCallback(() => {
    transition(() => { authFlow.setAuthStep(null); });
  }, [transition, authFlow]);

  const handleBookSelect = useCallback(() => {
    if (auth.currentUser) {
      router.push("/book");
      return;
    }
    transition(() => { authFlow.setAuthStep("phone-entry"); });
  }, [router, transition, authFlow]);

  // ── User pill ─────────────────────────────────────────────────────────────

  const renderUserPill = () => {
    if (!user) return null;
    const rawFirst = user.displayName?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";
    const firstName = rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1);
    const initials  = user.displayName
      ? user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()
      : firstName[0]?.toUpperCase() ?? "U";
    return (
      <>
        <button
          className={`${styles.userPill} ${userMenuOpen ? styles.userPillOpen : ""}`}
          onClick={() => setUserMenuOpen((o) => !o)}
          aria-expanded={userMenuOpen}
        >
          <div className={styles.userPillAvatar}>
            {user.photoURL ? (
              <Image
                src={user.photoURL}
                alt={firstName}
                width={28}
                height={28}
                style={{ objectFit: "cover", borderRadius: "50%", display: "block" }}
                referrerPolicy="no-referrer"
              />
            ) : (
              initials
            )}
          </div>
          <span className={styles.userPillName}>Hi {firstName}</span>
        </button>
        {userMenuOpen && (
          <div
            className={styles.optSingle}
            style={{ "--delay": "40ms" } as React.CSSProperties}
          >
            <button
              className={`${styles.optBoxWide} ${styles.optBoxGhost}`}
              onClick={() => { signOut(auth); setUserMenuOpen(false); }}
            >
              <span className={styles.optLabel}>Sign out</span>
            </button>
          </div>
        )}
      </>
    );
  };

  // ── Scene renderers ───────────────────────────────────────────────────────

  const renderStaticScene = (def: SceneDef) => {
    const isSingle = def.options.length === 1;
    const heroText = def.hero === "Welcome to Raconteur" ? welcomeText : def.hero;
    return (
      <>
        <div className={styles.heroBubble}>
          <div className={styles.bubbleInner}>
            <img src="/favicon.ico" alt="" className={styles.heroLogo} />
            <p className={styles.heroText}>{heroText}</p>
            {def.subtext && <p className={styles.subText}>{def.subtext}</p>}
          </div>
        </div>

        <div className={styles.optionsBubble}>
          {isSingle ? (
            <button
              className={styles.optBoxWide}
              onClick={() => navigate(def.options[0].next)}
              disabled={exiting}
            >
              <span className={styles.optLabel}>{def.options[0].label}</span>
            </button>
          ) : (
            <div className={styles.optGrid2}>
              {def.options.map((opt, i) => (
                <button
                  key={opt.label}
                  className={styles.optBox}
                  style={{ "--delay": `${i * 50 + 50}ms` } as React.CSSProperties}
                  onClick={() => navigate(opt.next)}
                  disabled={exiting}
                >
                  <span className={styles.optLabel}>{opt.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </>
    );
  };

  const renderStoryScene = () => (
    <>
      <div className={styles.heroBubble}>
        <div className={styles.bubbleInner}>
          <img src="/favicon.ico" alt="" className={styles.heroLogo} />
          <p className={styles.heroText}>Choose your story</p>
          <button
            className={styles.bookItem}
            onClick={handleBookSelect}
            disabled={exiting}
            style={{ "--delay": "50ms", marginTop: "1.25rem" } as React.CSSProperties}
          >
            <span className={styles.bookTitle}>{STORY_META.title}</span>
            <span className={styles.bookMeta}>
              {STORY_META.author} · {STORY_META.chapters} chapters
            </span>
          </button>
        </div>
      </div>

      <div className={styles.optionsBubble}>
        <button
          className={`${styles.optBoxWide} ${styles.optBoxGhost}`}
          onClick={() => navigate("welcome")}
          disabled={exiting}
          style={{ "--delay": "120ms" } as React.CSSProperties}
        >
          <span className={styles.optLabel}>← Back</span>
        </button>
      </div>
    </>
  );

  const renderAuth = (step: AuthStep) => {
    if (step === "entering") {
      return (
        <div className={styles.heroBubble}>
          <div className={styles.bubbleInner}>
            <p className={styles.heroText}>Welcome!</p>
            <p className={styles.subText}>Taking you to your story…</p>
          </div>
        </div>
      );
    }

    if (step === "phone-entry") {
      return (
        <>
          <div className={styles.heroBubble}>
            <div className={styles.bubbleInner}>
              <p className={styles.heroText}>What's your number?</p>
              <p className={styles.subText}>We'll send a one-time code via SMS</p>
              <DigitInputRow
                count={10}
                cols={5}
                value={authFlow.phoneInput}
                onChange={authFlow.setPhoneInput}
                autoFocus
              />
              {authFlow.authError && (
                <p className={styles.authError}>{authFlow.authError}</p>
              )}
            </div>
          </div>
          <div className={styles.optSingle}>
            <button
              className={styles.optBoxWide}
              onClick={authFlow.handleSendOTP}
              disabled={authFlow.phoneInput.length !== 10 || authFlow.authBusy}
            >
              <span className={styles.optLabel}>
                {authFlow.authBusy ? "Sending…" : "Send OTP"}
              </span>
            </button>
          </div>
          <div className={styles.optSingle}>
            <button
              className={`${styles.optBoxWide} ${styles.optBoxGhost}`}
              onClick={exitAuth}
              disabled={authFlow.authBusy}
            >
              <span className={styles.optLabel}>← Back</span>
            </button>
          </div>
        </>
      );
    }

    if (step === "phone-otp") {
      return (
        <>
          <div className={styles.heroBubble}>
            <div className={styles.bubbleInner}>
              <p className={styles.heroText}>Enter the code</p>
              <p className={styles.subText}>Sent to {authFlow.phoneInput}</p>
              <DigitInputRow
                count={6}
                value={authFlow.otpInput}
                onChange={authFlow.setOtpInput}
                autoFocus
              />
              {authFlow.authError && (
                <p className={styles.authError}>{authFlow.authError}</p>
              )}
            </div>
          </div>
          <div className={styles.optSingle}>
            <button
              className={styles.optBoxWide}
              onClick={authFlow.handleVerifyOTP}
              disabled={authFlow.otpInput.length !== 6 || authFlow.authBusy}
            >
              <span className={styles.optLabel}>
                {authFlow.authBusy ? "Verifying…" : "Verify"}
              </span>
            </button>
          </div>
          <div className={styles.optSingle}>
            <button
              className={`${styles.optBoxWide} ${styles.optBoxGhost}`}
              onClick={() => authFlow.setAuthStep("phone-entry")}
              disabled={authFlow.authBusy}
            >
              <span className={styles.optLabel}>← Back</span>
            </button>
          </div>
        </>
      );
    }

    if (step === "profile-name") {
      return (
        <>
          <div className={styles.heroBubble}>
            <div className={styles.bubbleInner}>
              <p className={styles.heroText}>What should we call you?</p>
              <input
                type="text"
                className={styles.authInput}
                placeholder="Your name"
                value={authFlow.nameInput}
                onChange={(e) => authFlow.setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") authFlow.handleSaveName();
                }}
                autoFocus
              />
              {authFlow.authError && (
                <p className={styles.authError}>{authFlow.authError}</p>
              )}
            </div>
          </div>
          <div className={styles.optGrid2}>
            <button
              className={`${styles.optBox} ${styles.optBoxGhost}`}
              style={{ "--delay": "50ms" } as React.CSSProperties}
              onClick={exitAuth}
              disabled={authFlow.authBusy}
            >
              <span className={styles.optLabel}>← Back</span>
            </button>
            <button
              className={styles.optBox}
              style={{ "--delay": "100ms" } as React.CSSProperties}
              onClick={authFlow.handleSaveName}
              disabled={authFlow.nameInput.trim().length < 2 || authFlow.authBusy}
            >
              <span className={styles.optLabel}>
                {authFlow.authBusy ? "Saving…" : "Register"}
              </span>
            </button>
          </div>
        </>
      );
    }

    if (step === "link-google") {
      return (
        <>
          <div className={styles.heroBubble}>
            <div className={styles.bubbleInner}>
              <p className={styles.heroText}>Add Google?</p>
              <p className={styles.subText}>
                Link your Google account to sign in from any device and keep your
                progress safe.
              </p>
              {authFlow.authError && (
                <p className={styles.authError}>{authFlow.authError}</p>
              )}
            </div>
          </div>
          <div className={styles.optGrid2}>
            <button
              className={`${styles.optBox} ${styles.optBoxGhost}`}
              style={{ "--delay": "50ms" } as React.CSSProperties}
              onClick={exitAuth}
              disabled={authFlow.authBusy}
            >
              <span className={styles.optLabel}>← Back</span>
            </button>
            <button
              className={styles.optBox}
              style={{ "--delay": "100ms" } as React.CSSProperties}
              onClick={authFlow.handleLinkGoogle}
              disabled={authFlow.authBusy}
            >
              <span className={styles.optLabel}>
                {authFlow.authBusy ? "Opening…" : "Link Google"}
              </span>
            </button>
          </div>
          <div className={styles.optSingle}>
            <button
              className={`${styles.optBoxWide} ${styles.optBoxGhost}`}
              onClick={authFlow.finalizeAuth}
              disabled={authFlow.authBusy}
            >
              <span className={styles.optLabel}>Skip for now</span>
            </button>
          </div>
        </>
      );
    }

    return null;
  };

  const renderContent = () => {
    if (authFlow.authStep !== null) return renderAuth(authFlow.authStep);
    if (sceneId === "story")        return renderStoryScene();
    return renderStaticScene(SCENES[sceneId]);
  };

  return (
    <div className={styles.root}>
      <div ref={bgRef} className={styles.bg} />

      <div
        key={sceneKey}
        className={`${styles.scene} ${exiting ? styles.sceneExit : ""}`}
      >
        <div className={styles.layout}>
          {renderUserPill()}
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
