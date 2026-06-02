"use client";

import { useRef, useEffect } from "react";

// ── Vertex ────────────────────────────────────────────────────────────────────
const VERT = "attribute vec2 p;varying vec2 vUv;void main(){vUv=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}";

// ── Fragment — audio-warped polar waveform ring ───────────────────────────────
const FRAG = `
  precision mediump float;
  uniform float     uTime;
  uniform float     uActivity;   // 0=idle → 1=audio live
  uniform sampler2D uFreq;       // 256×1 LUMINANCE, values 0..1
  varying vec2      vUv;

  #define TAU 6.28318530718

  // 5-tap smoothed frequency lookup
  float sampleFreq(float ta) {
    float du = 1.0 / 256.0;
    return texture2D(uFreq, vec2(ta,          0.5)).r * 0.40
         + texture2D(uFreq, vec2(ta + du,     0.5)).r * 0.20
         + texture2D(uFreq, vec2(ta - du,     0.5)).r * 0.20
         + texture2D(uFreq, vec2(ta + du*2.0, 0.5)).r * 0.10
         + texture2D(uFreq, vec2(ta - du*2.0, 0.5)).r * 0.10;
  }

  void main() {
    vec2  p     = vUv - 0.5;
    float d     = length(p);
    float angle = atan(p.y, p.x);
    float ta    = angle / TAU + 0.5;          // 0..1 around circle

    float freq  = sampleFreq(ta);

    // ── Warp the ring radius with audio ────────────────────────────
    float breathe = sin(uTime * 1.1 + ta * 3.0) * 0.010 * (1.0 - uActivity);
    float warp    = freq * 0.22 * uActivity;   // up to ±22% radius shift
    float r       = 0.38 + breathe + warp;

    // ── Draw the deformed ring ──────────────────────────────────────
    float dist  = abs(d - r);
    float thick = 0.007 + freq * 0.016 * uActivity;   // thicker at peaks
    float ring  = smoothstep(thick, 0.0, dist);

    // Inner fill for large warp peaks (makes it look solid/blobby)
    float fill  = smoothstep(0.0, r, d) * (1.0 - smoothstep(r, r + 0.001, d))
                * freq * uActivity * 0.18;

    // ── Glow ────────────────────────────────────────────────────────
    float glow  = exp(-16.0 * dist) * (0.22 + freq * uActivity * 0.80);
    float bloom = exp(-4.5  * dist) * freq * uActivity * 0.30;

    // ── Idle radar sweep (fades out as audio kicks in) ───────────────
    float sweep = mod(angle - uTime * 0.7, TAU);
    float scan  = exp(-5.5 * sweep)
                * smoothstep(0.06, 0.0, dist)
                * (1.0 - uActivity) * 0.70;

    // ── Colour ──────────────────────────────────────────────────────
    // Shifts from deep blue → electric cyan → near-white at peaks
    vec3  cBase  = vec3(0.10, 0.45, 1.00);
    vec3  cPeak  = vec3(0.75, 0.97, 1.00);
    vec3  cBloom = vec3(0.02, 0.28, 0.90);
    vec3  cScan  = vec3(0.18, 0.68, 1.00);

    vec3  cRing  = mix(cBase, cPeak, freq * uActivity);
    vec3  col    = cRing  * (ring + glow * 0.75)
                 + cBloom * bloom
                 + fill   * cBase
                 + cScan  * scan;
    float alpha  = clamp(ring + glow * 0.85 + bloom * 0.55 + fill + scan * 0.75, 0.0, 1.0);

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

    // 256×1 luminance frequency texture
    const freqTex  = gl.createTexture()!;
    const freqData = new Uint8Array(FREQ_BINS);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, freqTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, FREQ_BINS, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, freqData);

    const tLoc    = gl.getUniformLocation(prog, "uTime");
    const actLoc  = gl.getUniformLocation(prog, "uActivity");
    const freqLoc = gl.getUniformLocation(prog, "uFreq");
    gl.uniform1i(freqLoc, 0);

    let raf = 0, activity = 0;
    const tick = (t: number) => {
      activity += ((activeRef.current ? 1 : 0) - activity) * 0.055;

      const an = analyserRef.current;
      if (an) {
        an.getByteFrequencyData(freqData);
      } else {
        freqData.fill(0);
      }
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, freqTex);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, FREQ_BINS, 1, gl.LUMINANCE, gl.UNSIGNED_BYTE, freqData);

      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(tLoc,   t * 0.001);
      gl.uniform1f(actLoc, activity);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      gl.deleteTexture(freqTex);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={size * 2}
      height={size * 2}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }}
    />
  );
}

