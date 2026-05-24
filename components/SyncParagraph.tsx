"use client";

import { useMemo, useRef, useLayoutEffect } from "react";
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
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

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

  // Refs for scroll-to-center
  const clipRef  = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  // Keep wordRefs array sized correctly
  wordRefs.current.length = words.length;

  // Translate inner div so the current word sits at ~42% of the clip area
  useLayoutEffect(() => {
    const inner = innerRef.current;
    const clip  = clipRef.current;
    if (!inner || !clip) return;

    if (currentIdx < 0) {
      inner.style.transform = "translateY(0px)";
      return;
    }

    const el = wordRefs.current[currentIdx];
    if (!el) return;

    const clipH   = clip.clientHeight;
    const wordTop = el.offsetTop;          // relative to inner (position:relative)
    const wordH   = el.offsetHeight || 18; // fallback for inline elements

    // Target: put the middle of the current word at 42 % of the clip height
    const desired = clipH * 0.42 - (wordTop + wordH / 2);
    const maxY    = 0;                             // never scroll past the top
    const minY    = clipH - inner.scrollHeight;    // never expose blank below
    const offset  = Math.max(minY, Math.min(maxY, desired));

    inner.style.transform = `translateY(${offset}px)`;
  }, [currentIdx]);

  return (
    <div
      ref={clipRef}
      className={`${styles.proseClip} ${isDark ? styles.dark : ""}`}
    >
      <div ref={innerRef} className={styles.proseInner}>
        {words.map((word, i) => {
          const spoken  = i <= currentIdx;
          const current = i === currentIdx;
          return (
            <span
              key={i}
              ref={(el) => { wordRefs.current[i] = el; }}
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
    </div>
  );
}
