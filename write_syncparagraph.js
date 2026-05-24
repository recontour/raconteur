const fs = require('fs');

const tsx = `"use client";

import { useMemo } from "react";
import styles from "./SyncParagraph.module.css";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface SyncParagraphProps {
  text: string;
  currentTime: number;
  duration: number;
  wordTimings?: WordTiming[] | null;
  isPlaying: boolean;
  isDark?: boolean;
}

export default function SyncParagraph({
  text,
  currentTime,
  duration,
  wordTimings,
  isDark = false,
}: SyncParagraphProps) {
  const words = useMemo(() => text.split(/\\s+/).filter(Boolean), [text]);

  // Index of the last word whose start time has passed (-1 = none yet)
  const currentIdx = useMemo(() => {
    if (!duration) return -1;

    const progress = Math.min(currentTime / duration, 1);
    if (progress >= 0.995) return words.length - 1; // all revealed

    if (wordTimings && wordTimings.length) {
      let idx = -1;
      for (let i = 0; i < wordTimings.length; i++) {
        if (wordTimings[i].start <= currentTime) idx = i;
        else break;
      }
      return idx;
    }

    // Linear fallback when no VTT timings
    return Math.floor(progress * words.length) - 1;
  }, [currentTime, duration, wordTimings, words.length]);

  return (
    <div className={\`\${styles.prose} \${isDark ? styles.dark : ""}\`}>
      {words.map((word, i) => {
        const spoken  = i <= currentIdx;
        const current = i === currentIdx;
        return (
          <span
            key={i}
            className={[
              styles.word,
              spoken  ? styles.spoken  : styles.unspoken,
              current ? styles.current : "",
            ].join(" ")}
          >
            {word}{" "}
          </span>
        );
      })}
    </div>
  );
}
`;

fs.writeFileSync('components/SyncParagraph.tsx', tsx);
console.log('Written', tsx.split('\n').length, 'lines');
