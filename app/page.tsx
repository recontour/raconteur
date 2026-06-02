"use client";
import { useState } from "react";
import StoryInterface from "@/components/StoryInterface";
import SummerRing from "@/components/SummerRing";

export default function Home() {
  const [fading,   setFading]   = useState(false);
  const [gone,     setGone]     = useState(false);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);

  const dismiss = () => {
    // Build AudioContext + AnalyserNode, connect Summer001 through it
    try {
      const ctx  = new AudioContext();
      const an   = ctx.createAnalyser();
      an.fftSize            = 512;   // 256 frequency bins
      an.smoothingTimeConstant = 0.82;
      an.connect(ctx.destination);

      const audio = new Audio("/audio/Summer001.mp3");
      const src   = ctx.createMediaElementSource(audio);
      src.connect(an);
      audio.volume = 0.55;
      audio.play().catch(() => {});

      setAnalyser(an);
    } catch {
      // AudioContext blocked — silent fallback
    }

    setFading(true);
    setTimeout(() => setGone(true), 620);
  };

  return (
    <>
      <StoryInterface />

      {!gone && (
        <div
          onClick={dismiss}
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "#000",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            transition: "opacity 0.62s ease",
            opacity: fading ? 0 : 1,
            pointerEvents: fading ? "none" : "auto",
          }}
        >
          <div style={{ position: "relative", width: 240, height: 240 }}>
            <SummerRing active={true} size={240} analyser={analyser} />
            <img
              src="/favicon.ico"
              alt=""
              style={{
                position: "absolute", top: "50%", left: "50%",
                transform: "translate(-50%,-50%)",
                width: 76, height: 76,
                objectFit: "contain", zIndex: 2,
                borderRadius: 14,
                filter: "drop-shadow(0 0 22px rgba(0,190,255,0.8))",
                pointerEvents: "none",
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}



