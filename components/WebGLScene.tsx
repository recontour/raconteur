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

export default function WebGLScene_({
  isLoggedIn,
  user,
  onLogout,
  onLogin,
}: WebGLSceneProps) {
  const router = useRouter();

  return (
    <div className={styles.container}>
      <Canvas className={styles.canvas}>
        <Scene />
      </Canvas>

      {/* UI Overlay */}
      <div className={styles.overlay}>
        <div className={styles.content}>
          {/* Header */}
          <div className={styles.header}>
            {isLoggedIn && user ? (
              <div className={styles.userInfo}>
                <div className={styles.userIcon}>👤</div>
                <div className={styles.userDetails}>
                  <p className={styles.userName}>
                    {user.email || user.phoneNumber || "User"}
                  </p>
                  <p className={styles.userStatus}>Signed in</p>
                </div>
              </div>
            ) : (
              <p className={styles.signInPrompt}>Sign in to continue</p>
            )}
          </div>

          {/* Actions */}
          <div className={styles.actions}>
            {isLoggedIn ? (
              <>
                <button
                  onClick={() => router.push("/book")}
                  className={`${styles.button} ${styles.storiesButton}`}
                >
                  <span className={styles.buttonLabel}>📖 Stories</span>
                </button>
                <button
                  onClick={onLogout}
                  className={`${styles.button} ${styles.logoutButton}`}
                >
                  <span className={styles.buttonLabel}>Sign Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={onLogin}
                className={`${styles.button} ${styles.loginButton}`}
              >
                <span className={styles.buttonLabel}>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
