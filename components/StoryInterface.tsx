"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { useRouter } from "next/navigation";
import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/helper/auth";
import { saveUserProfile } from "@/app/actions/user";
import { collectDeviceSnapshot } from "./SummerHead";
import { saveSummerCache } from "@/app/actions/summer";
import {
  recordVisit,
  recordPageView,
  getBootstrapData,
  getScene,
  saveAnonPath,
  generateScene,
} from "@/app/actions/story";
import type { DiaryScene, DiaryOption } from "@/lib/types";
import styles from "./StoryInterface.module.css";
import SummerRing from "./SummerRing";

// --- Admin UIDs (comma-separated in NEXT_PUBLIC_ADMIN_UIDS) -------------------

const ADMIN_UIDS = (process.env.NEXT_PUBLIC_ADMIN_UIDS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// --- WebGL background ---------------------------------------------------------

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
    for(int i=0;i<4;i++){v+=a*n(p);p=p*2.1+vec2(1.3,0.7);a*=0.5;}
    return v;
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uRes;
    float t = uTime * 0.007;
    vec2 p = uv * 2.5;
    p.y += t * 1.8;
    p.x += t * 1.2;
    float wave = fbm(p + vec2(fbm(p + t)));
    float dist = distance(uv, vec2(0.5, 0.5));
    vec3 dark  = vec3(0.04, 0.04, 0.10) + wave * 0.06;
    vec3 edge  = vec3(0.08, 0.08, 0.16);
    float mix_ = smoothstep(0.0, 0.75, dist);
    vec3 col = mix(dark, edge, mix_);
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

// --- Component ----------------------------------------------------------------

export default function StoryInterface() {
  const bgRef        = useRef<HTMLDivElement>(null);
  const audioRef     = useRef<HTMLAudioElement | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs to avoid stale closures in callbacks
  const sceneIdRef   = useRef("welcome");
  const stackRef     = useRef<string[]>([]);
  const pathRef      = useRef<string[]>(["welcome"]);
  const sessionIdRef = useRef("");
  const sceneRef     = useRef<DiaryScene | null>(null);

  const router   = useRouter();
  const { user } = useAuth();
  const isAdmin  = !!user && ADMIN_UIDS.includes(user.uid);

  // Scene state
  const [scene,         setScene]         = useState<DiaryScene | null>(null);
  const [sceneId,       setSceneId]       = useState("welcome");
  const [sceneStack,    setSceneStack]    = useState<string[]>([]);
  const [sceneKey,      setSceneKey]      = useState(0);

  // Audio / typing
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const [ringActive,    setRingActive]    = useState(false);
  const [typedText,     setTypedText]     = useState("");
  const [isTyping,      setIsTyping]      = useState(false);
  const [gridVisible,   setGridVisible]   = useState(false);
  const [audioBusy,     setAudioBusy]     = useState(false);

  // Admin generate
  const [generating,    setGenerating]    = useState(false);
  const [timerMs,       setTimerMs]       = useState(0);

  // Keep refs in sync with state
  useEffect(() => { sceneIdRef.current = sceneId; }, [sceneId]);
  useEffect(() => { stackRef.current = sceneStack; }, [sceneStack]);
  useEffect(() => { sceneRef.current = scene; }, [scene]);

  // ─── Session init ──────────────────────────────────────────────────────────

  useEffect(() => {
    let id = localStorage.getItem("rc_anon_session_id");
    if (!id) {
      id = "session_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("rc_anon_session_id", id);
      recordVisit(id).catch(() => {});
    } else {
      recordPageView(id).catch(() => {});
    }
    sessionIdRef.current = id;
    collectDeviceSnapshot(id, null, "page_load")
      .then((p) => saveSummerCache(p))
      .catch(() => {});
  }, []);

  // ─── Visual Viewport (virtual keyboard fix) ────────────────────────────────

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const sync = () => {
      document.documentElement.style.setProperty("--vp-h", `${Math.round(vv.height)}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => {
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
    };
  }, []);

  // ─── WebGL background ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!bgRef.current) return;
    return setupBg(bgRef.current);
  }, []);

  // ─── Bootstrap: load welcome scene from diary ──────────────────────────────

  const typeTextRef = useRef<(text: string, durationMs: number) => void>(() => {});

  useEffect(() => {
    getBootstrapData()
      .then(({ welcomeScene, diaryVersion }) => {
        setScene(welcomeScene);
        sceneRef.current = welcomeScene;
        // Invalidate localStorage path cache if diary version changed
        const stored = localStorage.getItem("rc_diary_version");
        if (stored !== String(diaryVersion)) {
          localStorage.setItem("rc_diary_version", String(diaryVersion));
          localStorage.removeItem("rc_path_history");
          pathRef.current = ["welcome"];
        } else {
          const saved = localStorage.getItem("rc_path_history");
          if (saved) {
            try {
              const parsed = JSON.parse(saved) as string[];
              if (parsed.length > 0) pathRef.current = parsed;
            } catch { /* ignore */ }
          }
        }
        // Scene loaded — ring button is now active, waiting for click
        audioDoneRef.current = true; // so grid shows after first type if no audio
      })
      .catch(console.error);
  }, []);

  // ─── Cleanup generate timer on unmount ─────────────────────────────────────

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // ─── Typewriter engine ─────────────────────────────────────────────────────

  const typeText = useCallback((text: string, durationMs: number) => {
    setTypedText("");
    setIsTyping(true);
    setGridVisible(false);

    let i = 0;
    const msPerChar = Math.max(18, durationMs / text.length);
    const interval  = setInterval(() => {
      i += 1;
      setTypedText(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, msPerChar);
    return () => clearInterval(interval);
  }, []);

  // Keep typeTextRef in sync so bootstrap effect can call it after mount
  useEffect(() => { typeTextRef.current = typeText; }, [typeText]);

  // Show grid when both typing and audio are done
  const audioDoneRef  = useRef(false);
  const typingDoneRef = useRef(false);

  useEffect(() => {
    if (!isTyping) {
      typingDoneRef.current = true;
      if (audioDoneRef.current) setGridVisible(true);
    }
  }, [isTyping]);

  // ─── Core audio + ring + typewriter engine ────────────────────────────────
  // Used on first load AND on ring tap. Safe to call multiple times — ignores
  // if audio is already playing.

  const playAudioWithType = useCallback((text: string, src: string) => {
    if (audioRef.current) return; // already playing

    setRingActive(true);
    audioDoneRef.current  = false;
    typingDoneRef.current = false;

    const audio = new Audio(src);
    audioRef.current = audio;

    // Wire analyser for ring visualisation
    const wireAnalyser = async () => {
      try {
        const ac  = new AudioContext();
        await ac.resume();
        const source = ac.createMediaElementSource(audio);
        const an     = ac.createAnalyser();
        an.fftSize   = 512;
        source.connect(an);
        an.connect(ac.destination);
        analyserRef.current = an;
      } catch { /* ignore — ring animates without data */ }
    };

    wireAnalyser();

    audio.onloadedmetadata = () => {
      const durMs = audio.duration * 1000 || 8000;
      typeTextRef.current(text, durMs);
    };

    const onDone = () => {
      setRingActive(false);
      audioDoneRef.current = true;
      if (typingDoneRef.current) setGridVisible(true);
      audioRef.current = null;
    };

    audio.onended  = onDone;
    audio.onerror  = () => {
      // Audio failed — type with fixed duration, grid shows after
      typeTextRef.current(text, 7000);
      onDone();
    };

    audio.play().catch(() => {
      // Autoplay blocked — type anyway, ring stays quiet
      typeTextRef.current(text, 7000);
      onDone();
    });
  }, []);

  // ─── Ring click — replay/unlock audio ─────────────────────────────────────

  const handleRingClick = useCallback(async () => {
    if (audioBusy || !sceneRef.current) return;
    if (audioUnlocked) return; // only plays once — ring becomes inert after
    setAudioBusy(true);
    // Unlock AudioContext on first user gesture (required by browsers)
    try { await new AudioContext().resume(); } catch { /* ignore */ }
    setAudioUnlocked(true);

    const WELCOME = "Welcome. My name is Summer. How can I help you today?";
    playAudioWithType(WELCOME, "/audio/Summer001.mp3");

    setAudioBusy(false);
  }, [audioBusy, audioUnlocked, playAudioWithType]);

  // ─── Navigate to a scene ───────────────────────────────────────────────────

  const navigateToScene = useCallback(async (targetSceneId: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setRingActive(false);
    setGridVisible(false);
    setIsTyping(false);
    audioDoneRef.current  = true;
    typingDoneRef.current = false;

    // Push current scene onto back stack
    const newStack = [...stackRef.current, sceneIdRef.current];
    setSceneStack(newStack);
    stackRef.current = newStack;

    setSceneId(targetSceneId);
    sceneIdRef.current = targetSceneId;
    setSceneKey((k) => k + 1);

    try {
      const nextScene = await getScene(targetSceneId);
      setScene(nextScene);
      sceneRef.current = nextScene;
      typeText(nextScene.heroMessage, 600);

      const newPath = [...pathRef.current, targetSceneId];
      pathRef.current = newPath;
      localStorage.setItem("rc_path_history", JSON.stringify(newPath));
      const sid = sessionIdRef.current;
      if (sid) saveAnonPath(sid, newPath).catch(() => {});
    } catch {
      typeText("Coming soon. Check back later.", 600);
    }
  }, [typeText]);

  // ─── Back navigation ───────────────────────────────────────────────────────

  const navigateBack = useCallback(async () => {
    const stack = stackRef.current;
    if (stack.length === 0) return;

    const prev     = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);
    setSceneStack(newStack);
    stackRef.current = newStack;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setRingActive(false);
    setGridVisible(false);
    setIsTyping(false);
    audioDoneRef.current  = true;
    typingDoneRef.current = false;

    setSceneId(prev);
    sceneIdRef.current = prev;
    setSceneKey((k) => k + 1);

    try {
      const prevScene = await getScene(prev);
      setScene(prevScene);
      sceneRef.current = prevScene;
      typeText(prevScene.heroMessage, 600);

      const newPath = pathRef.current.slice(0, -1);
      pathRef.current = newPath;
      localStorage.setItem("rc_path_history", JSON.stringify(newPath));
      const sid = sessionIdRef.current;
      if (sid) saveAnonPath(sid, newPath).catch(() => {});
    } catch {
      typeText("", 300);
    }
  }, [typeText]);

  // ─── Google login ──────────────────────────────────────────────────────────

  const handleLogin = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const u = result.user;
      await saveUserProfile(u.uid, {
        displayName: u.displayName,
        photoURL:    u.photoURL,
        email:       u.email,
      });
    } catch (err) {
      console.error("Google login failed:", err);
    }
  }, []);

  // ─── Admin: Generate for me ────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!user || !isAdmin || generating) return;
    setGenerating(true);
    setTimerMs(0);

    const start = Date.now();
    timerRef.current = setInterval(() => setTimerMs(Date.now() - start), 100);

    const sid = sceneIdRef.current;
    console.log(`[Summer] Calling Gemini for "${sid}"... ${new Date().toISOString()}`);

    const ragContext = JSON.stringify({
      scene: sid,
      heroMessage: sceneRef.current?.heroMessage,
      options: sceneRef.current?.options,
      path: pathRef.current,
    });

    try {
      const result = await generateScene(sid, ragContext, user.uid);
      const elapsed = Date.now() - start;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimerMs(elapsed);

      console.log(`[Summer] Response in ${elapsed}ms | progressId: ${result.progressId}`, result);

      if (result.success && result.scene) {
        setScene(result.scene);
        sceneRef.current = result.scene;
        typeText(result.scene.heroMessage, 600);
        if (result.ps) console.log(`[Summer P.S.]: ${result.ps}`);
      } else {
        console.error(`[Summer] Generate failed:`, result.error);
      }
    } catch (err) {
      const elapsed = Date.now() - start;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setTimerMs(elapsed);
      console.error(`[Summer] Exception after ${elapsed}ms:`, err);
    } finally {
      setGenerating(false);
    }
  }, [user, isAdmin, generating, typeText]);

  // ─── Render an option button ───────────────────────────────────────────────

  const renderOption = useCallback((opt: DiaryOption, i: number) => {
    const delay = { "--delay": `${i * 45}ms` } as React.CSSProperties;

    switch (opt.type) {
      case "navigate":
        return (
          <button key={i} className={styles.optBox} style={delay}
            onClick={() => navigateToScene(opt.nextScene!)}>
            {opt.label}
          </button>
        );

      case "redirect":
        return (
          <button key={i} className={styles.optBox} style={delay}
            onClick={() => router.push(opt.href!)}>
            {opt.label}
          </button>
        );

      case "login":
        if (user) return <div key={i} aria-hidden="true" />;
        return (
          <button key={i} className={styles.optBox} style={delay} onClick={handleLogin}>
            {opt.label}
          </button>
        );

      case "back":
        return (
          <button key={i} className={`${styles.optBox} ${styles.optBoxBack}`} style={delay}
            onClick={navigateBack}>
            {opt.label}
          </button>
        );

      case "coming_soon":
        if (isAdmin) {
          return (
            <button key={i} className={`${styles.optBox} ${styles.optBoxAdmin}`} style={delay}
              onClick={handleGenerate} disabled={generating}>
              {generating ? `${(timerMs / 1000).toFixed(1)}s\u2026` : "Generate \u2736"}
            </button>
          );
        }
        return (
          <button key={i} className={styles.optBox} style={delay} disabled>
            {opt.label}
          </button>
        );

      default:
        return <div key={i} aria-hidden="true" />;
    }
  }, [user, isAdmin, generating, timerMs, navigateToScene, navigateBack, handleLogin, handleGenerate, router]);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={styles.root}>
      <div className={styles.container}>
        {/* Ring - tap to start */}
        <div className={styles.ringSection}>
          <button
            className={styles.ringButton}
            onClick={handleRingClick}
            disabled={!scene || audioUnlocked}
            aria-label="Tap to start"
          >
            <span style={{ position: "relative", zIndex: 1, display: "block", width: "100%", height: "100%" }}>
              <SummerRing active={ringActive} size={200} analyser={analyserRef.current} />
            </span>
            <span className={styles.ringLogo}>S</span>
          </button>
        </div>

        {/* Bubble + grid — only shown after ring is tapped */}
        {!audioUnlocked && (
          <div className={styles.preHint}>
            <p className={styles.preHintText}>Best with headphones&nbsp;🎧</p>
            <p className={styles.preHintCta}>Tap the ring to talk to Summer</p>
          </div>
        )}
        {audioUnlocked && (
          <>
            <div key={`bubble-${sceneKey}`} className={`${styles.heroBubble} ${styles.sceneEnter}`}>
              <p className={styles.heroText}>
                {typedText}
                {isTyping && <span className={styles.typeCursor} aria-hidden="true" />}
              </p>
            </div>

            {/* Button grid — revealed after typing + audio done */}
            {gridVisible && scene && (
              <div key={`grid-${sceneKey}`} className={styles.optGrid}>
                {scene.options.map((opt, i) => renderOption(opt, i))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

