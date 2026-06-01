"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import * as THREE from "three";
import styles from "./StoryInterface.module.css";

// ─── Scene definitions ───────────────────────────────────────────────────────

type SceneId = "welcome" | "entertainment" | "news" | "whatsup" | "story";

interface SceneOption { label: string; next: SceneId; }
interface SceneDef { hero: string; subtext?: string; options: SceneOption[]; }

const SCENES: Record<SceneId, SceneDef> = {
  welcome: {
    hero: "Welcome to Raconteur",
    options: [
      { label: "Entertainment",              next: "entertainment" },
      { label: "News",                       next: "news"          },
      { label: "What's Up?",                 next: "whatsup"       },
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
  story: {
    hero: "I want to listen to a story",
    subtext: "More coming soon.",
    options: [{ label: "← Back", next: "welcome" }],
  },
};

// ─── WebGL background (warm white, barely-there) ─────────────────────────────

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
    float n1 = fbm(p + vec2(t,         t  * 0.60));
    float n2 = fbm(p + vec2(-t * 0.45, t  * 0.33) + n1 * 0.40);
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

// ─── Setup ───────────────────────────────────────────────────────────────────

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

  let raf = 0;
  let paused = false;
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

// ─── Component ───────────────────────────────────────────────────────────────

export default function StoryInterface() {
  const bgRef   = useRef<HTMLDivElement>(null);
  const [sceneId,  setSceneId]  = useState<SceneId>("welcome");
  const [exiting,  setExiting]  = useState(false);
  const [sceneKey, setSceneKey] = useState(0);

  useEffect(() => {
    if (!bgRef.current) return;
    return setupBg(bgRef.current);
  }, []);

  const navigate = useCallback((next: SceneId) => {
    setExiting(true);
    setTimeout(() => {
      setSceneId(next);
      setSceneKey(k => k + 1);
      setExiting(false);
    }, 280);
  }, []);

  const def     = SCENES[sceneId];
  const isSingle = def.options.length === 1;

  return (
    <div className={styles.root}>
      <div ref={bgRef} className={styles.bg} />

      <div
        key={sceneKey}
        className={`${styles.scene} ${exiting ? styles.sceneExit : ""}`}
      >
        <header className={styles.header}>
          <span className={styles.wordmark}>Raconteur</span>
        </header>

        <div className={styles.layout}>
          <div className={styles.heroBubble}>
            <div className={styles.bubbleInner}>
              <p className={styles.heroText}>{def.hero}</p>
              {def.subtext && <p className={styles.subText}>{def.subtext}</p>}
            </div>
          </div>

          {isSingle ? (
            <div className={styles.optSingle}>
              <button
                className={styles.optBoxWide}
                onClick={() => navigate(def.options[0].next)}
                disabled={exiting}
              >
                <span className={styles.optLabel}>{def.options[0].label}</span>
              </button>
            </div>
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
      </div>
    </div>
  );
}

