"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/app/helper/auth";
import { writeRagData } from "@/components/RAGdata";
import { useAuthFlow, type AuthStep } from "@/hooks/useAuthFlow";
import { getWelcomeText } from "@/app/actions/user";
import BookReader from "./BookReader";
import storyData from "@/data/entireStory.json";
import styles from "./StoryInterface.module.css";
import SummerRing from "./SummerRing";

// ─── Message type ────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  text: string;
  timestamp: number;
  role: "bot" | "user";
}

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

  // Hashing & Noise functions
  float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float n(vec2 p){
    vec2 i=floor(p),f=fract(p),u=f*f*(3.0-2.0*f);
    return mix(mix(h(i),h(i+vec2(1,0)),u.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),u.x),u.y);
  }
  float fbm(vec2 p){
    float v=0.0,a=0.5;
    for(int i=0;i<4;i++){v+=a*n(p);p=p*2.1+vec2(1.3,0.7);a*=0.5;}
    return v;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    
    // Very slow progression
    float t = uTime * 0.008;
    
    // Soft flowing wave landscape
    vec2 p = uv * 2.5;
    p.y += t * 2.0; 
    p.x += t * 1.5;
    
    float wave = fbm(p + vec2(fbm(p + t)));
    
    // Radial gradient: light gray on the outside, dark gray wave in the middle
    float dist = distance(uv, vec2(0.5, 0.5));
    
    // Center dark gray wave color
    vec3 centerGray = vec3(0.40, 0.40, 0.40) - (wave * 0.15);
    // Outer light gray
    vec3 edgeWhite = vec3(0.85, 0.85, 0.85);
    
    // Smooth transition from center to edges
    float mixFactor = smoothstep(0.0, 0.7, dist);
    vec3 col = mix(centerGray, edgeWhite, mixFactor);
    
    gl_FragColor = vec4(col, 1.0);
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

// ─── SummerRing is imported from ./SummerRing ────────────────────────────────

// ─── Component ────────────────────────────────────────────────────────────────

export default function StoryInterface() {
  const bgRef  = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const [sceneId,        setSceneId]        = useState<SceneId>("welcome");
  const [exiting,        setExiting]        = useState(false);
  const [sceneKey,       setSceneKey]       = useState(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [bookSelected,   setBookSelected]   = useState(false);
  const [messages,       setMessages]       = useState<ChatMessage[]>([]);
  const [welcomeText,    setWelcomeText]    = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("rc_welcome_v2") || "Welcome.. my name is Summer. How can I help you today?";
    }
    return "Welcome.. my name is Summer. How can I help you today?";
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
    // Generate an anon session ID if not exists, persist in localStorage so it
    // survives tab/browser closes and works across reloads on the same device.
    let id = localStorage.getItem("rc_anon_session_id");
    if (!id) {
      id = "session_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("rc_anon_session_id", id);
      // New visitor — increment the global unique-visitor counter
      import("@/app/actions/story").then(({ recordVisit }) => recordVisit(id!)).catch(() => {});
    } else {
      // Return visitor — append this visit timestamp to seenAt array
      import("@/app/actions/story").then(({ recordPageView }) => recordPageView(id!)).catch(() => {});
    }
  }, []);

  const saveMessageToAnonSession = async (text: string) => {
    const id = localStorage.getItem("rc_anon_session_id");
    if (!id) return;
    try {
      const { saveAnonMessage } = await import("@/app/actions/story");
      await saveAnonMessage(id, text);
    } catch (e) {
      console.error(e);
    }
  };

  // Save message to Firebase sessions collection
  const saveMessageToFirebase = useCallback(async (text: string) => {
    if (!user?.uid) {
      saveMessageToAnonSession(text);
      return;
    }
    try {
      await addDoc(collection(db, `sessions/${user.uid}/messages`), {
        text,
        timestamp: serverTimestamp(),
        sceneId,
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  }, [user?.uid, sceneId]);

  useEffect(() => {
    getWelcomeText().then((text) => {
      setWelcomeText(text);
      localStorage.setItem("rc_welcome_v2", text);
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

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Reset options on every scene transition
  useEffect(() => {
    setUserMenuOpen(false);
    // Clear messages when transitioning between scenes
    setMessages([]);
    // Reset scroll position to ensure new scenes start at the top and clear keyboard offsets
    window.scrollTo(0, 0);
  }, [sceneKey]);

  const [inputVal, setInputVal] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isChatActive, setIsChatActive] = useState(false);
  const [fontSize, setFontSize] = useState("0.95rem");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("rc_font_size");
      if (saved) {
        setFontSize(saved);
      }
    }
  }, []);

  const handleFontSelect = (size: string) => {
    setFontSize(size);
    localStorage.setItem("rc_font_size", size);
  };

  // ── Navigation ────────────────────────────────────────────────────────────

  const transition = useCallback((action: () => void) => {
    setExiting(true);
    setTimeout(() => {
      action();
      setSceneKey((k) => k + 1);
      setExiting(false);
    }, 280);
  }, []);

  const addMessage = useCallback((text: string, role: "bot" | "user" = "bot") => {
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      timestamp: Date.now(),
      role,
    };
    setMessages((prev) => [...prev, newMessage]);
    saveMessageToFirebase(text);
  }, [saveMessageToFirebase]);

  const navigate = useCallback(
    (next: SceneId) => {
      const scene = SCENES[next];
      if (scene && scene.hero) {
        addMessage(scene.hero);
      }
      transition(() => setSceneId(next));
    },
    [transition, addMessage],
  );

  // Add first message on scene load
  useEffect(() => {
    const scene = SCENES[sceneId];
    if (messages.length === 0 && scene && scene.hero) {
      const heroText = scene.hero === "Welcome to Raconteur" ? welcomeText : scene.hero;
      addMessage(heroText);
    }
  }, [sceneId, messages.length, welcomeText, addMessage]);

  const exitAuth = useCallback(() => {
    transition(() => { authFlow.setAuthStep(null); });
  }, [transition, authFlow]);

  const handleSendAiMessage = async () => {
    if (!inputVal.trim() || isAiLoading) return;
    const userMsg = inputVal;
    setInputVal("");
    addMessage(userMsg, "user");
    
    setIsAiLoading(true);
    try {
      const { generateStoryResponse } = await import("@/app/actions/story");
      const result = await generateStoryResponse(userMsg);
      if (result.success && result.text) {
        addMessage(result.text, "bot");
      } else {
        addMessage("I'm sorry, I'm having a bit of trouble processing that right now.", "bot");
      }
    } catch (e) {
      console.error(e);
      addMessage("It seems my story engine hit a snag. Let's try again?", "bot");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleBookSelect = useCallback(() => {
    router.push("/book");
  }, [router]);

  const handleCloseReader = useCallback(() => {
    setBookSelected(false);
  }, []);

  // ── User pill ─────────────────────────────────────────────────────────────

  const renderUserPill = () => {
    if (!user) {
      return null;
    }
    
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

  const renderMessageIcon = (role: "bot" | "user") => {
    if (role === "bot") {
      return (
        <div className={styles.botIconWrapper}>
          <SummerRing active={isAiLoading} size={28} />
          <img src="/favicon.ico" alt="Summer" className={styles.summerFaviconMini} />
        </div>
      );
    }
    if (user?.photoURL) {
      return (
        <img
          src={user.photoURL}
          alt={user.displayName || "User"}
          className={styles.messageFaviconInner}
          style={{ objectFit: "cover" }}
          referrerPolicy="no-referrer"
        />
      );
    }
    return (
      <div className={styles.userFaviconInner}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      </div>
    );
  };

  const renderStaticScene = (def: SceneDef) => {
    const isSingle = def.options.length === 1;
    const heroText = def.hero === "Welcome to Raconteur" ? welcomeText : def.hero;

    return (
      <>
        <div className={styles.heroBubble}>
          <div className={`${styles.bubbleInner} ${sceneId === "welcome" ? styles.bubbleInnerWelcome : ""}`}>
            {sceneId === "welcome" && (
              <div className={styles.summerHeroSection}>
                <div className={styles.summerRingWrapper}>
                  <SummerRing active={true} size={160} />
                  <img src="/favicon.ico" alt="Summer" className={styles.summerFaviconCenter} />
                </div>
                <p className={styles.summerName}>SUMMER</p>
                <p className={styles.summerTagline}>Your AI storytelling companion</p>
              </div>
            )}
            <div className={`${styles.messagesContainer} ${sceneId === "welcome" ? styles.messagesScrollArea : ""}`}>
              {messages.map((msg) => (
                <div key={msg.id} className={`${styles.messageRow} ${msg.role === "user" ? styles.messageRowUser : ""}`}>
                  <div className={`${styles.messageBubble} ${msg.role === "user" ? styles.userBubble : styles.botBubble}`}>
                    <div className={styles.messageContent}>
                      {renderMessageIcon(msg.role)}
                      <p className={styles.messageText} style={{ fontSize: fontSize }}>{msg.text}</p>
                    </div>
                  </div>
                </div>
              ))}
              {isAiLoading && (
                <div className={styles.messageRow}>
                  <div className={`${styles.messageBubble} ${styles.botBubble}`}>
                    <div className={styles.messageContent}>
                      {renderMessageIcon("bot")}
                      <div className={styles.typingIndicator} style={{ alignSelf: 'center' }}>
                        <span></span><span></span><span></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

          {isChatActive && (
            <div className={styles.chatInputContainer}>
                <input 
                  type="text" 
                  className={styles.chatInput} 
                  placeholder="Type your message..."
                  value={inputVal}
                  onChange={(e) => setInputVal(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSendAiMessage()}
                  disabled={isAiLoading}
                />
                <button 
                  className={styles.sendButton} 
                  onClick={handleSendAiMessage}
                  disabled={isAiLoading || !inputVal.trim()}
                >
                  Send
                </button>
            </div>
          )}

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

            <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
              <p className={styles.subText} style={{ textAlign: "center", marginTop: 0, marginBottom: "0.5rem" }}>Text Size</p>
              <div className={styles.optGrid2} style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
                {[
                  { label: "Aa", size: "0.80rem" },
                  { label: "Aa", size: "0.95rem" },
                  { label: "Aa", size: "1.10rem" },
                  { label: "Aa", size: "1.25rem" }
                ].map((opt, i) => (
                  <button
                    key={i}
                    className={styles.optBox}
                    style={{ 
                      padding: "0.5rem", 
                      fontSize: opt.size,
                      background: fontSize === opt.size ? 'rgba(255,255,255,0.1)' : 'transparent',
                      opacity: fontSize === opt.size ? 1 : 0.6
                    }}
                    onClick={() => handleFontSelect(opt.size)}
                  >
                    <span className={styles.optLabel}>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    };

  const renderStoryScene = () => (
    <>
      <div className={styles.heroBubble}>
        <div className={styles.bubbleInner}>
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
          <p className={styles.subText} style={{ marginTop: "2rem", opacity: 0.55 }}>
            More stories coming soon
          </p>
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

  const renderBookReaderScene = () => {
    // Adapt entireStory paragraphs to BookReader Story format
    const stories = storyData.paragraphs.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      paragraph: p.text,
      mood: p.mood,
      audioFile: p.audio,
      duration: p.duration ?? 0,
      subtitles: [] as Array<{ time: number; text: string }>,
    }));

    return (
      <>
        <div className={styles.bookReaderContainer}>
          <BookReader stories={stories} />
        </div>

        <div className={styles.optionsBubble}>
          <button
            className={`${styles.optBoxWide} ${styles.optBoxGhost}`}
            onClick={handleCloseReader}
            style={{ "--delay": "50ms" } as React.CSSProperties}
          >
            <span className={styles.optLabel}>← Back to Stories</span>
          </button>
        </div>
      </>
    );
  };

  const renderAuth = (step: AuthStep) => {
    if (step === "entering") {
      return (
        <>
          <div className={styles.heroBubble}>
            <div className={styles.bubbleInner}>
              <p className={styles.heroText}>Welcome!</p>
              <p className={styles.subText}>Taking you to your story…</p>
            </div>
          </div>
          <div className={styles.optionsBubble} />
        </>
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
          <div className={styles.optionsBubble}>
            <button
              className={styles.optBoxWide}
              onClick={() => transition(authFlow.handleSendOTP)}
              disabled={authFlow.phoneInput.length !== 10 || authFlow.authBusy}
            >
              <span className={styles.optLabel}>
                {authFlow.authBusy ? "Sending…" : "Send OTP"}
              </span>
            </button>
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
          <div className={styles.optionsBubble}>
            <button
              className={styles.optBoxWide}
              onClick={() => transition(authFlow.handleVerifyOTP)}
              disabled={authFlow.otpInput.length !== 6 || authFlow.authBusy}
            >
              <span className={styles.optLabel}>
                {authFlow.authBusy ? "Verifying…" : "Verify"}
              </span>
            </button>
            <button
              className={`${styles.optBoxWide} ${styles.optBoxGhost}`}
              onClick={() => transition(() => authFlow.setAuthStep("phone-entry"))}
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
                  if (e.key === "Enter") transition(authFlow.handleSaveName);
                }}
                autoFocus
              />
              {authFlow.authError && (
                <p className={styles.authError}>{authFlow.authError}</p>
              )}
            </div>
          </div>
          <div className={styles.optionsBubble}>
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
                onClick={() => transition(authFlow.handleSaveName)}
                disabled={authFlow.nameInput.trim().length < 2 || authFlow.authBusy}
              >
                <span className={styles.optLabel}>
                  {authFlow.authBusy ? "Saving…" : "Register"}
                </span>
              </button>
            </div>
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
          <div className={styles.optionsBubble}>
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
                onClick={() => transition(authFlow.handleLinkGoogle)}
                disabled={authFlow.authBusy}
              >
                <span className={styles.optLabel}>
                  {authFlow.authBusy ? "Opening…" : "Link Google"}
                </span>
              </button>
            </div>
            <button
              className={`${styles.optBoxWide} ${styles.optBoxGhost}`}
              onClick={() => transition(authFlow.finalizeAuth)}
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
    if (bookSelected) return renderBookReaderScene();
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
