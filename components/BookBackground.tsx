"use client";

import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ─── Mood palette ────────────────────────────────────────────────────────────
// Maps story mood slug → [bg r,g,b  lineR,g,b]
const MOOD_COLORS: Record<string, { bg: [number, number, number]; line: [number, number, number] }> = {
  dawn:        { bg: [0.96, 0.92, 0.84], line: [0.70, 0.60, 0.45] },
  inquiry:     { bg: [0.94, 0.90, 0.82], line: [0.65, 0.55, 0.40] },
  philosophic: { bg: [0.91, 0.87, 0.80], line: [0.60, 0.52, 0.38] },
  vivid:       { bg: [0.95, 0.91, 0.82], line: [0.72, 0.62, 0.44] },
  pivot:       { bg: [0.78, 0.75, 0.72], line: [0.50, 0.45, 0.40] },
  descending:  { bg: [0.22, 0.20, 0.26], line: [0.35, 0.30, 0.40] },
  harrowing:   { bg: [0.10, 0.09, 0.13], line: [0.22, 0.18, 0.28] },
  revelation:  { bg: [0.12, 0.10, 0.16], line: [0.28, 0.22, 0.35] },
  moral:       { bg: [0.14, 0.12, 0.18], line: [0.30, 0.25, 0.38] },
  reckoning:   { bg: [0.13, 0.11, 0.17], line: [0.28, 0.22, 0.35] },
  impossible:  { bg: [0.08, 0.07, 0.10], line: [0.20, 0.16, 0.26] },
  departure:   { bg: [0.06, 0.06, 0.09], line: [0.16, 0.14, 0.22] },
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

  // ── Hash / noise helpers ──────────────────────────────────────────────────
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
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * smoothNoise(p);
      p  = p * 2.0 + vec2(1.7, 9.2);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;

    // ── Slow vertical scroll (simulates reading down a page) ─────────────
    float scroll = uTime * 0.018;

    // ── Paper grain ───────────────────────────────────────────────────────
    float grain = fbm(uv * 180.0 + vec2(uTime * 0.03, 0.0)) * 0.025;

    // ── Horizontal text lines ─────────────────────────────────────────────
    float lineY   = fract((uv.y + scroll) * 26.0);
    float line    = smoothstep(0.88, 0.96, lineY) * smoothstep(0.04, 0.0, lineY - 0.96);
    // Indent lines slightly from edges
    float xMask   = smoothstep(0.04, 0.09, uv.x) * smoothstep(0.04, 0.09, 1.0 - uv.x);
    // Vary line length — some "words" don't reach the right margin
    float lineLen = 0.75 + 0.25 * hash(vec2(floor((uv.y + scroll) * 26.0), 1.0));
    xMask        *= smoothstep(lineLen + 0.02, lineLen - 0.01, uv.x);
    line         *= xMask;

    // ── Left margin rule ─────────────────────────────────────────────────
    float margin     = smoothstep(0.055, 0.060, uv.x) * smoothstep(0.068, 0.063, uv.x);
    vec3  marginTint = mix(uBgColor, vec3(0.72, 0.25, 0.20), 0.35); // old-ink red

    // ── Vignette ─────────────────────────────────────────────────────────
    vec2  vig = uv * (1.0 - uv);
    float vignette = pow(vig.x * vig.y * 12.0, 0.38);
    vignette = clamp(vignette, 0.55, 1.0);

    // ── Assemble colour ───────────────────────────────────────────────────
    vec3 col = uBgColor + grain;
    col = mix(col, uLineColor, line * 0.18);
    col = mix(col, marginTint, margin * 0.25);
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
