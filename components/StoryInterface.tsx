"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/app/helper/auth";
import { writeRagData } from "@/components/RAGdata";
import { useStoryEngine } from "@/hooks/useStoryEngine";
import { useAuthFlow } from "@/hooks/useAuthFlow";
import { AuthOverlay } from "@/components/AuthOverlay";
import { getOrInitStory, saveStoryChoice, StoryParagraph } from "@/app/actions/user";
import styles from "./StoryInterface.module.css";

// ─── WebGL aurora background ─────────────────────────────────────────────────

const AURORA_FRAG = `
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
    vec2  uv = gl_FragCoord.xy / uRes;
    float t  = uTime * 0.030;
    vec2  p  = uv * 2.6;

    float n1 = fbm(p + vec2(t,        t  * 0.60));
    float n2 = fbm(p + vec2(-t * 0.45, t  * 0.33) + n1 * 0.40);
    float n3 = fbm(p + n2 * 0.58);

    vec3 base  = vec3(0.118, 0.075, 0.051);
    vec3 warm  = vec3(0.160, 0.098, 0.059);
    vec3 deep  = vec3(0.082, 0.047, 0.027);

    vec3 col = base;
    col = mix(col, warm, n1 * 0.38);
    col = mix(col, deep, n2 * 0.28);
    col = mix(col, warm, n3 * 0.18);

    float vig = 1.0 - dot(uv - 0.5, uv - 0.5) * 0.14;
    col *= vig;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

function setupAurora(el: HTMLDivElement): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(1.5, devicePixelRatio));
  renderer.setSize(el.clientWidth, el.clientHeight);

  const cvs = renderer.domElement;
  cvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  el.appendChild(cvs);

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat    = new THREE.ShaderMaterial({
    vertexShader:   "void main(){gl_Position=vec4(position,1.0);}",
    fragmentShader: AURORA_FRAG,
    uniforms: {
      uRes:  { value: new THREE.Vector2(cvs.width, cvs.height) },
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
    mat.dispose();
    if (el.contains(cvs)) el.removeChild(cvs);
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

type AppPhase  = "onboarding" | "fading" | "reading";
type ExitState = "idle" | "exiting";

// ─── Component ───────────────────────────────────────────────────────────────

export default function StoryInterface() {
  const bgRef    = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Guard: only start reading once per session */
  const hasStartedRef = useRef(false);

  const { user } = useAuth();

  // WebGL background
  useEffect(() => {
    if (!bgRef.current) return;
    return setupAurora(bgRef.current);
  }, []);

  // ── Engines ──────────────────────────────────────────────────────────────
  const engine = useStoryEngine();

  // Auth flow: the onComplete callback is dynamic — stored in a ref so the
  // hook closure always calls the most-recently registered action.
  const onAuthCompleteRef = useRef<() => void>(() => {});
  const authFlow = useAuthFlow(() => onAuthCompleteRef.current());
  const { setAuthStep } = authFlow;

  // ── App state ─────────────────────────────────────────────────────────────
  const [appPhase,     setAppPhase]     = useState<AppPhase>("onboarding");
  const [storyParas,   setStoryParas]   = useState<StoryParagraph[]>([]);
  const [paraIndex,    setParaIndex]    = useState(0);
  const [storyLoading, setStoryLoading] = useState(false);

  // Bubble transition state
  const [exitState,    setExitState]    = useState<ExitState>("idle");
  const [chosenIdx,    setChosenIdx]    = useState<number | null>(null);
  const [contentKey,   setContentKey]   = useState(0);

  // Scene-level exit animation (onboarding → reading)
  const [sceneExiting, setSceneExiting] = useState(false);

  // ── Phase transition: onboarding → reading ───────────────────────────────
  const startReading = useCallback((paraStart = 0) => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    setSceneExiting(true);
    setStoryLoading(true);

    getOrInitStory("omelas")
      .then(({ paragraphs }) => {
        setStoryParas(paragraphs);
        setParaIndex(paraStart);
        setStoryLoading(false);
      })
      .catch(() => setStoryLoading(false));

    // Stagger: scene exits, veil appears, reading renders under veil
    setTimeout(() => setAppPhase("fading"), 160);
    setTimeout(() => setAppPhase("reading"), 520);
  }, []);

  // When engine completes AVATAR onboarding → switch to story reader
  useEffect(() => {
    if (engine.phase === "STORY" && appPhase === "onboarding") {
      startReading(0);
    }
  }, [engine.phase, appPhase, startReading]);

  // ── Audio ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (appPhase !== "reading" || !storyParas[paraIndex]?.audio) return;

    const src = storyParas[paraIndex].audio;
    if (!audioRef.current) {
      audioRef.current = new Audio(src);
    } else {
      audioRef.current.pause();
      audioRef.current.src = src;
    }
    audioRef.current.load();
    const play = audioRef.current.play();
    if (play) play.catch(() => { /* browser autoplay policy — user will tap */ });

    return () => { audioRef.current?.pause(); };
  }, [paraIndex, appPhase, storyParas]);

  // ── Onboarding option handler ─────────────────────────────────────────────
  const handleOnboardClick = (opt: string) => {
    if (engine.isSubmitting) return;

    if (opt === "Continue Reading") {
      if (!user) {
        // After auth: skip to reading
        onAuthCompleteRef.current = () => startReading(0);
        setAuthStep("method");
        return;
      }
      // Already signed in
      startReading(0);
      return;
    }

    // Delegate all other choices to the story engine (HERO / AVATAR phases)
    engine.handleSelection(opt, () => {
      onAuthCompleteRef.current = () => {};
      setAuthStep("method");
    });
  };

  // ── Story option handler ──────────────────────────────────────────────────
  const handleStoryClick = useCallback(
    async (opt: string, idx: number) => {
      if (exitState !== "idle") return;

      setChosenIdx(idx);
      setExitState("exiting");

      setTimeout(async () => {
        // Persist choice → Firestore + RAG (both non-blocking)
        if (auth.currentUser) {
          const para = storyParas[paraIndex];
          try {
            await saveStoryChoice(auth.currentUser.uid, "omelas", para.slug, opt);
            await writeRagData(auth.currentUser.uid, "story_choice", {
              storyId: "omelas",
              paraId:  para.slug,
              choice:  opt,
            });
          } catch { /* non-fatal */ }
        }

        setParaIndex((i) => (i + 1) % (storyParas.length || 1));
        setContentKey((k) => k + 1);
        setExitState("idle");
        setChosenIdx(null);
      }, 620);
    },
    [exitState, paraIndex, storyParas],
  );

  // ── Derived ───────────────────────────────────────────────────────────────
  const dl          = engine.dialogue;
  const currentPara = storyParas[paraIndex];

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.root}>

      {/* WebGL background */}
      <div ref={bgRef} className={styles.bg} />

      {/* Phase-change veil — fades in then out during transition */}
      {appPhase === "fading" && <div className={styles.phaseVeil} />}

      {/* ─────────────────────────── ONBOARDING ─────────────────────────── */}
      {(appPhase === "onboarding" || appPhase === "fading") && (
        <div className={`${styles.scene} ${sceneExiting ? styles.sceneExit : ""}`}>
          <header className={styles.header}>
            <span className={styles.wordmark}>Raconteur</span>
          </header>

          <div className={styles.layout}>
            {/* Main dialogue bubble */}
            <div className={styles.topBubble}>
              <div className={styles.bubbleInner}>
                <p key={dl.id} className={styles.dialogText}>
                  {dl.ai}
                </p>
              </div>
            </div>

            {/* Option bubbles — row (2 choices) or grid (avatar picker) */}
            {dl.type === "row" ? (
              <div className={styles.optRow}>
                {dl.options.slice(0, 2).map((opt, i) => (
                  <button
                    key={`${dl.id}-${i}`}
                    className={styles.optBubble}
                    onClick={() => handleOnboardClick(opt)}
                    disabled={engine.isSubmitting}
                  >
                    <span className={styles.optLabel}>{opt}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className={styles.optGrid}>
                {dl.options.map((opt, i) => (
                  <button
                    key={`${dl.id}-${i}`}
                    className={styles.optChip}
                    onClick={() => handleOnboardClick(opt)}
                    disabled={engine.isSubmitting}
                  >
                    <span className={styles.optLabel}>{opt}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ──────────────────────────── READING ───────────────────────────── */}
      {appPhase === "reading" && (
        <div className={styles.scene}>
          <header className={styles.header}>
            <span className={styles.wordmark}>Raconteur</span>
            {currentPara && (
              <span className={styles.chapterLabel}>{currentPara.title}</span>
            )}
          </header>

          {storyLoading || !currentPara ? (
            <div className={styles.waiting}>
              <span className={styles.waitDot} />
            </div>
          ) : (
            <div className={styles.layout}>
              {/* Story paragraph bubble */}
              <div
                className={`${styles.topBubble} ${exitState === "exiting" ? styles.topExit : ""}`}
              >
                <div className={styles.bubbleInner}>
                  {/* key resets animation on each paragraph */}
                  <div key={contentKey} className={styles.crawlWrap}>
                    <p className={styles.paraText}>{currentPara.text}</p>
                  </div>
                </div>
              </div>

              {/* Choice bubbles */}
              <div className={styles.optRow}>
                {currentPara.options.map((opt, i) => {
                  const isChosen = chosenIdx === i;
                  const isOther  = chosenIdx !== null && !isChosen;
                  return (
                    <button
                      key={`${contentKey}-${i}`}
                      className={[
                        styles.optBubble,
                        isChosen ? styles.optFly     : "",
                        isOther  ? styles.optDissolve : "",
                      ].join(" ").trim()}
                      onClick={() => handleStoryClick(opt, i)}
                      disabled={exitState !== "idle"}
                    >
                      <span className={styles.optLabel}>{opt}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Auth overlay (phone / Google sign-in) */}
      <AuthOverlay authFlow={authFlow} onCancel={() => {}} />
    </div>
  );
}
