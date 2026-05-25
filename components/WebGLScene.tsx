"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import styles from "./WebGLScene.module.css";
import Context, { RagDocument } from "@/components/Context";

interface WebGLSceneProps {
  isLoggedIn: boolean;
  user?: { email: string | null; phoneNumber: string | null; uid: string } | null;
  onLogout: () => void;
  onLogin: () => void;
}

function BackgroundScene() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, 0, -10]} scale={[25, 25, 1]}>
      <planeGeometry args={[1, 1, 32, 32]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.z += sin(pos.x * 3.0 + uTime * 0.5) * 0.1;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;
          
          float random(vec2 st) {
            return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
          }
          
          float noise(in vec2 st) {
            vec2 i = floor(st);
            vec2 f = fract(st);
            float a = random(i);
            float b = random(i + vec2(1.0, 0.0));
            float c = random(i + vec2(0.0, 1.0));
            float d = random(i + vec2(1.0, 1.0));
            vec2 u = f*f*(3.0-2.0*f);
            return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
          }

          void main() {
            vec2 st = vUv * 3.0;
            vec2 q = vec2(0.);
            q.x = noise(st + uTime * 0.1);
            q.y = noise(st + vec2(1.0));

            vec2 r = vec2(0.);
            r.x = noise(st + 1.0 * q + vec2(1.7, 9.2) + 0.15 * uTime);
            r.y = noise(st + 1.0 * q + vec2(8.3, 2.8) + 0.126 * uTime);

            float f = noise(st + r);

            vec3 color = mix(
              vec3(0.95, 0.95, 0.98),
              vec3(0.86, 0.87, 0.90),
              clamp((f*f)*4.0, 0.0, 1.0)
            );

            color = mix(
              color,
              vec3(0.98, 0.98, 0.99),
              clamp(length(q), 0.0, 1.0)
            );

            gl_FragColor = vec4(color, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function Scene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
      <ambientLight intensity={0.5} />
      <BackgroundScene />
    </>
  );
}

export default function WebGLScene_({ isLoggedIn }: WebGLSceneProps) {
  const router = useRouter();
  const [step, setStep] = useState<'splash' | 'genre_selection' | 'scenario'>('splash');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [ragContext, setRagContext] = useState<RagDocument[]>([]);

  // Cinematic state
  const [showText, setShowText] = useState(false);
  const [showOptions, setShowOptions] = useState(false);

  const handleRead = () => {
    if (isLoggedIn) {
      router.push("/book");
    } else {
      router.push("/auth");
    }
  };

  const handleNewStory = () => {
    setStep('genre_selection');
  };

  const handleGenreSelect = async (genre: string) => {
    setIsSubmitting(true);
    
    // MOCK SERVER ACTION: Write user genre choice to DB
    console.log("Saving user genre choice to database...", genre);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network latency
    
    // UPDATE INDEX / RAG CONTEXT
    const newContextDoc: RagDocument = {
      id: Date.now().toString(),
      content: `The user requested a new story with the genre: ${genre}`,
      metadata: { source: "User Preferences DB", type: "Genre Choice" },
      score: 1.0
    };
    
    setRagContext(prev => [newContextDoc, ...prev]);
    setIsSubmitting(false);

    // After picking a genre, we could start the scenario, but for now we'll just acknowledge it
    // and let them see the RAG context update.
    setStep('scenario');
    setShowText(false);
    setShowOptions(false);
    setTimeout(() => setShowText(true), 100);
    setTimeout(() => setShowOptions(true), 10000);
  };

  const handleOptionSelect = async (optionText: string) => {
    setIsSubmitting(true);
    
    // MOCK SERVER ACTION: Write user choice to DB
    console.log("Saving user choice to database...", optionText);
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network latency
    
    // UPDATE INDEX / RAG CONTEXT
    const newContextDoc: RagDocument = {
      id: Date.now().toString(),
      content: `The user decided to: ${optionText}`,
      metadata: { source: "User History DB", type: "Choice" },
      score: 1.0
    };
    
    setRagContext(prev => [newContextDoc, ...prev]);
    setIsSubmitting(false);

    // Reset cinematic state for the next chunk (mocking the progression)
    setShowText(false);
    setShowOptions(false);
    
    // Simulate loading the next scenario text
    setTimeout(() => setShowText(true), 300);
    setTimeout(() => setShowOptions(true), 10000); // 10 second delay for options
  };

  return (
    <div className={styles.container}>
      <Canvas className={styles.canvas}>
        <Scene />
      </Canvas>

      <div className={styles.overlay}>
        {step === 'splash' && (
          <div className={styles.splashCard}>
            <p className={styles.wordmark}>Raconteur</p>

            <div className={styles.splashIcon}>
              <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" width="52" height="52" aria-hidden="true">
                <path d="M8 28V24C8 15.163 15.163 8 24 8s16 7.163 16 16v4" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="4" y="26" width="8" height="14" rx="4" />
                <rect x="36" y="26" width="8" height="14" rx="4" />
              </svg>
            </div>

            <h1 className={styles.splashHeadline}>
              Welcome to Raconteur
            </h1>
            <p className={styles.splashSub} style={{ marginBottom: '1rem' }}>
              Dive into an interactive, dynamically generated audio experience. 
              Your choices shape the narrative, and every decision is remembered 
              to craft a unique story tailored just for you. What would you like to do today?
            </p>

            <div className={styles.splashButtons} style={{ flexDirection: 'column' }}>
              <button
                className={styles.splashBtn}
                onClick={handleRead}
                aria-label="Read your current story"
                style={{ width: '100%' }}
              >
                Continue Reading
              </button>
              <button
                className={`${styles.splashBtn} ${styles.splashBtnMute}`}
                onClick={handleNewStory}
                aria-label="Start a new story"
                style={{ width: '100%' }}
              >
                Start a New Story
              </button>
            </div>
          </div>
        )}

        {step === 'genre_selection' && (
          <div className={styles.scenarioContainer}>
            <div className={`${styles.splashCard} ${styles.scenarioCard}`} style={{ animation: 'fadeIn 1s ease-in-out' }}>
              <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem", color: "#111827", alignSelf: "flex-start" }}>
                What do you want your next story to be?
              </h2>
              <p style={{ marginBottom: "1.5rem", lineHeight: 1.6, color: "#4b5563" }}>
                Select a genre below. We will use this selection as the foundational context 
                to generate the beginning of your new adventure.
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", width: "100%" }}>
                {["Science Fiction", "High Fantasy", "Cyberpunk", "Mystery Thriller", "Historical Fiction", "Horror"].map(genre => (
                  <button 
                    key={genre}
                    className={styles.splashBtn} 
                    disabled={isSubmitting}
                    onClick={() => handleGenreSelect(genre)}
                    style={{ padding: "12px 16px", minHeight: "60px" }}
                  >
                    {isSubmitting ? "Saving..." : genre}
                  </button>
                ))}
              </div>
            </div>

            <Context documents={ragContext} isLoading={isSubmitting} />
          </div>
        )}

        {step === 'scenario' && (
          <div className={styles.scenarioContainer}>
            <div className={`${styles.splashCard} ${styles.scenarioCard}`}>
              {showText && (
                <>
                  <h2 className={styles.cinematicTitle}>Chapter 1: The Beginning</h2>
                  <p className={styles.cinematicText}>
                    The world takes shape around you based on your chosen path. The air is thick with anticipation, and the faint sound of a distant challenge echoes. Two paths lay before you, branching out into the unknown.
                  </p>
                </>
              )}
              
              {!showOptions && showText && (
                <div className={styles.loadingRingContainer}>
                  <div className={styles.bubblesRing}>
                    <div></div><div></div><div></div><div></div>
                  </div>
                </div>
              )}

              {showOptions && (
                <div className={`${styles.optionsContainer} ${isSubmitting ? styles.optionsSubmitting : ''}`}>
                  <button 
                    className={styles.splashBtn} 
                    disabled={isSubmitting}
                    onClick={() => handleOptionSelect("Venture boldly forward into the danger.")}
                  >
                    {isSubmitting ? "Saving..." : "Option A: Venture boldly forward"}
                  </button>
                  <button 
                    className={styles.splashBtn} 
                    disabled={isSubmitting}
                    onClick={() => handleOptionSelect("Carefully observe and look for clues.")}
                  >
                    {isSubmitting ? "Saving..." : "Option B: Carefully observe your surroundings"}
                  </button>
                </div>
              )}
            </div>

            <Context documents={ragContext} isLoading={isSubmitting} />
          </div>
        )}
      </div>
    </div>
  );
}
