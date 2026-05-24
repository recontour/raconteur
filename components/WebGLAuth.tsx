"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useRef, useState } from "react";
import * as THREE from "three";
import {
  signInWithPopup,
  GoogleAuthProvider,
  signInAnonymously,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import styles from "./WebGLAuth.module.css";

// ── Google brand-color icon ────────────────────────────────────────────────
const GoogleIcon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

interface WebGLAuthProps {
  onAuthSuccess?: () => void;
}

// ── Premium aurora WebGL background ──────────────────────────────────────
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

            // Palette: pearl white with barely-there tints
            vec3 base  = vec3(0.974, 0.972, 0.984); // pearl
            vec3 blue  = vec3(0.905, 0.920, 0.970); // cool lavender
            vec3 mint  = vec3(0.930, 0.962, 0.948); // mint
            vec3 rose  = vec3(0.968, 0.945, 0.962); // blush

            vec3 col = base;
            col = mix(col, blue, n1 * 0.32);
            col = mix(col, mint, n2 * 0.22);
            col = mix(col, rose, n3 * 0.18);

            // Radial vignette — slightly darker edges
            float d = length(vUv - 0.5) * 1.8;
            col -= d * d * 0.04;

            gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
          }
        `}
      />
    </mesh>
  );
}

function AuthScene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
      <AuroraBackground />
    </>
  );
}

// ── Arc spinner ───────────────────────────────────────────────────────────
const Spinner = ({ color = "rgba(29,29,31,0.45)" }: { color?: string }) => (
  <svg className={styles.spinner} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5" stroke={color} strokeWidth="2" strokeOpacity="0.12" />
    <path d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// ── Flow types ────────────────────────────────────────────────────────────
type Step = "welcome" | "signin" | "terms" | "entering";

const TERMS_TEXT = `Welcome to Raconteur — a space for stories that breathe.

By continuing you agree to the following:

1. Experience
   This app delivers audio-synchronised literary readings. Narration is a core part of the experience and plays automatically when you start a chapter.

2. Content
   Stories may explore emotionally complex, morally ambiguous, or melancholic themes in keeping with the literary tradition they come from.

3. Data & Privacy
   We use Firebase Authentication to identify you. Signing in anonymously creates a temporary account. Google sign-in shares your email with Firebase. We do not sell your data.

4. Cookies
   Authentication tokens are stored in your browser to keep you signed in between sessions.

5. Usage
   You agree to use this app for personal, non-commercial enjoyment only.

That's it — no fine print designed to confuse. Just stories.`;

export default function WebGLAuth({ onAuthSuccess }: WebGLAuthProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [termsScrolled, setTermsScrolled] = useState(false);

  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setTermsScrolled(true);
    }
  };

  // Guest: sign in immediately, no terms
  const handleGuestSignIn = async () => {
    setStep("entering");
    try {
      await signInAnonymously(auth);
      onAuthSuccess?.();
      router.push("/");
    } catch {
      setStep("signin");
    }
  };

  // Google: show terms first
  const handleGoogleSelect = () => {
    setTermsScrolled(false);
    setStep("terms");
  };

  // After terms accepted — do the actual Google sign-in
  const handleTermsAccept = async () => {
    if (!termsScrolled) return;
    setStep("entering");
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onAuthSuccess?.();
      router.push("/");
    } catch {
      setStep("signin");
    }
  };

  const card = (id: Step) =>
    `${styles.card} ${step === id ? styles.active : ""}`;

  return (
    <div className={styles.container}>
      <Canvas className={styles.canvas} gl={{ antialias: true }}>
        <AuthScene />
      </Canvas>

      <div className={styles.overlay}>

        {/* ── 1. Welcome ─────────────────────────────────────────────── */}
        <div className={card("welcome")}>
          <p className={styles.wordmark}>Raconteur</p>
          <div className={styles.quoteBlock}>
            <p className={styles.quoteText}>
              &ldquo;Perhaps it would be best if you imagined it as your own town.&rdquo;
            </p>
            <p className={styles.quoteSource}>— Ursula K. Le Guin</p>
          </div>
          <h1 className={styles.headline}>Your story begins here.</h1>
          <p className={styles.subtext}>A few steps before the words come alive.</p>
          <button className={styles.primaryBtn} onClick={() => setStep("signin")}>
            Begin
            <svg viewBox="0 0 16 16" fill="none" width="13" height="13" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* ── 2. Sign-in choice ──────────────────────────────────────── */}
        <div className={card("signin")}>
          <p className={styles.wordmark}>Raconteur</p>
          <h2 className={styles.headline}>How would you like to enter?</h2>
          <p className={styles.subtext}>Guest accounts are anonymous and temporary.</p>

          <div className={styles.authOptions}>
            <button
              onClick={handleGoogleSelect}
              className={`${styles.authButton} ${styles.googleButton}`}
            >
              <GoogleIcon size={20} />
              <span>Continue with Google</span>
            </button>

            <button
              onClick={handleGuestSignIn}
              className={`${styles.authButton} ${styles.guestButton}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                   width="18" height="18" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <span>Continue as Guest</span>
            </button>
          </div>

          <button className={styles.backLink} onClick={() => setStep("welcome")}>← Back</button>
        </div>

        {/* ── 3. Terms — only reached via Google ────────────────────── */}
        <div className={`${card("terms")} ${styles.termsCard}`}>
          <p className={styles.stepLabel}>Review & Accept</p>
          <h2 className={styles.termsTitle}>Before you enter</h2>
          <p className={styles.termsCue}>Scroll to the bottom, then accept.</p>
          <div
            className={styles.termsScroll}
            onScroll={handleTermsScroll}
            role="region"
            aria-label="Terms of use"
          >
            <pre className={styles.termsText}>{TERMS_TEXT}</pre>
          </div>
          <div className={styles.termsActions}>
            <button className={styles.ghostBtn} onClick={() => setStep("signin")}>Go Back</button>
            <button
              className={`${styles.primaryBtn} ${!termsScrolled ? styles.primaryBtnDisabled : ""}`}
              onClick={handleTermsAccept}
              aria-disabled={!termsScrolled}
            >
              I Agree
            </button>
          </div>
        </div>

        {/* ── 4. Entering (loading) ─────────────────────────────────── */}
        <div className={`${card("entering")} ${styles.enteringCard}`}>
          <Spinner />
          <p className={styles.enteringLabel}>Entering</p>
          <span className={styles.enteringDots}>
            <span/><span/><span/>
          </span>
        </div>

      </div>
    </div>
  );
}
