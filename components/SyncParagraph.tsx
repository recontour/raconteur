"use client";

import { useRef, useEffect, useMemo } from "react";
import styles from "./SyncParagraph.module.css";

export interface WordTiming {
  word: string;
  start: number;
  end: number;
}

interface LineTiming {
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

const MAX_WORDS = 6;

function splitIntoLines(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current: string[] = [];
  for (const word of words) {
    current.push(word);
    const sentenceEnd = /[.!?]['"]?$/.test(word);
    if (sentenceEnd || current.length >= MAX_WORDS) {
      lines.push(current.join(" "));
      current = [];
    }
  }
  if (current.length) lines.push(current.join(" "));
  return lines;
}

function buildLineTimings(
  lines: string[],
  duration: number,
  wordTimings?: WordTiming[] | null
): LineTiming[] {
  if (!duration) return lines.map(() => ({ start: -1, end: 0 }));
  if (wordTimings && wordTimings.length) {
    let wIdx = 0;
    return lines.map((line) => {
      const count = line.split(/\s+/).length;
      const first = wordTimings[wIdx];
      const last  = wordTimings[Math.min(wIdx + count - 1, wordTimings.length - 1)];
      wIdx += count;
      return { start: first ? first.start : 0, end: last ? last.end : duration };
    });
  }
  const total = lines.reduce((n, l) => n + l.split(/\s+/).length, 0);
  let elapsed = 0;
  return lines.map((line) => {
    const wc  = line.split(/\s+/).length;
    const dur = (wc / total) * duration;
    const t   = { start: elapsed, end: elapsed + dur };
    elapsed  += dur;
    return t;
  });
}

export default function SyncParagraph({
  text,
  currentTime,
  duration,
  wordTimings,
  isPlaying,
  isDark = false,
}: SyncParagraphProps) {
  const lines       = useMemo(() => splitIntoLines(text), [text]);
  const lineTimings = useMemo(
    () => buildLineTimings(lines, duration, wordTimings),
    [lines, duration, wordTimings]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const innerRef     = useRef<HTMLDivElement>(null);
  const lineRefs     = useRef<(HTMLDivElement | null)[]>([]);
  const lastActive   = useRef<number>(-99);

  useEffect(() => {
    lastActive.current = -99;
    if (innerRef.current) {
      innerRef.current.style.transition = "none";
      innerRef.current.style.transform  = "translateY(0)";
    }
    lineRefs.current.forEach((el) => {
      if (el) el.dataset.distance = "10";
    });
  }, [text, duration]);

  useEffect(() => {
    let target = 0;
    if (!duration || (!isPlaying && currentTime === 0)) {
      // No audio loaded, or audio ready but not yet started — preview the middle
      target = Math.floor(lines.length / 2);
    } else {
      for (let i = 0; i < lineTimings.length; i++) {
        if (lineTimings[i].start <= currentTime) target = i;
        else break;
      }
    }
    if (target === lastActive.current && duration !== 0) return;
    lastActive.current = target;

    lineRefs.current.forEach((el, i) => {
      if (!el) return;
      const d = Math.abs(i - target);
      el.dataset.distance = d >= 10 ? "10" : String(d);
    });

    const lineEl    = lineRefs.current[target];
    const inner     = innerRef.current;
    const container = containerRef.current;
    if (!lineEl || !inner || !container) return;

    const ty = container.clientHeight / 2 - lineEl.offsetTop - lineEl.clientHeight / 2;
    inner.style.transition = "transform 0.65s cubic-bezier(0.25, 1, 0.5, 1)";
    inner.style.transform  = `translateY(${ty}px)`;
  }, [currentTime, duration, isPlaying, lineTimings, lines.length]);

  return (
    <div
      ref={containerRef}
      className={`${styles.container} ${isDark ? styles.dark : ""}`}
    >
      <div ref={innerRef} className={styles.inner}>
        {lines.map((line, i) => (
          <div
            key={i}
            ref={(el) => { lineRefs.current[i] = el; }}
            className={styles.line}
            data-distance="10"
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}