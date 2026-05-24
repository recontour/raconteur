"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
} from "react";
import AudioPlayer from "./AudioPlayer";
import BookBackground from "./BookBackground";
import styles from "./BookReader.module.css";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Story {
  id: number;
  slug?: string;
  title: string;
  paragraph: string;
  mood?: string;
  audioFile: string;
  duration: number;
  subtitles: Array<{ time: number; text: string }>;
}

interface BookReaderProps {
  stories: Story[];
}

// ─── Physics constants ───────────────────────────────────────────────────────
const FLING_THRESHOLD = 0.4;   // px/ms — velocity to flip page
const DRAG_RESISTANCE = 0.35;  // visual drag follow
const SPRING_DURATION = 520;   // ms for snap
const SPRING_EASING   = "cubic-bezier(0.22, 1, 0.36, 1)";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function BookReader({ stories }: BookReaderProps) {
  const [page, setPage]      = useState(0);
  const [dragging, setDrag]  = useState(false);
  const [dragOffset, setOff] = useState(0);

  const touch = useRef({
    startY: 0, lastY: 0,
    startTime: 0, lastTime: 0,
    velocity: 0,
  });

  const trackRef  = useRef<HTMLDivElement>(null);
  const animating = useRef(false);

  const total      = stories.length;
  const current    = stories[page];
  const cardHeight = typeof window !== "undefined" ? window.innerHeight : 800;

  // ── Animate to target page ───────────────────────────────────────────────
  const snapTo = useCallback(
    (targetPage: number, velocity: number) => {
      if (animating.current) return;
      const clamped = clamp(targetPage, 0, total - 1);
      animating.current = true;
      setOff(0);
      const speedFactor = clamp(Math.abs(velocity) / FLING_THRESHOLD, 0.6, 1.4);
      const duration    = Math.round(SPRING_DURATION / speedFactor);
      if (trackRef.current) {
        trackRef.current.style.transition = `transform ${duration}ms ${SPRING_EASING}`;
      }
      setPage(clamped);
      setTimeout(() => {
        animating.current = false;
        if (trackRef.current) trackRef.current.style.transition = "";
      }, duration + 20);
    },
    [total]
  );

  // ── Touch handlers ───────────────────────────────────────────────────────
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (animating.current) return;
    const t = e.touches[0];
    touch.current = {
      startY: t.clientY, lastY: t.clientY,
      startTime: e.timeStamp, lastTime: e.timeStamp,
      velocity: 0,
    };
    setDrag(true);
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!dragging) return;
      const t  = e.touches[0];
      const dy = t.clientY - touch.current.lastY;
      const dt = Math.max(e.timeStamp - touch.current.lastTime, 1);
      touch.current.velocity = dy / dt;
      touch.current.lastY    = t.clientY;
      touch.current.lastTime = e.timeStamp;
      const totalDelta = t.clientY - touch.current.startY;
      const bounded =
        (page === 0 && totalDelta > 0) || (page === total - 1 && totalDelta < 0)
          ? totalDelta * 0.18
          : totalDelta * DRAG_RESISTANCE;
      setOff(bounded);
    },
    [dragging, page, total]
  );

  const onTouchEnd = useCallback(() => {
    if (!dragging) return;
    setDrag(false);
    const v         = touch.current.velocity;
    const totalDrag = touch.current.lastY - touch.current.startY;
    if (v < -FLING_THRESHOLD || totalDrag < -cardHeight * 0.25) {
      snapTo(page + 1, Math.abs(v));
    } else if (v > FLING_THRESHOLD || totalDrag > cardHeight * 0.25) {
      snapTo(page - 1, Math.abs(v));
    } else {
      setOff(0);
    }
  }, [dragging, cardHeight, page, snapTo]);

  // ── Keyboard (desktop dev convenience) ──────────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") snapTo(page + 1, 1);
      if (e.key === "ArrowUp")   snapTo(page - 1, 1);
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [page, snapTo]);

  // ── Prevent scroll bleed ─────────────────────────────────────────────────
  useEffect(() => {
    const prevent = (e: TouchEvent) => { if (dragging) e.preventDefault(); };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => document.removeEventListener("touchmove", prevent);
  }, [dragging]);

  const renderIndices = [page - 1, page, page + 1].filter(
    (i) => i >= 0 && i < total
  );

  const translateY = -page * cardHeight + dragOffset;

  return (
    <div className={styles.root}>
      {/* WebGL parchment background */}
      <BookBackground mood={current.mood ?? "dawn"} />

      {/* Portrait 480px frame */}
      <div className={styles.frame}>
        {/* Swipeable card track */}
        <div
          className={styles.track}
          ref={trackRef}
          style={{ transform: `translateY(${translateY}px)` }}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {stories.map((story, idx) => {
            const distance = Math.abs(idx - page);
            const scale    = 1 - distance * 0.04;
            const opacity  = distance === 0 ? 1 : distance === 1 ? 0.55 : 0;

            return (
              <div
                key={story.id}
                className={styles.card}
                style={{
                  transform: `scale(${scale})`,
                  opacity,
                  visibility: renderIndices.includes(idx) ? "visible" : "hidden",
                  pointerEvents: idx === page ? "auto" : "none",
                }}
                aria-hidden={idx !== page}
              >
                <div className={styles.cardInner}>
                  {/* Book header — first card only */}
                  {idx === 0 && (
                    <div className={styles.bookHeader}>
                      <div className={styles.bookHeaderLine} />
                      <p className={styles.bookMeta}>Ursula K. Le Guin</p>
                      <h1 className={styles.bookTitle}>
                        The Ones Who Walk Away from Omelas
                      </h1>
                      <div className={styles.bookHeaderLine} />
                    </div>
                  )}

                  {/* Chapter row */}
                  <div className={styles.chapterRow}>
                    <span className={styles.chapterNum}>
                      {String(idx + 1).padStart(2, "0")} /{" "}
                      {String(total).padStart(2, "0")}
                    </span>
                    <h2 className={styles.chapterTitle}>{story.title}</h2>
                  </div>

                  {/* Scrollable paragraph text */}
                  <div className={styles.textScroll}>
                    <p className={styles.paragraph}>{story.paragraph}</p>
                  </div>

                  {/* Audio player dock */}
                  <div className={styles.playerDock}>
                    <AudioPlayer
                      audioSrc={story.audioFile}
                      title={story.title}
                      subtitles={story.subtitles}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress rail */}
        <div className={styles.progressRail}>
          {stories.map((_, idx) => (
            <button
              key={idx}
              className={`${styles.pip} ${idx === page ? styles.pipActive : ""}`}
              onClick={() => snapTo(idx, 1)}
              aria-label={`Paragraph ${idx + 1}`}
            />
          ))}
        </div>

        {/* Swipe hint on first load */}
        {page === 0 && !dragging && (
          <div className={styles.swipeHint} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span>Swipe to read</span>
          </div>
        )}
      </div>
    </div>
  );
}
