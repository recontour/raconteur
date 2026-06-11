"use client";

import { useRef, useEffect } from "react";

// ── Vertex ────────────────────────────────────────────────────────────────────
const VERT = "attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}";

// ── Fragment — mist ring driven by bass/mid/treble bands ─────────────────────
// bass  → ring radius pulses (whole ring breathes)
// treble → mist edge trembles (fine shimmer across the ring)
// mid   → overall mist density boost
const FRAG = `
  precision mediump float;
  uniform float uTime;
  uniform float uActivity;  // 0 = idle, 1 = audio live
  uniform float uBass;      // 0..1 low-frequency energy
  uniform float uMid;       // 0..1 midrange energy
  uniform float uTreble;    // 0..1 high-frequency energy
  varying vec2  vUv;

  #define TAU 6.28318530718

  void main() {
    vec2  p     = vUv - 0.5;
    float d     = length(p);
    float angle = atan(p.y, p.x);
    float ta    = angle / TAU + 0.5;

    // ── Idle shimmer — backs off when audio active ────────────────────
    float shimmer = (sin(uTime * 1.083) * 0.5 + 0.5)
                  * (sin(uTime * 0.37 + 1.2) * 0.3 + 0.7)
                  * (1.0 - uActivity * 0.85);

    // ── Bass: whole ring breathes in/out uniformly ────────────────────
    float r = 0.385 + shimmer * 0.002 + uBass * uActivity * 0.022;

    // ── Treble: fine fast trembling of the ring edge ──────────────────
    // High-frequency angular ripple, tiny amplitude — feels like shimmer
    float tremble = sin(ta * TAU * 31.0 + uTime * 9.0) * 0.0028
                  + sin(ta * TAU * 47.0 - uTime * 13.0) * 0.0018;
    r += tremble * uTreble * uActivity;

    // ── Mist band Gaussian ────────────────────────────────────────────
    float dist  = d - r;
    float sigma = 0.022 + shimmer * 0.003 + uTreble * uActivity * 0.008;
    float gauss = exp(-0.5 * dist * dist / (sigma * sigma));

    // ── Mist density: mid lifts the overall brightness/opacity ───────
    float mistBase  = gauss * (0.75 + shimmer * 0.20);
    float mistAudio = gauss * (0.60 + uMid * 0.40) * uActivity;
    float mist = mistBase + mistAudio;

    // ── Squared alpha kills white-halo at soft edges ──────────────────
    float alpha = clamp(mist * mist * 1.15, 0.0, 0.90);

    vec3 col = vec3(0.10, 0.55, 0.95);
    gl_FragColor = vec4(col, alpha);
  }
`;

const FREQ_BINS = 256;

export default function SummerRing({
  active,
  size     = 64,
  analyser = null,
}: {
  active:    boolean;
  size?:     number;
  analyser?: AnalyserNode | null;
}) {
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const activeRef   = useRef(active);
  const analyserRef = useRef(analyser);

  useEffect(() => { activeRef.current   = active;   }, [active]);
  useEffect(() => { analyserRef.current = analyser; }, [analyser]);

  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const gl = cvs.getContext("webgl", { alpha: true });
    if (!gl) return;

    // Compile helpers
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER,   VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    // Full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const pLoc = gl.getAttribLocation(prog, "p");
    gl.enableVertexAttribArray(pLoc);
    gl.vertexAttribPointer(pLoc, 2, gl.FLOAT, false, 0, 0);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    // Frequency band analysis — 3 scalar uniforms replace the texture
    const freqData = new Uint8Array(FREQ_BINS);
    const avg = (lo: number, hi: number) => {
      let s = 0; for (let i = lo; i < hi; i++) s += freqData[i];
      return s / ((hi - lo) * 255);
    };

    const tLoc      = gl.getUniformLocation(prog, "uTime");
    const actLoc    = gl.getUniformLocation(prog, "uActivity");
    const bassLoc   = gl.getUniformLocation(prog, "uBass");
    const midLoc    = gl.getUniformLocation(prog, "uMid");
    const trebleLoc = gl.getUniformLocation(prog, "uTreble");

    let raf = 0, activity = 0;
    const tick = (t: number) => {
      activity += ((activeRef.current ? 1 : 0) - activity) * 0.055;

      const an = analyserRef.current;
      if (an) an.getByteFrequencyData(freqData);
      else    freqData.fill(0);

      // bins at fftSize 512, ~86Hz each: bass 0-8 (0-700Hz), mid 8-60 (700-5kHz), treble 60-150 (5-13kHz)
      const bass   = avg(1,  9);
      const mid    = avg(9,  60);
      const treble = avg(60, 150);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(tLoc,      t * 0.001);
      gl.uniform1f(actLoc,    activity);
      gl.uniform1f(bassLoc,   bass);
      gl.uniform1f(midLoc,    mid);
      gl.uniform1f(trebleLoc, treble);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 1 }}
    />
  );
}

