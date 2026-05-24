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

interface WebGLAuthProps {
  onAuthSuccess?: () => void;
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

function AuthScene() {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 0, 5]} fov={50} />
      <ambientLight intensity={0.5} />
      <BackgroundScene />
    </>
  );
}

const Spinner = () => (
  <svg className={styles.spinner} viewBox="0 0 50 50">
    <circle className={styles.path} cx="25" cy="25" r="20" fill="none" strokeWidth="5"></circle>
  </svg>
);

type Step = "welcome" | "terms" | "signin";

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

export default function WebGLAuth_({ onAuthSuccess }: WebGLAuthProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");
  const [loading, setLoading] = useState(false);
  const [termsScrolled, setTermsScrolled] = useState(false);

  const handleTermsScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
      setTermsScrolled(true);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onAuthSuccess?.();
      router.push("/");
    } catch {
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    try {
      setLoading(true);
      await signInAnonymously(auth);
      onAuthSuccess?.();
      router.push("/");
    } catch {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Canvas className={styles.canvas}>
        <AuthScene />
      </Canvas>

      <div className={styles.overlay}>
        {/* ── Step: Welcome ────────────────────────────────────────────── */}
        <div className={`${styles.card} ${step === "welcome" ? styles.active : ""}`}>
          <p className={styles.wordmark}>Raconteur</p>
          <div className={styles.quoteBlock}>
            <p className={styles.quoteText}>
              &ldquo;Perhaps it would be best if you imagined it as your own town.&rdquo;
            </p>
            <p className={styles.quoteSource}>— Ursula K. Le Guin</p>
          </div>
          <h1 className={styles.welcomeTitle}>Your story begins here.</h1>
          <p className={styles.welcomeSub}>
            A few quick steps before the words come alive.
          </p>
          <button className={styles.primaryBtn} onClick={() => setStep("terms")}>
            Begin
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* ── Step: Terms ──────────────────────────────────────────────── */}
        <div className={`${styles.card} ${step === "terms" ? styles.active : ""}`}>
          <p className={styles.stepLabel}>02 / 03</p>
          <h2 className={styles.termsTitle}>Before you enter</h2>
          <p className={styles.termsCue}>Scroll to read, then accept.</p>
          <div
            className={styles.termsScroll}
            onScroll={handleTermsScroll}
            role="region"
            aria-label="Terms of use"
          >
            <pre className={styles.termsText}>{TERMS_TEXT}</pre>
          </div>
          <div className={styles.termsActions}>
            <button
              className={styles.ghostBtn}
              onClick={() => setStep("welcome")}
            >
              Go Back
            </button>
            <button
              className={`${styles.primaryBtn} ${!termsScrolled ? styles.primaryBtnDisabled : ""}`}
              onClick={() => termsScrolled && setStep("signin")}
              aria-disabled={!termsScrolled}
            >
              I Agree
            </button>
          </div>
        </div>

        {/* ── Step: Sign-in ────────────────────────────────────────────── */}
        <div className={`${styles.card} ${step === "signin" ? styles.active : ""}`}>
          <p className={styles.stepLabel}>03 / 03</p>
          <h2 className={styles.signinTitle}>How would you like to enter?</h2>
          <p className={styles.signinSub}>
            Guest accounts are anonymous and temporary.
          </p>
          <div className={styles.authOptions}>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`${styles.authButton} ${styles.googleButton}`}
            >
              {loading ? <Spinner /> : (
                <svg className={styles.icon} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{loading ? "Signing in…" : "Continue with Google"}</span>
            </button>

            <button
              onClick={handleGuestSignIn}
              disabled={loading}
              className={`${styles.authButton} ${styles.guestButton}`}
            >
              {loading ? <Spinner /> : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18" className={styles.icon} aria-hidden="true">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" strokeLinecap="round" strokeLinejoin="round" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
              )}
              <span>{loading ? "Signing in…" : "Continue as Guest"}</span>
            </button>
          </div>
          <button className={styles.backLink} onClick={() => setStep("terms")} disabled={loading}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
}
