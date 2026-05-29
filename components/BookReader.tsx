"use client";

import { useState, useEffect, useRef } from "react";
import AudioPlayer from "./AudioPlayer";
import BookBackground from "./BookBackground";
import SyncParagraph, { WordTiming } from "./SyncParagraph";
import styles from "./BookReader.module.css";
import { useAuth } from "@/app/helper/auth";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { getStoryProgress, saveStoryProgress } from "@/app/actions/user";

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
const PROGRESS_KEY = "raconteur_progress";

export default function BookReader({ stories }: BookReaderProps) {
  const [page, setPage] = useState(0);

  // Ref holds the time to seek to when the restored page's AudioPlayer mounts.
  // Cleared to 0 after any manual navigation so new pages always start from 0.
  const initialTimeRef       = useRef(0);
  const didNavigate          = useRef(false);
  const dbSaveTimerRef       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRestoredRef  = useRef(false);
  const pickerRef            = useRef<HTMLDivElement>(null);

  const [maxPage, setMaxPage]       = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Track the highest page ever visited to unlock chapter picker
  useEffect(() => {
    setMaxPage((m) => Math.max(m, page));
  }, [page]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node))
        setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  // ── Restore progress: DB first, localStorage fallback ─────────────────
  useEffect(() => {
    const restore = async () => {
      let progress: { page: number; time: number } | null = null;

      if (user) {
        progress = await getStoryProgress(user.uid);
      }

      if (!progress) {
        try {
          const raw = localStorage.getItem(PROGRESS_KEY);
          if (raw) progress = JSON.parse(raw) as { page: number; time: number };
        } catch {}
      }

      if (progress) {
        const { page: p, time: t } = progress;
        if (typeof p === "number" && p >= 0 && p < stories.length) {
          initialTimeRef.current = typeof t === "number" && t > 0 ? t : 0;
          if (p !== 0) setPage(p);
        }
      }
      progressRestoredRef.current = true;
    };
    restore();
    return () => {
      if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persist progress to localStorage + DB (debounced 8s) ──────────────
  const persistProgress = (p: number, t: number) => {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ page: p, time: t })); } catch {}
    if (!user) return;
    if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(() => {
      saveStoryProgress(user.uid, p, t);
    }, 8000);
  };

  // ── Save immediately to DB on manual page navigation ──────────────────
  const navigate = (p: number) => {
    didNavigate.current = true;
    setPage(p);
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ page: p, time: 0 })); } catch {}
    if (user && progressRestoredRef.current) {
      saveStoryProgress(user.uid, p, 0);
    }
  };

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
      if (e.key === "ArrowDown") navigate(Math.min(page + 1, stories.length - 1));
      if (e.key === "ArrowUp")   navigate(Math.max(page - 1, 0));
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, stories.length]);

  const total   = stories.length;
  const current = stories[page];
  const { user }  = useAuth();

  return (
    <div className={styles.root}>
      {/* WebGL parchment background */}
      <BookBackground mood={current.mood ?? "dawn"} />

      {/* Portrait 480px frame */}
      <div className={styles.frame}>

        {/* User avatar — top left */}
        <button className={styles.avatarBtn} aria-label="Sign out" onClick={() => signOut(auth)}>
          {user?.photoURL ? (
            <img src={user.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" width="20" height="20">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Page counter — top right, like a book header */}
        <div ref={pickerRef} className={styles.pageCounterWrap}>
          <button
            className={styles.pageCounter}
            onClick={() => setPickerOpen((o) => !o)}
            aria-label="Chapter list"
            aria-expanded={pickerOpen}
          >
            {String(page + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
          </button>

          {pickerOpen && (
            <div className={styles.chapterPicker}>
              {stories.slice(0, maxPage + 1).map((story, idx) => (
                <button
                  key={idx}
                  className={styles.chapterPickerItem}
                  data-active={idx === page ? "true" : undefined}
                  onClick={() => { navigate(idx); setPickerOpen(false); }}
                >
                  <span className={styles.chapterPickerNum}>
                    {String(idx + 1).padStart(2, "0")}
                  </span>
                  <span>{story.title}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
                            onClick={() => navigate(page + 1)}
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
                          initialTime={didNavigate.current ? 0 : initialTimeRef.current}
                          onTimeUpdate={(t) => {
                            setAudioTime(t);
                            persistProgress(page, t);
                          }}
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
