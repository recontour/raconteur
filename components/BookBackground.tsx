"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Mood palette ────────────────────────────────────────────────────────────
// Maps story mood slug → [bg r,g,b  lineR,g,b]
const MOOD_COLORS: Record<string, { bg: [number, number, number]; line: [number, number, number] }> = {
  dawn:        { bg: [0.93, 0.86, 0.71], line: [0.62, 0.48, 0.28] },
  inquiry:     { bg: [0.91, 0.84, 0.69], line: [0.58, 0.45, 0.26] },
  philosophic: { bg: [0.89, 0.82, 0.67], line: [0.56, 0.43, 0.25] },
  vivid:       { bg: [0.92, 0.85, 0.70], line: [0.60, 0.47, 0.27] },
  pivot:       { bg: [0.74, 0.68, 0.58], line: [0.45, 0.37, 0.25] },
  descending:  { bg: [0.16, 0.12, 0.08], line: [0.30, 0.22, 0.14] },
  harrowing:   { bg: [0.09, 0.07, 0.05], line: [0.20, 0.14, 0.09] },
  revelation:  { bg: [0.11, 0.08, 0.06], line: [0.24, 0.17, 0.11] },
  moral:       { bg: [0.13, 0.10, 0.07], line: [0.26, 0.19, 0.13] },
  reckoning:   { bg: [0.12, 0.09, 0.06], line: [0.24, 0.17, 0.11] },
  impossible:  { bg: [0.07, 0.05, 0.04], line: [0.18, 0.12, 0.08] },
  departure:   { bg: [0.05, 0.04, 0.03], line: [0.14, 0.10, 0.07] },
};

const DEFAULT_MOOD = MOOD_COLORS.dawn;

// ─── GLSL shaders ────────────────────────────────────────────────────────────
const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision mediump float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec3  uBgColor;
  uniform vec3  uLineColor;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float smoothNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),               hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * smoothNoise(p);
      p  = p * 2.1 + vec2(1.7, 9.2);
      a *= 0.48;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float scroll = uTime * 0.015;

    // ── Paper grain — two scales for depth ────────────────────────────────
    float grain = fbm(uv * 210.0 + vec2(uTime * 0.02, 0.0)) * 0.020
                + fbm(uv * 75.0  + vec2(0.0, uTime * 0.008)) * 0.012;

    // ── Paper fiber — faint horizontal striations ─────────────────────────
    float fiber = smoothNoise(vec2(uv.x * 35.0, uv.y * 350.0)) * 0.007;

    // ── Ghost text lines — impression from previous page ──────────────────
    float lineY  = fract((uv.y + scroll) * 26.0);
    float line   = smoothstep(0.87, 0.95, lineY) * smoothstep(0.04, 0.0, lineY - 0.95);
    float xMask  = smoothstep(0.06, 0.11, uv.x) * smoothstep(0.05, 0.10, 1.0 - uv.x);
    float lineLen = 0.72 + 0.28 * hash(vec2(floor((uv.y + scroll) * 26.0), 1.0));
    xMask *= smoothstep(lineLen + 0.02, lineLen - 0.01, uv.x);
    line  *= xMask;

    // ── Foxing — scattered age spots ──────────────────────────────────────
    float foxing = 0.0;
    for (int i = 0; i < 14; i++) {
      float fi = float(i);
      vec2 center = vec2(hash(vec2(fi * 0.91, 0.31)) * 0.80 + 0.10,
                         hash(vec2(fi * 0.73, 1.83)) * 0.80 + 0.10);
      float r  = 0.010 + hash(vec2(fi, 5.1)) * 0.022;
      float el = 1.0   + hash(vec2(fi, 7.3)) * 0.60;
      vec2  d  = (uv - center) * vec2(1.0, el);
      float spot = smoothstep(r, r * 0.2, length(d));
      foxing += spot * (0.03 + hash(vec2(fi, 3.3)) * 0.09);
    }

    // ── Book spine — shadow on left binding edge ──────────────────────────
    float spine = smoothstep(0.0, 0.09, uv.x) * 0.32;

    // ── Right page-edge curl shadow ───────────────────────────────────────
    float curl = smoothstep(1.0, 0.94, uv.x) * 0.16;

    // ── Left margin rule (old red-brown ink) ──────────────────────────────
    float margin     = smoothstep(0.055, 0.061, uv.x) * smoothstep(0.070, 0.064, uv.x);
    vec3  marginTint = mix(uBgColor, vec3(0.62, 0.18, 0.12), 0.5);

    // ── Vignette ──────────────────────────────────────────────────────────
    vec2  vig = uv * (1.0 - uv);
    float vignette = pow(vig.x * vig.y * 14.0, 0.32);
    vignette = clamp(vignette, 0.42, 1.0);

    // ── Assemble ──────────────────────────────────────────────────────────
    vec3 col = uBgColor + grain + fiber;
    col = mix(col, uLineColor, line * 0.13);
    col = mix(col, uLineColor * 0.55, foxing);
    col = mix(col, marginTint, margin * 0.30);
    col *= (1.0 - spine);
    col *= (1.0 - curl);
    col *= vignette;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

// ─── Inner mesh that animates ────────────────────────────────────────────────
function ParchmentPlane({ bgColor, lineColor }: {
  bgColor: THREE.Color;
  lineColor: THREE.Color;
}) {
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime:      { value: 0 },
    uBgColor:   { value: bgColor.clone() },
    uLineColor: { value: lineColor.clone() },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(({ clock }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.getElapsedTime();
    // Lerp toward target colours for smooth mood transitions
    matRef.current.uniforms.uBgColor.value.lerp(bgColor, 0.04);
    matRef.current.uniforms.uLineColor.value.lerp(lineColor, 0.04);
  });

  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
      />
    </mesh>
  );
}

// ─── Public component ────────────────────────────────────────────────────────
interface BookBackgroundProps {
  mood?: string;
  style?: React.CSSProperties;
}

export default function BookBackground({ mood = "dawn", style }: BookBackgroundProps) {
  const palette  = MOOD_COLORS[mood] ?? DEFAULT_MOOD;
  const bgColor   = useMemo(() => new THREE.Color(...palette.bg),   [palette]);
  const lineColor = useMemo(() => new THREE.Color(...palette.line), [palette]);

  return (
    <Canvas
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        ...style,
      }}
      orthographic
      camera={{ near: -1, far: 1, zoom: 1 }}
      gl={{ antialias: false, powerPreference: "low-power" }}
      dpr={[1, 1.5]}
    >
      <ParchmentPlane bgColor={bgColor} lineColor={lineColor} />
    </Canvas>
  );
}
