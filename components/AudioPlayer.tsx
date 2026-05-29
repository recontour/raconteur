"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./AudioPlayer.module.css";

interface AudioPlayerProps {
  audioSrc: string;
  title: string;
  subtitles?: Array<{ time: number; text: string }>;
  /** Seek to this position (seconds) once audio metadata is loaded */
  initialTime?: number;
  /** Called on every timeupdate — use this to drive SyncParagraph */
  onTimeUpdate?: (time: number) => void;
  /** Called once the audio file metadata loads */
  onDurationChange?: (duration: number) => void;
  /** Called whenever play/pause state changes */
  onPlayChange?: (playing: boolean) => void;
  /** Called when audio playback reaches the end */
  onEnded?: () => void;
}

export default function AudioPlayer({
  audioSrc,
  title,
  subtitles = [],
  initialTime = 0,
  onTimeUpdate,
  onDurationChange,
  onPlayChange,
  onEnded,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  // Capture initialTime once on mount so it's immune to re-renders
  const seekOnLoadRef = useRef(initialTime);
  const [isPlaying, setIsPlaying]     = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration]       = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState("");

  // Keep parent callbacks in refs so the effect never needs to re-subscribe
  const onTimeRef     = useRef(onTimeUpdate);
  const onDurRef      = useRef(onDurationChange);
  const onPlayRef     = useRef(onPlayChange);
  const onEndedRef    = useRef(onEnded);
  useEffect(() => { onTimeRef.current  = onTimeUpdate;     }, [onTimeUpdate]);
  useEffect(() => { onDurRef.current   = onDurationChange; }, [onDurationChange]);
  useEffect(() => { onPlayRef.current  = onPlayChange;     }, [onPlayChange]);
  useEffect(() => { onEndedRef.current = onEnded;          }, [onEnded]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      onTimeRef.current?.(t);

      if (subtitles.length > 0) {
        const current = subtitles.find(
          (sub, idx) =>
            t >= sub.time &&
            (idx === subtitles.length - 1 || t < subtitles[idx + 1].time)
        );
        setCurrentSubtitle(current?.text || "");
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      onDurRef.current?.(audio.duration);
      if (seekOnLoadRef.current > 0) {
        audio.currentTime = seekOnLoadRef.current;
        seekOnLoadRef.current = 0;
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      onPlayRef.current?.(false);
      onEndedRef.current?.();
    };

    audio.addEventListener("timeupdate",      handleTimeUpdate);
    audio.addEventListener("loadedmetadata",  handleLoadedMetadata);
    audio.addEventListener("ended",           handleEnded);
    return () => {
      audio.removeEventListener("timeupdate",     handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended",          handleEnded);
    };
  }, [subtitles]);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    const next = !isPlaying;
    if (next) {
      // 1-second lead-in before audio starts
      setTimeout(() => audioRef.current?.play(), 1000);
    } else {
      audioRef.current.pause();
    }
    setIsPlaying(next);
    onPlayRef.current?.(next);
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const t = parseFloat(e.target.value);
    setCurrentTime(t);
    onTimeRef.current?.(t);
    if (audioRef.current) audioRef.current.currentTime = t;
  };

  const fmt = (t: number) => {
    if (isNaN(t)) return "0:00";
    return `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
  };

  return (
    <div className={styles.player}>
      <audio ref={audioRef} src={audioSrc} preload="metadata" />

      <button
        onClick={togglePlayPause}
        className={styles.playButton}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <input
        type="range"
        className={styles.scrubber}
        min={0}
        max={duration || 100}
        step={0.1}
        value={currentTime}
        onChange={handleProgressChange}
        aria-label="Seek"
        style={{
          background: `linear-gradient(to right,
            rgba(80,200,255,0.75) ${duration ? (currentTime / duration) * 100 : 0}%,
            rgba(255,255,255,0.15) ${duration ? (currentTime / duration) * 100 : 0}%)`,
        }}
      />

      <span className={styles.time}>{fmt(currentTime)}</span>
    </div>
  );
}
