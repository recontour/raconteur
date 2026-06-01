"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";

import { useAuth } from "@/app/helper/auth";
import { auth } from "@/lib/firebase";
import { checkUserStatus } from "@/app/actions/user";

import { useStoryEngine } from "@/hooks/useStoryEngine";
import { useAuthFlow } from "@/hooks/useAuthFlow";

import { AuthOverlay } from "@/components/AuthOverlay";
import { WriterPanel } from "@/components/WriterPanel";
import Context from "@/components/Context";

import styles from "./BotInterface.module.css";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";

// --- WebGL Background ---
// Borrowed from WebGLAuth.tsx (Premium aurora background) to satisfy point 3.
function AuroraBackground() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh position={[0, 0, -10]} scale={[30, 30, 1]}>
      <planeGeometry args={[1, 1, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          varying vec2 vUv;
          uniform float uTime;

          float hash(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          float smoothNoise(vec2 p) {
            vec2 i = floor(p); vec2 f = fract(p);
            vec2 u = f * f * (3.0 - 2.0 * f);
            return mix(
              mix(hash(i), hash(i + vec2(1,0)), u.x),
              mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), u.x), u.y);
          }
          float fbm(vec2 p) {
            float v = 0.0; float a = 0.5;
            for (int i = 0; i < 5; i++) { v += a * smoothNoise(p); p *= 2.1; a *= 0.5; }
            return v;
          }

          void main() {
            float t = uTime * 0.06;
            vec2 p = vUv * 2.8;
            float n1 = fbm(p + vec2(t, t * 0.6));
            float n2 = fbm(p + vec2(-t * 0.7, t * 0.45) + n1 * 0.55);
            float n3 = fbm(p + n2 * 0.75);

            vec3 base  = vec3(0.974, 0.972, 0.984);
            vec3 blue  = vec3(0.905, 0.920, 0.970);
            vec3 mint  = vec3(0.930, 0.962, 0.948);
            vec3 rose  = vec3(0.968, 0.945, 0.962);

            vec3 col = base;
            col = mix(col, blue, n1 * 0.32);
            col = mix(col, mint, n2 * 0.22);
            col = mix(col, rose, n3 * 0.18);

            float d = length(vUv - 0.5) * 1.8;
            col -= d * d * 0.04;

            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
          }
        `}
      />
    </mesh>
  );
}

// --- Main Interface ---
export default function BotInterface() {
  const router = useRouter();
  const { user, loading: authStateLoading } = useAuth();

  // Engine state
  const engine = useStoryEngine();
  const {
    dialogue,
    ragContext,
    isSubmitting,
    error: engineError,
    handleSelection,
    setWeatherMessage,
    flowSteps,
    setFlowSteps
  } = engine;

  // Auth flow
  const authFlow = useAuthFlow(() => router.push("/book"));
  const { setAuthStep } = authFlow;

  // Admin state
  const [isAdmin, setIsAdmin] = useState(false);
  const [writerOpen, setWriterOpen] = useState(false);

  // Animation states
  const [exiting, setExiting] = useState(false);
  const [localDialogue, setLocalDialogue] = useState(dialogue);

  // Handle transitions elegantly with animation frames rather than arbitrary timeouts
  useEffect(() => {
    if (dialogue !== localDialogue) {
      setExiting(true);
      // Wait for exit animation to complete (css has 0.3s transition)
      const timer = setTimeout(() => {
        setLocalDialogue(dialogue);
        setExiting(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [dialogue, localDialogue]);

  // Load Admin status
  useEffect(() => {
    if (authStateLoading || !user) return;
    const checkAdmin = async () => {
      try {
        const { isAdmin } = await checkUserStatus(user.uid);
        if (isAdmin) {
          setIsAdmin(true);
        }
      } catch (err) {
        console.error("Admin check failed", err);
      }
    };
    checkAdmin();
  }, [user, authStateLoading]);

  // Weather Logic
  const handleWeatherClick = () => {
    if (!navigator.geolocation) {
      setWeatherMessage("Geolocation isn't supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        try {
          const res = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`
          );
          const data = await res.json();
          const temp = Math.round(data.current.temperature_2m as number);
          const code = data.current.weather_code as number;
          const wind = Math.round(data.current.wind_speed_10m as number);
          setWeatherMessage(`${code} · ${temp}°C · Wind ${wind} km/h`);
        } catch {
          setWeatherMessage("Couldn't fetch weather right now.");
        }
      },
      () => setWeatherMessage("Location access denied."),
      { timeout: 10000 }
    );
  };

  const handleOptionClick = (option: string) => {
    if (isSubmitting) return;

    if (option === "Continue Reading" && !user && !authStateLoading) {
      setAuthStep("method");
      return;
    } else if (option === "Continue Reading" && user) {
      router.push("/book");
      return;
    }

    if (option === "🌤 Weather near me") {
      handleWeatherClick();
      // Wait for weather state to update
      return;
    }

    handleSelection(option, () => setAuthStep("method"));
  };

  return (
    <div className={styles.container}>
      {/* ── Dynamic WebGL Background ── */}
      <div style={{ position: "absolute", inset: 0, zIndex: -1, pointerEvents: "none" }}>
        <Canvas gl={{ antialias: true }}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
          <AuroraBackground />
        </Canvas>
      </div>

      {isAdmin && !writerOpen && (
        <button className={styles.writerTrigger} onClick={() => setWriterOpen(true)}>
          ✦ Writer
        </button>
      )}

      <div className={styles.layout}>
        {engineError && <p style={{ color: "red", textAlign: "center" }}>{engineError}</p>}
        
        {/* Top Bubble */}
        <div className={`${styles.topBubble} ${exiting ? styles.exiting : styles.enteringTop}`}>
          <div className={styles.blobContent}>
            {isSubmitting ? (
              <div className={styles.hiveLoader}>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
                <div className={styles.dot}></div>
              </div>
            ) : (
              <div className={styles.textTransition} key={localDialogue.ai}>
                {localDialogue.ai}
              </div>
            )}
          </div>
        </div>

        {/* Bottom Bubbles */}
        <div className={localDialogue.type === "grid" ? styles.optionsGrid : styles.optionsRow}>
          {localDialogue.options.map((option, index) => (
            <button
              key={`btn-${option}`}
              className={`${styles.bottomBubble} ${exiting ? styles.exiting : styles.enteringBottom}`}
              style={{ animationDelay: `${0.1 + index * 0.1}s` }}
              onClick={() => handleOptionClick(option)}
              disabled={isSubmitting}
            >
              <div className={styles.textTransition} key={option}>
                {option}
              </div>
            </button>
          ))}
        </div>

        {/* RAG Context Display */}
        {ragContext.length > 0 && (
          <div className={styles.ragContainer}>
            <Context documents={ragContext} isLoading={isSubmitting} />
          </div>
        )}
      </div>

      {/* Overlays */}
      <AuthOverlay authFlow={authFlow} onCancel={() => setAuthStep(null)} />
      {writerOpen && (
        <WriterPanel
          flowSteps={flowSteps}
          setFlowSteps={setFlowSteps}
          onClose={() => setWriterOpen(false)}
        />
      )}
    </div>
  );
}
