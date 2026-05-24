"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./AudioPlayer.module.css";

interface AudioPlayerProps {
  audioSrc: string;
  title: string;
  subtitles?: Array<{
    time: number;
    text: string;
  }>;
}

export default function AudioPlayer({
  audioSrc,
  title,
  subtitles = [],
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentSubtitle, setCurrentSubtitle] = useState("");

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);

      // Update subtitles
      if (subtitles.length > 0) {
        const current = subtitles.find(
          (sub, idx) =>
            audio.currentTime >= sub.time &&
            (idx === subtitles.length - 1 ||
              audio.currentTime < subtitles[idx + 1].time)
        );
        setCurrentSubtitle(current?.text || "");
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    const handleEnded = () => {
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [subtitles]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className={styles.player}>
      <audio ref={audioRef} src={audioSrc} />

      {/* Subtitles */}
      {currentSubtitle && (
        <div className={styles.subtitles}>{currentSubtitle}</div>
      )}

      {/* Title */}
      <p className={styles.title}>{title}</p>

      {/* Progress Bar */}
      <div className={styles.progressContainer}>
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleProgressChange}
          className={styles.progressBar}
        />
      </div>

      {/* Controls */}
      <div className={styles.controls}>
        {/* Time Display */}
        <span className={styles.time}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Play/Pause Button */}
        <button
          onClick={togglePlayPause}
          className={styles.playButton}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
