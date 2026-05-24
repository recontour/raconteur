"use client";

import { Canvas } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { useRef } from "react";
import { useRouter } from "next/navigation";
import * as THREE from "three";
import styles from "./WebGLScene.module.css";

interface WebGLSceneProps {
  isLoggedIn: boolean;
  user?: { email: string | null; phoneNumber: string | null; uid: string } | null;
  onLogout: () => void;
  onLogin: () => void;
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

  const handleBegin = () => {
    if (isLoggedIn) {
      router.push("/book");
    } else {
      router.push("/auth");
    }
  };

  return (
    <div className={styles.container}>
      <Canvas className={styles.canvas}>
        <Scene />
      </Canvas>

      {/* Splash overlay */}
      <div className={styles.overlay}>
        <div className={styles.splashCard}>
          {/* Wordmark */}
          <p className={styles.wordmark}>Raconteur</p>

          {/* Headphone icon */}
          <div className={styles.splashIcon}>
            <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2.2" width="52" height="52" aria-hidden="true">
              <path d="M8 28V24C8 15.163 15.163 8 24 8s16 7.163 16 16v4" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="4" y="26" width="8" height="14" rx="4" />
              <rect x="36" y="26" width="8" height="14" rx="4" />
            </svg>
          </div>

          <h1 className={styles.splashHeadline}>
            Best experienced<br />with headphones
          </h1>
          <p className={styles.splashSub}>
            Narration included. Best with headphones.
          </p>

          {/* Begin button */}
          <div className={styles.splashButtons}>
            <button
              className={styles.splashBtn}
              onClick={handleBegin}
              aria-label="Begin the story"
            >
              Begin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
