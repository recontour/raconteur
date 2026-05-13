"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import REELS from "@/lib/reels";

export default function ReelStrip({
  scrollRef,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { scrollY } = useScroll({ container: scrollRef });
  const glassOpacity = useTransform(scrollY, [40, 220], [0, 1]);

  if (REELS.length === 0) return null;

  const entry = REELS[0];

  return (
    <div style={{ paddingTop: 56 }}>
      <div
        className="sticky top-14 z-0 overflow-hidden"
        style={{ height: "calc(100dvh - 56px)" }}
      >
      <iframe
        src={`https://www.instagram.com/reel/${entry.shortcode}/embed/`}
        frameBorder={0}
        scrolling="no"
        allow="encrypted-media"
        title={entry.caption ?? `Instagram Reel ${entry.shortcode}`}
        style={{
          position: "absolute",
          top: -58,
          left: 0,
          width: "100%",
          height: "calc(100% + 168px)",
        }}
      />
      <motion.div
        className="absolute inset-0 bg-white/10 backdrop-blur-[3px]"
        style={{ opacity: glassOpacity }}
      />
    </div>
    </div>
  );
}
