"use client";

import { Canvas } from "@react-three/fiber";
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
  const meshRef = useRef<THREE.Mesh>(null);

  return (
    <mesh ref={meshRef} position={[0, 0, -10]} scale={[20, 20, 1]}>
      <planeGeometry args={[2, 2]} />
      <meshBasicMaterial color="#f2f2f7" />
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

export default function WebGLAuth_({ onAuthSuccess }: WebGLAuthProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      onAuthSuccess?.();
      router.push("/");
    } catch (error) {
      console.error("Google sign in failed:", error);
      setLoading(false);
    }
  };

  const handleGuestSignIn = async () => {
    try {
      setLoading(true);
      await signInAnonymously(auth);
      onAuthSuccess?.();
      router.push("/");
    } catch (error) {
      console.error("Guest sign in failed:", error);
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <Canvas className={styles.canvas}>
        <AuthScene />
      </Canvas>

      {/* UI Overlay */}
      <div className={styles.overlay}>
        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            <h1 className={styles.title}>Raconteur</h1>
            <p className={styles.subtitle}>Sign in or create an account</p>
          </div>

          {/* Auth Options */}
          <div className={styles.authOptions}>
            <button
              onClick={handleGoogleSignIn}
              disabled={loading}
              className={`${styles.authButton} ${styles.googleButton}`}
            >
              <svg
                className={styles.icon}
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span>{loading ? "Signing in..." : "Continue with Google"}</span>
            </button>

            <button
              onClick={handleGuestSignIn}
              disabled={loading}
              className={`${styles.authButton} ${styles.guestButton}`}
            >
              <span>{loading ? "Signing in..." : "Continue as Guest"}</span>
            </button>
          </div>

          {/* Footer */}
          <p className={styles.footer}>Tap to continue</p>
        </div>
      </div>
    </div>
  );
}
