"use client";

import { Canvas, useFrame } from "@react-three/fiber";
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
