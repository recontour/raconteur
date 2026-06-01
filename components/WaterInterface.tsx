"use client";

import React, { useRef, useEffect, useState } from "react";
import * as THREE from "three";
import styles from "./WaterInterface.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DialogueStep {
  message: string;
  options: string[];
}

// ── Dialogue flow ──────────────────────────────────────────────────────────────

const INITIAL_STEP: DialogueStep = {
  message: "Welcome to Raconteur. What would you like to do today?",
  options: ["Continue Reading", "Start a New Story"],
};

const FLOW: Record<string, DialogueStep> = {
  "Continue Reading": {
    message: "Every story needs a hero.",
    options: ["Find my place", "Browse stories"],
  },
  "Start a New Story": {
    message: "What kind of story calls to you?",
    options: ["Adventure", "Mystery"],
  },
  "Find my place": {
    message: "Welcome back. Where were we?",
    options: ["Resume chapter", "Start over"],
  },
  "Browse stories": {
    message: "What world would you like to enter?",
    options: ["Fantasy", "Thriller"],
  },
  Adventure: {
    message: "The road is long. Who leads the way?",
    options: ["A seasoned explorer", "A reluctant hero"],
  },
  Mystery: {
    message: "Something is hidden. Where do you begin?",
    options: ["Follow the clues", "Trust your instincts"],
  },
};

function nextStep(option: string): DialogueStep {
  return FLOW[option] ?? { message: option, options: ["Continue", "Start over"] };
}

// ── Water background (animated ocean wave shader) ───────────────────────────────

const WAVE_FRAG = `
  precision mediump float;
  uniform vec2  uRes;
  uniform float uTime;

  float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float vnoise(vec2 p){
    vec2 i=floor(p), f=fract(p), u=f*f*(3.0-2.0*f);
    return mix(mix(h21(i),          h21(i+vec2(1,0)),u.x),
               mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),u.x), u.y)*2.0-1.0;
  }
  float fbm(vec2 p){
    float v=0.0, a=0.5;
    for(int i=0;i<3;i++){ v+=a*vnoise(p); p=p*2.0+vec2(1.7,9.2); a*=0.5; }
    return v;
  }

  void main(){
    vec2  uv  = gl_FragCoord.xy / uRes;
    float asp = uRes.x / uRes.y;
    vec2  p   = vec2(uv.x*asp, uv.y);
    float t   = uTime;

    // Two gentle wave layers — very slow, barely perceptible
    float w  = fbm(p*1.8 + vec2(t*0.025, t*0.018));
    float w2 = fbm(p*3.2 + vec2(-t*0.018, t*0.012) + w*0.28);

    // Clean airy sky palette
    vec3 base = vec3(0.62, 0.84, 0.95);
    vec3 deep = vec3(0.52, 0.76, 0.92);
    vec3 mid  = vec3(0.72, 0.90, 0.97);

    float d  = uv.y*0.5 + w2*0.12 + w*0.08;
    vec3  col = mix(base, deep, smoothstep(0.20, 0.70, d));
    col = mix(col, mid, smoothstep(0.60, 1.00, d)*0.55);

    // Barely-there shimmer
    float sh = max(0.0, w2) * max(0.0, w);
    col += vec3(0.90, 0.96, 0.99) * sh * sh * 0.14;

    // Soft vignette
    vec2 vig = uv - 0.5;
    col *= 1.0 - dot(vig,vig)*0.45;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

function setupWaterBg(container: HTMLDivElement): () => void {
  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(container.clientWidth, container.clientHeight);
  const cvs = renderer.domElement;
  cvs.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block";
  container.appendChild(cvs);

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const mat = new THREE.ShaderMaterial({
    vertexShader: `void main(){ gl_Position = vec4(position, 1.0); }`,
    fragmentShader: WAVE_FRAG,
    uniforms: {
      uRes:  { value: new THREE.Vector2(cvs.width, cvs.height) },
      uTime: { value: 0 },
    },
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  const onResize = () => {
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    mat.uniforms.uRes.value.set(renderer.domElement.width, renderer.domElement.height);
  };
  window.addEventListener("resize", onResize);

  let rafId  = 0;
  let paused = false;
  const onVis = () => { paused = document.hidden; };
  document.addEventListener("visibilitychange", onVis);

  (function loop() {
    if (!paused) {
      mat.uniforms.uTime.value = performance.now() * 0.001;
      renderer.render(scene, camera);
    }
    rafId = requestAnimationFrame(loop);
  })();

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener("resize", onResize);
    document.removeEventListener("visibilitychange", onVis);
    renderer.dispose();
    mat.dispose();
    if (container.contains(cvs)) container.removeChild(cvs);
  };
}


// ── React component ────────────────────────────────────────────────────────────

export default function WaterInterface() {
  const bgRef    = useRef<HTMLDivElement>(null);
  const [step, setStep]           = useState<DialogueStep>(INITIAL_STEP);
  const [msgKey, setMsgKey]       = useState(0);
  const [clickedIdx, setClickedIdx] = useState<number | null>(null);
  const [msgOut, setMsgOut]       = useState(false);

  useEffect(() => {
    if (!bgRef.current) return;
    return setupWaterBg(bgRef.current);
  }, []);

  const handleClick = (option: string, idx: number) => {
    if (clickedIdx !== null) return;
    setClickedIdx(idx);
    setMsgOut(true);
    // After 320ms: animations have played out — swap content in one batch
    setTimeout(() => {
      setStep(nextStep(option));
      setMsgKey((k) => k + 1);
      setMsgOut(false);
      setClickedIdx(null);
    }, 320);
  };

  const optionClass = (idx: number): string => {
    if (clickedIdx === null) return styles.bottomBubble;
    if (idx === clickedIdx)  return `${styles.bottomBubble} ${styles.bubbleFlyUp}`;
    return `${styles.bottomBubble} ${styles.bubbleBurst}`;
  };

  return (
    <div className={styles.container}>
      {/* ── Water background ── */}
      <div ref={bgRef} className={styles.waterBg} />

      {/* ── Layout matches BotInterface exactly ── */}
      <div className={styles.layout}>

        {/* Top message bubble */}
        <div className={styles.topBubble}>
          <div className={styles.blobContent}>
            <p
              key={msgKey}
              className={`${styles.messageText}${msgOut ? " " + styles.messageOut : ""}`}
            >
              {step.message}
            </p>
          </div>
        </div>

        {/* Option bubbles */}
        <div className={styles.optionsRow}>
          {step.options.map((opt, i) => (
            <button
              key={`${msgKey}-${i}`}
              className={optionClass(i)}
              onClick={() => handleClick(opt, i)}
              disabled={clickedIdx !== null}
            >
              <span>{opt}</span>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
