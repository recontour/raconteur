"use client";

import { useState, useEffect } from "react";
import AudioPlayer from "./AudioPlayer";
import BookBackground from "./BookBackground";
import SyncParagraph, { WordTiming } from "./SyncParagraph";
import styles from "./BookReader.module.css";
import { useMoodMusic } from "@/hooks/useMoodMusic";

// ─── Types ───────────────────────────────────────────────────────────────────
interface Story {
  id: number;
  slug?: string;
  title: string;
  paragraph: string;
  mood?: string;
  audioFile: string;
  vttFile?: string;          // path to WebVTT word-timing file e.g. /audio/par001.vtt
  duration: number;
  wordTimings?: WordTiming[] | null;
  subtitles: Array<{ time: number; text: string }>;
}

interface BookReaderProps {
  stories: Story[];
}

// ─── VTT parser ─────────────────────────────────────────────────────────────
// Also handles multi-word cues by splitting on whitespace.
function parseVttTime(t: string): number {
  const parts = t.trim().split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + parts[1];
}

async function loadVtt(url: string): Promise<WordTiming[]> {
  const text = await fetch(url).then((r) => r.text());
  const timings: WordTiming[] = [];
  // Split on blank lines to get cue blocks
  const blocks = text.split(/\n\s*\n/);
  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const timeLine = lines.find((l) => l.includes("-->"));
    if (!timeLine) continue;
    const [startStr, endStr] = timeLine.split("-->");
    const start = parseVttTime(startStr);
    const end   = parseVttTime(endStr);
    // Content is every line after the timestamp
    const content = lines
      .slice(lines.indexOf(timeLine) + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "") // strip any VTT inline tags
      .trim();
    if (!content) continue;
    // Split multi-word cues evenly
    const words = content.match(/\S+/g) ?? [];
    const dt = (end - start) / words.length;
    words.forEach((word, i) => {
      timings.push({ word, start: start + i * dt, end: start + (i + 1) * dt });
    });
  }
  return timings;
}

const DARK_MOODS = new Set([
  "descending", "harrowing", "revelation",
  "moral", "reckoning", "impossible", "departure",
]);

// ─── Component ───────────────────────────────────────────────────────────────
export default function BookReader({ stories }: BookReaderProps) {
  const [page, setPage] = useState(0);

  // ── Audio sync state ───────────────────────────────────────────────────
  const [audioTime, setAudioTime]         = useState(0);
  const [audioDuration, setAudioDur]      = useState(0);
  const [isPlaying, setIsPlaying]         = useState(false);
  const [audioEnded, setAudioEnded]       = useState(false);
  const [loadedTimings, setLoadedTimings] = useState<WordTiming[] | null>(null);

  // Reset audio state + load VTT when page changes
  useEffect(() => {
    setAudioTime(0);
    setAudioDur(0);
    setIsPlaying(false);
    setAudioEnded(false);
    setLoadedTimings(null);

    const story = stories[page];
    if (story?.vttFile) {
      loadVtt(story.vttFile)
        .then(setLoadedTimings)
        .catch(() => setLoadedTimings(null));
    }
  }, [page, stories]);

  // ── Keyboard navigation (dev convenience) ───────────────────────────────
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") setPage((p) => Math.min(p + 1, stories.length - 1));
      if (e.key === "ArrowUp")   setPage((p) => Math.max(p - 1, 0));
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [stories.length]);

  const total   = stories.length;
  const current = stories[page];

  const { enabled: musicOn, toggle: toggleMusic } = useMoodMusic(current.mood ?? "dawn");

  return (
    <div className={styles.root}>
      {/* WebGL parchment background */}
      <BookBackground mood={current.mood ?? "dawn"} />

      {/* Portrait 480px frame */}
      <div className={styles.frame}>

        {/* Page counter — top right, like a book header */}
        <div className={styles.pageCounter}>
          {String(page + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </div>

        {/* Ambient music toggle — top left */}
        <button
          className={styles.musicToggle}
          onClick={toggleMusic}
          aria-label={musicOn ? "Mute ambient music" : "Play ambient music"}
          aria-pressed={musicOn}
        >
          {musicOn ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
              <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
              <path d="M9 18V5l12-2v13" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
              <line x1="3" y1="3" x2="21" y2="21" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {stories.map((story, idx) => {
          const isDark   = DARK_MOODS.has(story.mood ?? "");
          const isActive = idx === page;
          // Only render prev/current/next to keep DOM lean
          const isNear   = Math.abs(idx - page) <= 1;

          return (
            <div
              key={story.id}
              className={styles.card}
              data-dark={isDark ? "true" : "false"}
              style={{
                opacity:       isActive ? 1 : 0,
                pointerEvents: isActive ? "auto" : "none",
                transition:    "opacity 0.4s ease",
              }}
              aria-hidden={!isActive}
            >
              {isNear && (
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

                  {/* Chapter heading */}
                  <div className={styles.chapterRow}>
                    <h2 className={styles.chapterTitle}>{story.title}</h2>
                  </div>

                  {/* Word-sync teleprompter */}
                  <SyncParagraph
                    text={story.paragraph}
                    currentTime={isActive ? audioTime     : 0}
                    duration={   isActive ? audioDuration : 0}
                    isPlaying={  isActive ? isPlaying     : false}
                    wordTimings={isActive ? (loadedTimings ?? story.wordTimings ?? null) : null}
                    isDark={isDark}
                  />

                  {/* Audio player dock or Next Chapter — active card only */}
                  {isActive && (
                    <div className={styles.playerDock}>
                      {audioEnded ? (
                        page < total - 1 ? (
                          <button
                            className={styles.nextChapter}
                            onClick={() => setPage(page + 1)}
                          >
                            Next Chapter
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="16" height="16">
                              <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </button>
                        ) : (
                          <div className={styles.theEnd}>— The End —</div>
                        )
                      ) : (
                        <AudioPlayer
                          audioSrc={story.audioFile}
                          title={story.title}
                          subtitles={story.subtitles}
                          onTimeUpdate={setAudioTime}
                          onDurationChange={setAudioDur}
                          onPlayChange={setIsPlaying}
                          onEnded={() => setAudioEnded(true)}
                        />
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
